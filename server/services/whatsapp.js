const crypto = require('crypto');

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

function readConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw Object.assign(new Error('WhatsApp is not connected yet. Add the WhatsApp access token and phone number ID on the server.'), {
      status: 503,
      code: 'WHATSAPP_NOT_CONFIGURED',
    });
  }
  return { token, phoneNumberId };
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const countryCode = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '').replace(/\D/g, '');
  if (countryCode && digits.length <= 10) return `${countryCode}${digits.replace(/^0+/, '')}`;
  return digits;
}

async function graphRequest(path, init = {}) {
  const { token } = readConfig();
  const res = await fetch(`${GRAPH_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(body.error?.message || `WhatsApp request failed (${res.status})`), {
      status: 502,
      code: body.error?.code,
    });
  }
  return body;
}

function sendMessage(payload) {
  const { phoneNumberId } = readConfig();
  return graphRequest(`/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
}

async function findTemplateInWaba(templateName) {
  try {
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const res = await graphRequest(`/${wabaId}/message_templates?limit=100&fields=name,status,language,id`);
    const matches = (res.data || []).filter((t) => t.name === templateName);
    return {
      wabaId,
      matches,
      all: (res.data || []).map((t) => `${t.name} (${t.language}: ${t.status})`),
    };
  } catch {
    return null;
  }
}

async function sendTemplateMessageWithFallback(payloadBuilder, templateName = 'template') {
  const configuredLang = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';
  const candidates = [...new Set([configuredLang, 'en', 'en_US', 'en_GB', 'en_IN'])].filter(Boolean);

  let lastErr;
  for (const lang of candidates) {
    try {
      return await sendMessage(payloadBuilder(lang));
    } catch (err) {
      lastErr = err;
      if (err.code === 132000 || err.code === 132001 || /language|translation|template/i.test(err.message)) {
        continue;
      }
      throw err;
    }
  }

  // If candidate languages failed, inspect the actual WABA to diagnose or auto-recover
  if (lastErr && (lastErr.code === 132000 || lastErr.code === 132001)) {
    const wabaInfo = await findTemplateInWaba(templateName);
    if (wabaInfo) {
      if (wabaInfo.matches.length > 0) {
        for (const m of wabaInfo.matches) {
          if (m.status === 'APPROVED' || m.status === 'ACTIVE') {
            try {
              return await sendMessage(payloadBuilder(m.language));
            } catch (retryErr) {
              lastErr = retryErr;
            }
          } else {
            const statusErr = new Error(
              `Template '${templateName}' exists in your WhatsApp Business Account (${wabaInfo.wabaId}), ` +
              `but its current status is '${m.status}'. Meta Cloud API requires 'APPROVED' status before messages can be sent.`
            );
            statusErr.code = 132001;
            statusErr.status = 400;
            throw statusErr;
          }
        }
      } else {
        const notFoundErr = new Error(
          `Template '${templateName}' was NOT found in WhatsApp Business Account (${wabaInfo.wabaId}). ` +
          `Active templates in this WABA: [${wabaInfo.all.join(', ') || 'None'}]. ` +
          `Please make sure the template was created under WABA ID ${wabaInfo.wabaId} in Meta WhatsApp Manager.`
        );
        notFoundErr.code = 132001;
        notFoundErr.status = 400;
        throw notFoundErr;
      }
    }

    const enriched = new Error(
      `Meta WhatsApp API (#132001): Template '${templateName}' was not found in language (${candidates.join(', ')}). ` +
      `Ensure the template is Submitted and has status 'APPROVED' in Meta WhatsApp Manager under this account, and check the language matches.`
    );
    enriched.code = lastErr.code;
    enriched.status = 400;
    throw enriched;
  }
  throw lastErr;
}

async function uploadPdfMedia(pdfBuffer, filename) {
  const { phoneNumberId } = readConfig();
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename || 'document.pdf');
  const upload = await graphRequest(`/${phoneNumberId}/media`, { method: 'POST', body: form });
  if (!upload?.id) {
    throw Object.assign(new Error('Failed to upload PDF document to WhatsApp.'), { status: 502 });
  }
  return upload.id;
}

async function sendPdfDocument(to, pdfBuffer, filename, caption) {
  const mediaId = await uploadPdfMedia(pdfBuffer, filename);
  return sendMessage({ to, type: 'document', document: { id: mediaId, filename, caption } });
}

async function sendDocumentTemplate(to, { templateName, pdfBuffer, filename, bodyParameters }) {
  const name = templateName || 'pet_report';
  const mediaId = await uploadPdfMedia(pdfBuffer, filename);

  const payloadBuilder = (lang) => ({
    to,
    type: 'template',
    recipient_type: 'individual',
    template: {
      name: name,
      language: { code: lang },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'document',
              document: {
                id: mediaId,
                filename: filename || 'document.pdf',
              },
            },
          ],
        },
        {
          type: 'body',
          parameters: (bodyParameters || []).map((text) => ({ type: 'text', text: String(text || '—') })),
        },
      ],
    },
  });

  const response = await sendTemplateMessageWithFallback(payloadBuilder, name);
  if (!response.messages?.[0]?.id) {
    throw Object.assign(new Error('WhatsApp accepted the request without returning a message ID.'), {
      status: 502,
      code: 'WHATSAPP_MESSAGE_ID_MISSING',
    });
  }
  return response;
}

