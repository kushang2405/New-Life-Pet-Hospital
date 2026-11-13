const Appointment = require('../models/Appointment');
const Owner = require('../models/Owner');
const Pet = require('../models/Pet');
const WhatsappLog = require('../models/WhatsappLog');
const { normalizePhone, sendAppointmentReminder } = require('./whatsapp');

const LEAD_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const PENDING_STATUSES = ['Scheduled', 'Rescheduled'];

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function appointmentStart(appt) {
  return new Date(`${appt.date}T${appt.time || '00:00'}:00`);
}

async function sendDueReminders(now = new Date()) {
  const windowEnd = new Date(now.getTime() + LEAD_MS);
  const dateKeys = [0, 1, 2].map((offset) => localDateKey(new Date(now.getTime() + offset * 86400000)));

  const candidates = await Appointment.find({
    date: { $in: dateKeys },
    status: { $in: PENDING_STATUSES },
    reminderSentAt: null,
  }).lean();

  const due = candidates.filter((appt) => {
    const start = appointmentStart(appt).getTime();
    return start > now.getTime() && start <= windowEnd.getTime();
  });

  let sent = 0;
  const errors = [];
  for (const appt of due) {
    let ownerName = '';
    let petName = '';
    const appointmentId = String(appt._id);
    try {
      const [owner, pet] = await Promise.all([Owner.findById(appt.ownerId).lean(), Pet.findById(appt.petId).lean()]);
      ownerName = owner?.name || '';
      petName = pet?.name || '';
      const to = normalizePhone(owner?.phone);
      if (!to) {
        const message = `${ownerName || 'An owner'} has no phone number`;
        errors.push(message);
        await WhatsappLog.create({ event: 'failed', status: 'failed', error: message, ownerName, petName, appointmentId });
        continue;
      }
      const message = await sendAppointmentReminder(to, [ownerName, petName || 'your pet', `${appt.date} ${appt.time}`]);
      const messageId = message.messages?.[0]?.id || '';
      await Appointment.updateOne({ _id: appt._id }, { $set: { reminderSentAt: new Date(), whatsappMessageId: messageId, whatsappStatus: 'accepted' } });
      await WhatsappLog.create({ event: 'sent', status: 'accepted', messageId, recipient: to, ownerName, petName, appointmentId });
      sent += 1;
    } catch (err) {
      console.error(`[reminders] Failed for appointment ${appointmentId}:`, err.message);
      errors.push(err.message);
      await WhatsappLog.create({ event: 'failed', status: 'failed', error: err.message, ownerName, petName, appointmentId });
    }
  }
  return { due: due.length, sent, errors };
}

let running = false;

function startReminderJob() {
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await sendDueReminders();
    } catch (err) {
      console.error('[reminders] Pass failed:', err.message);
    } finally {
      running = false;
    }
  }, CHECK_INTERVAL_MS);
}

module.exports = { startReminderJob, sendDueReminders };
