const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const DiagnosticReport = require('../models/DiagnosticReport');
const Certificate = require('../models/Certificate');
const Owner = require('../models/Owner');
const Pet = require('../models/Pet');
const Appointment = require('../models/Appointment');
const Config = require('../models/Config');
const {
  normalizePhone,
  sendPdfDocument,
  sendDocumentTemplate,
  sendAppointmentReminder,
  checkTemplatesStatus,
  verifyWebhookSignature,
} = require('../services/whatsapp');
const { sendDueReminders } = require('../services/appointmentReminders');
const { authRequired } = require('../middleware/authMiddleware');

const router = express.Router();

const SOURCES = {
  reports: {
    model: DiagnosticReport,
    typeOf: (doc) => doc.otherTestType || doc.reportType,
    petNameOf: (doc) => doc.petSnapshot?.name,
    noun: 'report',
  },
  certificates: {
    model: Certificate,
    typeOf: (doc) => doc.certificateType,
    petNameOf: (doc) => doc.petName,
    noun: 'certificate',
  },
};

const WINDOW_CLOSED_CODE = 131047;
const DAY_MS = 24 * 60 * 60 * 1000;

router.get('/webhook', (req, res) => {
  const verified = req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verified) return res.sendStatus(403);
  res.status(200).send(req.query['hub.challenge']);
});

router.post('/webhook', async (req, res) => {
  if (!verifyWebhookSignature(req.rawBody, req.get('X-Hub-Signature-256'))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  const statuses = (req.body?.entry || [])
    .flatMap((entry) => entry.changes || [])
    .flatMap((change) => change.value?.statuses || []);
  await Promise.all(statuses.map((status) => Appointment.updateOne(
    { whatsappMessageId: status.id },
    {
      $set: {
        whatsappStatus: status.status || '',
        whatsappError: status.errors?.[0]?.title || status.errors?.[0]?.message || '',
      },
    },
  )));
  res.sendStatus(200);
});

router.get(
  '/reminder-stats',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const [totalSent, sentLast24h, pending, recent, lastRunDoc] = await Promise.all([
      Appointment.countDocuments({ reminderSentAt: { $ne: null } }),
      Appointment.countDocuments({ reminderSentAt: { $gte: new Date(now.getTime() - DAY_MS) } }),
      Appointment.countDocuments({ reminderSentAt: null, status: { $in: ['Scheduled', 'Rescheduled'] }, date: { $gte: now.toISOString().slice(0, 10) } }),
      Appointment.find({ reminderSentAt: { $ne: null } }).sort({ reminderSentAt: -1 }).limit(20).lean(),
      Config.findOne({ key: 'reminder_cron_last_run' }).lean(),
    ]);
    const ownerIds = [...new Set(recent.map((a) => a.ownerId))];
    const petIds = [...new Set(recent.map((a) => a.petId))];
    const [owners, pets] = await Promise.all([Owner.find({ _id: { $in: ownerIds } }).lean(), Pet.find({ _id: { $in: petIds } }).lean()]);
    const ownerName = new Map(owners.map((o) => [String(o._id), o.name]));
    const petName = new Map(pets.map((p) => [String(p._id), p.name]));
    res.json({
      totalSent,
      sentLast24h,
      pending,
      lastRun: lastRunDoc?.data || null,
      recent: recent.map((a) => ({
        id: String(a._id),
        ownerName: ownerName.get(a.ownerId) || '',
        petName: petName.get(a.petId) || '',
        date: a.date,
        time: a.time,
        sentAt: a.reminderSentAt,
        whatsappStatus: a.whatsappStatus || 'accepted',
        whatsappError: a.whatsappError || '',
        whatsappMessageId: a.whatsappMessageId || '',
      })),
    });
  }),
);

function safeFileName(name) {
  return String(name || 'Pet').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Pet';
}