let cachedReminderTemplate = null;
let cacheReminderExpiry = 0;

async function resolveReminderTemplate() {
  if (process.env.WHATSAPP_REMINDER_TEMPLATE_NAME && process.env.WHATSAPP_REMINDER_TEMPLATE_NAME !== 'appointment_reminder_24h') {
    return process.env.WHATSAPP_REMINDER_TEMPLATE_NAME;
  }

  const now = Date.now();
  if (cachedReminderTemplate && now < cacheReminderExpiry) {
    return cachedReminderTemplate;
  }

  try {
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const res = await graphRequest(`/${wabaId}/message_templates?name=appointment_reminder&fields=name,status,language`);
    const matches = (res.data || []).filter((t) => t.name === 'appointment_reminder');
    const isApproved = matches.some((m) => m.status === 'APPROVED' || m.status === 'ACTIVE');
    if (isApproved) {
      cachedReminderTemplate = 'appointment_reminder';
      cacheReminderExpiry = now + 60 * 1000;
      return 'appointment_reminder';
    }
  } catch {}

  cachedReminderTemplate = 'appointment_reminder_24h';
  cacheReminderExpiry = now + 60 * 1000;
  return 'appointment_reminder_24h';
}

async function sendAppointmentReminder(to, parameters, timing = null) {
  const templateName = await resolveReminderTemplate();

  let finalParameters = parameters;
  if (templateName === 'appointment_reminder') {
    // Dynamic template: "Hello {{1}}, this is a reminder that {{2}} has an appointment {{3}}..."
    // {{3}} is dynamic: "today at 5:00 PM" or "tomorrow at 10:30 AM"
    const label = timing?.fullLabel || parameters[2] || 'soon';
    finalParameters = [parameters[0], parameters[1], label];
  } else {
    // Legacy 24h template: "Hello {{1}}, this is a reminder that {{2}} has an appointment tomorrow, {{3}}..."
    // {{3}} is time only: "at 10:30 AM"
    let timeLabel = timing?.timeOnly || parameters[2] || 'soon';
    timeLabel = String(timeLabel).replace(/^(today|tomorrow)\s*/i, '');
    finalParameters = [parameters[0], parameters[1], timeLabel || 'soon'];
  }

  const payloadBuilder = (lang) => ({
    to,
    type: 'template',
    recipient_type: 'individual',
    template: {
      name: templateName,
      language: { code: lang },
      components: [
        {
          type: 'body',
          parameters: finalParameters.map((text) => ({ type: 'text', text: String(text || '—') })),
        },
      ],
    },
  });

  const response = await sendTemplateMessageWithFallback(payloadBuilder, templateName);
  if (!response.messages?.[0]?.id) {
    throw Object.assign(new Error('WhatsApp accepted the request without returning a message ID, so delivery could not be confirmed.'), {
      status: 502,
      code: 'WHATSAPP_MESSAGE_ID_MISSING',
    });
  }
  return response;
}

async function checkTemplatesStatus() {
  const { phoneNumberId } = readConfig();
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  let phoneData = { display_phone_number: '+91 84888 20880', verified_name: 'New Life Pet Hospital' };
  try {
    const p = await graphRequest(`/${phoneNumberId}?fields=id,display_phone_number,verified_name`);
    if (p.id) phoneData = p;
  } catch {}

  let templateList = [];
  try {
    const res = await graphRequest(`/${wabaId}/message_templates?limit=100&fields=name,status,language,category`);
    templateList = res.data || [];
  } catch (err) {
    return {
      success: false,
      wabaId,
      phone: phoneData.display_phone_number,
      error: `Could not fetch templates from WABA ${wabaId}: ${err.message}`,
    };
  }

  const expected = [
    { key: 'reminder_24h', name: process.env.WHATSAPP_REMINDER_TEMPLATE_NAME || 'appointment_reminder_24h' },
    { key: 'reminder_dynamic', name: 'appointment_reminder' },
    { key: 'report', name: process.env.WHATSAPP_REPORT_TEMPLATE_NAME || 'pet_report' },
    { key: 'certificate', name: process.env.WHATSAPP_CERTIFICATE_TEMPLATE_NAME || 'pet_certificate' },
  ];

  const results = expected.map((exp) => {
    const matches = templateList.filter((t) => t.name === exp.name);
    return {
      key: exp.key,
      expectedName: exp.name,
      found: matches.length > 0,
      variants: matches.map((m) => ({
        status: m.status,
        language: m.language,
        category: m.category,
      })),
    };
  });

  return {
    success: true,
    wabaId,
    phone: phoneData.display_phone_number,
    verifiedName: phoneData.verified_name,
    expectedTemplates: results,
    allTemplatesCount: templateList.length,
    templates: templateList.map((t) => ({ name: t.name, status: t.status, language: t.language })),
  };
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !rawBody || typeof signature !== 'string') return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`);
  const received = Buffer.from(signature);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

module.exports = {
  normalizePhone,
  sendPdfDocument,
  sendDocumentTemplate,
  sendAppointmentReminder,
  resolveReminderTemplate,
  checkTemplatesStatus,
  verifyWebhookSignature,
};
