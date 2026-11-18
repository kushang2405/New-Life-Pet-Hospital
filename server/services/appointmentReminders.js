const Appointment = require('../models/Appointment');
const Owner = require('../models/Owner');
const Pet = require('../models/Pet');
const Config = require('../models/Config');
const { normalizePhone, sendAppointmentReminder, resolveReminderTemplate } = require('./whatsapp');

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

function getAppointmentTiming(appt, now = new Date()) {
  const todayKey = localDateKey(now);
  const tomorrowKey = localDateKey(new Date(now.getTime() + 86400000));
  const apptDateKey = appt?.date || '';
  const isToday = apptDateKey === todayKey;
  const isTomorrow = apptDateKey === tomorrowKey;

  let timeStr = (appt?.time || '').trim();
  let timeOnly = '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = match[2];
    const ampm = match[3] ? match[3].toUpperCase() : (hours >= 12 ? 'PM' : 'AM');
    if (!match[3]) {
      if (hours > 12) hours -= 12;
      else if (hours === 0) hours = 12;
    }
    timeOnly = `at ${hours}:${mins} ${ampm}`;
  } else if (timeStr) {
    timeOnly = `at ${timeStr}`;
  }

  const fullLabel = isToday
    ? `today${timeOnly ? ' ' + timeOnly : ''}`
    : isTomorrow
    ? `tomorrow${timeOnly ? ' ' + timeOnly : ''}`
    : `on ${apptDateKey}${timeOnly ? ' ' + timeOnly : ''}`;

  return {
    isToday,
    isTomorrow,
    timeOnly: timeOnly || 'soon',
    fullLabel,
  };
}

async function sendDueReminders(source = 'manual', now = new Date()) {
  const startTime = Date.now();
  const windowEnd = new Date(now.getTime() + LEAD_MS);
  const dateKeys = [0, 1, 2].map((offset) => localDateKey(new Date(now.getTime() + offset * 86400000)));

  // Exclude Walk-in and Emergency appointments from candidate query
  const candidates = await Appointment.find({
    date: { $in: dateKeys },
    status: { $in: PENDING_STATUSES },
    bookingType: { $nin: ['Walk-in', 'Emergency', 'walk-in', 'emergency'] },
    reminderSentAt: null,
  }).lean();

  const due = candidates.filter((appt) => {
    // Strictly exclude Walk-in and Emergency appointments
    const bt = (appt.bookingType || '').toLowerCase().trim();
    if (bt === 'walk-in' || bt === 'emergency') return false;

    const start = appointmentStart(appt).getTime();
    return !isNaN(start) && start > now.getTime() && start <= windowEnd.getTime();
  });

  let sent = 0;
  const errors = [];
  for (const appt of due) {
    try {
      // Atomic Lock: Atomically claim the appointment if reminderSentAt is still null.
      const claimed = await Appointment.findOneAndUpdate(
        { _id: appt._id, reminderSentAt: null },
        {
          $set: {
            reminderSentAt: new Date(),
            whatsappStatus: 'sending',
          },
        },
        { returnDocument: 'after' },
      );
      if (!claimed) {
        continue;
      }

      const [owner, pet] = await Promise.all([Owner.findById(appt.ownerId).lean(), Pet.findById(appt.petId).lean()]);
      const to = normalizePhone(owner?.phone);
      if (!to) {
        await Appointment.updateOne(
          { _id: appt._id },
          {
            $set: {
              whatsappStatus: 'failed',
              whatsappError: 'No phone number on file for owner',
            },
          },
        );
        errors.push(`${owner?.name || 'An owner'} has no phone number`);
        continue;
      }

      const timing = getAppointmentTiming(appt, now);
      const activeTemplate = await resolveReminderTemplate();

      // If appointment is today, and the only available template literally says "tomorrow" (appointment_reminder_24h):
      // Do NOT send "tomorrow" for an appointment that is today, as that misleads the client.
      if (timing.isToday && activeTemplate === 'appointment_reminder_24h') {
        console.log(`[reminders] Skipping appointment ${appt._id} for today: active template '${activeTemplate}' says 'tomorrow'. Awaiting dynamic template approval.`);
        await Appointment.updateOne({ _id: appt._id }, { $set: { reminderSentAt: null, whatsappStatus: '' } });
        continue;
      }

      const message = await sendAppointmentReminder(
        to,
        [owner?.name || 'Pet Parent', pet?.name || 'your pet', timing.fullLabel],
        timing,
      );
      await Appointment.updateOne(
        { _id: appt._id },
        {
          $set: {
            whatsappMessageId: message.messages?.[0]?.id || '',
            whatsappStatus: 'accepted',
            whatsappError: '',
          },
        },
      );
      sent += 1;
    } catch (err) {
      console.error(`[reminders] Failed for appointment ${appt._id}:`, err.message);
      await Appointment.updateOne(
        { _id: appt._id },
        {
          $set: {
            whatsappStatus: 'failed',
            whatsappError: err.message || 'Failed to send WhatsApp message',
          },
        },
      );
      errors.push(err.message);
    }
  }

  const runInfo = {
    lastRunAt: new Date(),
    source, // 'interval' | 'vps-cron' | 'manual'
    dueCount: due.length,
    sentCount: sent,
    errorsCount: errors.length,
    durationMs: Date.now() - startTime,
  };

  try {
    await Config.findOneAndUpdate(
      { key: 'reminder_cron_last_run' },
      { $set: { data: runInfo } },
      { upsert: true, returnDocument: 'after' },
    );
  } catch (logErr) {
    console.error('[reminders] Could not save runInfo in Config:', logErr.message);
  }

  return { due: due.length, sent, errors, lastRun: runInfo };
}

let running = false;

function startReminderJob() {
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await sendDueReminders('interval');
    } catch (err) {
      console.error('[reminders] Pass failed:', err.message);
    } finally {
      running = false;
    }
  }, CHECK_INTERVAL_MS);
}

module.exports = { startReminderJob, sendDueReminders };