router.post(
  '/send-document',
  asyncHandler(async (req, res) => {
    const kind = req.body?.kind;
    const source = SOURCES[kind];
    if (!source) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Unknown document type' });

    const doc = await source.model.findById(req.body.id).lean();
    if (!doc) return res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found' });
    if (!doc.pdfData) return res.status(400).json({ error: 'NO_PDF', message: 'This document has no PDF saved.' });

    const owner = await Owner.findById(doc.ownerId).lean();
    const phone = owner?.phone || doc.ownerSnapshot?.phone || doc.ownerPhone;
    const to = normalizePhone(phone);
    if (!to) return res.status(400).json({ error: 'NO_PHONE', message: 'The owner has no valid phone number on file.' });

    const petName = source.petNameOf(doc) || 'Pet';
    const type = source.typeOf(doc) || 'Document';
    const ownerName = owner?.name || doc.ownerSnapshot?.name || doc.ownerName || 'Pet Parent';
    const filename = `${safeFileName(petName)}-${safeFileName(type)}.pdf`;
    const pdfBuffer = Buffer.from(doc.pdfData.split(',').pop(), 'base64');

    let templateName;
    let bodyParameters;

    if (kind === 'reports') {
      templateName = process.env.WHATSAPP_REPORT_TEMPLATE_NAME || 'pet_report';
      bodyParameters = [ownerName, type, petName];
    } else {
      templateName = process.env.WHATSAPP_CERTIFICATE_TEMPLATE_NAME || 'pet_certificate';
      bodyParameters = [ownerName, type, petName];
    }

    try {
      const response = await sendDocumentTemplate(to, {
        templateName,
        pdfBuffer,
        filename,
        bodyParameters,
      });
      res.json({ success: true, filename, messageId: response.messages?.[0]?.id });
    } catch (err) {
      if (err.code === 132000 || err.code === 132001) {
        return res.status(400).json({
          error: 'TEMPLATE_NOT_APPROVED',
          message: err.message || `The WhatsApp template '${templateName}' does not exist or is not approved yet in Meta WhatsApp Manager.`,
        });
      }
      throw err;
    }
  }),
);

router.get(
  '/templates/status',
  authRequired,
  asyncHandler(async (req, res) => {
    const result = await checkTemplatesStatus();
    res.json(result);
  }),
);

router.post(
  '/reminders/test',
  authRequired,
  asyncHandler(async (req, res) => {
    const to = normalizePhone(req.body?.phone);
    if (!to) return res.status(400).json({ error: 'NO_PHONE', message: 'Provide a valid phone number to test.' });

    const ownerName = req.body?.ownerName || 'Dr. Arshi Vala';
    const petName = req.body?.petName || 'Buddy';
    const dateTime = req.body?.dateTime || 'tomorrow at 10:30 AM';

    try {
      const isToday = /today/i.test(dateTime);
      const isTomorrow = /tomorrow/i.test(dateTime);
      const timing = {
        isToday,
        isTomorrow,
        fullLabel: dateTime,
        timeOnly: dateTime.replace(/^(today|tomorrow)\s*/i, '') || dateTime,
      };
      const response = await sendAppointmentReminder(to, [ownerName, petName, dateTime], timing);
      res.json({ success: true, messageId: response.messages?.[0]?.id, to });
    } catch (err) {
      if (err.code === 132000 || err.code === 132001) {
        return res.status(400).json({
          error: 'TEMPLATE_NOT_APPROVED',
          message: err.message,
        });
      }
      throw err;
    }
  }),
);

router.all(
  '/reminders/cron',
  asyncHandler(async (req, res) => {
    const secret = req.query?.secret || req.headers['x-cron-secret'] || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    const validSecret = process.env.CRON_SECRET || 'petcare_cron_secret_2026_secure';
    if (secret !== validSecret && !req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or missing cron secret.' });
    }
    const result = await sendDueReminders('vps-cron');
    res.json({ success: true, ...result });
  }),
);

router.post(
  '/reminders/run',
  authRequired,
  asyncHandler(async (req, res) => {
    const result = await sendDueReminders('manual');
    res.json({ success: true, ...result });
  }),
);

module.exports = router;
