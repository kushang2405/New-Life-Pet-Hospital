const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const DiagnosticReport = require('../models/DiagnosticReport');
const Certificate = require('../models/Certificate');
const Owner = require('../models/Owner');
const Pet = require('../models/Pet');
const Appointment = require('../models/Appointment');
const WhatsappLog = require('../models/WhatsappLog');
const { normalizePhone, sendPdfDocument, verifyWebhookSignature } = require('../services/whatsapp');
const { sendDueReminders } = require('../services/appointmentReminders');
const { authRequired } = require('../middleware/authMiddleware');

const router = express.Router();

const SOURCES = {
  reports: {
    model: DiagnosticReport,
    typeOf: (doc) => doc.reportType,
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
  await Promise.all(statuses.map(async (status) => {
    const error = status.errors?.[0]?.title || status.errors?.[0]?.message || '';
    const sendLog = await WhatsappLog.findOne({ messageId: status.id, event: 'sent' }).lean();
    await Promise.all([
      Appointment.updateOne(
        { whatsappMessageId: status.id },
        { $set: { whatsappStatus: status.status || '', whatsappError: error } },
      ),
      WhatsappLog.create({
        event: 'status',
        messageId: status.id || '',
        recipient: status.recipient_id || '',
        ownerName: sendLog?.ownerName || '',
        petName: sendLog?.petName || '',
        appointmentId: sendLog?.appointmentId || '',
        status: status.status || '',
        error,
      }),
    ]);
  }));
  res.sendStatus(200);
});

router.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const logs = await WhatsappLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({
      logs: logs.map((log) => ({
        id: String(log._id),
        createdAt: log.createdAt,
        event: log.event,
        status: log.status,
        error: log.error,
        ownerName: log.ownerName,
        petName: log.petName,
        recipient: log.recipient,
        messageId: log.messageId,
      })),
    });
  }),
);

router.get(
  '/reminder-stats',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const [totalSent, sentLast24h, pending, recent] = await Promise.all([
      Appointment.countDocuments({ reminderSentAt: { $ne: null } }),
      Appointment.countDocuments({ reminderSentAt: { $gte: new Date(now.getTime() - DAY_MS) } }),
      Appointment.countDocuments({ reminderSentAt: null, status: { $in: ['Scheduled', 'Rescheduled'] }, date: { $gte: now.toISOString().slice(0, 10) } }),
      Appointment.find({ reminderSentAt: { $ne: null } }).sort({ reminderSentAt: -1 }).limit(20).lean(),
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
    const source = SOURCES[req.body?.kind];
    if (!source) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Unknown document type' });

    const doc = await source.model.findById(req.body.id).lean();
    if (!doc) return res.status(404).json({ error: 'NOT_FOUND', message: 'Document not found' });
    if (!doc.pdfData) return res.status(400).json({ error: 'NO_PDF', message: 'This document has no PDF saved.' });

    const owner = await Owner.findById(doc.ownerId).lean();
    const to = normalizePhone(owner?.phone);
    if (!to) return res.status(400).json({ error: 'NO_PHONE', message: 'The owner has no phone number on file.' });

    const petName = source.petNameOf(doc) || 'Pet';
    const type = source.typeOf(doc);
    const filename = `${safeFileName(petName)}-${type}.pdf`;
    const pdfBuffer = Buffer.from(doc.pdfData.split(',').pop(), 'base64');

    try {
      await sendPdfDocument(to, pdfBuffer, filename, `${type} ${source.noun} for ${petName}`);
    } catch (err) {
      if (err.code === WINDOW_CLOSED_CODE) {
        return res.status(409).json({
          error: 'WINDOW_CLOSED',
          message: 'WhatsApp only allows sending a file to an owner who has messaged the clinic in the last 24 hours.',
        });
      }
      throw err;
    }
    res.json({ success: true, filename });
  }),
);

router.post(
  '/reminders/run',
  authRequired,
  asyncHandler(async (req, res) => {
    const result = await sendDueReminders();
    res.json({ success: true, ...result });
  }),
);

module.exports = router;
