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

async function graphRequest(path, init) {
  const { token } = readConfig();
  const res = await fetch(`${GRAPH_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
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

async function sendPdfDocument(to, pdfBuffer, filename, caption) {
  const { phoneNumberId } = readConfig();
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename);
  const upload = await graphRequest(`/${phoneNumberId}/media`, { method: 'POST', body: form });
  return sendMessage({ to, type: 'document', document: { id: upload.id, filename, caption } });
}

async function sendAppointmentReminder(to, parameters) {
  const response = await sendMessage({
    to,
    type: 'template',
    recipient_type: 'individual',
    template: {
      name: process.env.WHATSAPP_REMINDER_TEMPLATE_NAME || 'appointment_reminder_24h',
      language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US' },
      components: [
        {
          type: 'body',
          parameters: parameters.map((text) => ({ type: 'text', text: String(text) })),
        },
      ],
    },
  });
  if (!response.messages?.[0]?.id) {
    throw Object.assign(new Error('WhatsApp accepted the request without returning a message ID, so delivery could not be confirmed.'), {
      status: 502,
      code: 'WHATSAPP_MESSAGE_ID_MISSING',
    });
  }
  return response;
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !rawBody || typeof signature !== 'string') return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`);
  const received = Buffer.from(signature);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

module.exports = { normalizePhone, sendPdfDocument, sendAppointmentReminder, verifyWebhookSignature };
