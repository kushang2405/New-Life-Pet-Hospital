const Appointment = require('../models/Appointment');
const Owner = require('../models/Owner');
const Pet = require('../models/Pet');
const { normalizePhone, sendAppointmentReminder } = require('./whatsapp');

const LEAD_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const PENDING_STATUSES = ['Scheduled', 'Rescheduled'];

function localDateKey(date) {
  try {
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

function appointmentStart(appt) {
  if (!appt?.date) return new Date(NaN);
  let timeStr = (appt.time || '09:00').trim();
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = match[2];
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    timeStr = `${String(hours).padStart(2, '0')}:${mins}`;
  }
  return new Date(`${appt.date}T${timeStr}:00+05:30`);
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
    return !isNaN(start) && start > now.getTime() && start <= windowEnd.getTime();
  });

  let sent = 0;
  const errors = [];
  for (const appt of due) {
    try {
      const [owner, pet] = await Promise.all([Owner.findById(appt.ownerId).lean(), Pet.findById(appt.petId).lean()]);
      const to = normalizePhone(owner?.phone);
      if (!to) {
        errors.push(`${owner?.name || 'An owner'} has no phone number`);
        continue;
      }
      const timeLabel = appt.time ? `${appt.date} at ${appt.time}` : appt.date;
      const message = await sendAppointmentReminder(to, [
        owner?.name || 'Pet Parent',
        pet?.name || 'your pet',
        timeLabel,
      ]);
      await Appointment.updateOne(
        { _id: appt._id },
        {
          $set: {
            reminderSentAt: new Date(),
            whatsappMessageId: message.messages?.[0]?.id || '',
            whatsappStatus: 'accepted',
          },
        },
      );
      sent += 1;
    } catch (err) {
      console.error(`[reminders] Failed for appointment ${appt._id}:`, err.message);
      errors.push(err.message);
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
