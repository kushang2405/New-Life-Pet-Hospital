const Appointment = require('../models/Appointment');
const Owner = require('../models/Owner');
const Pet = require('../models/Pet');
const Config = require('../models/Config');
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

function formatTimeLabel(appt) {
  let timeStr = (appt?.time || '').trim();
  if (!timeStr) return 'tomorrow';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = match[2];
    const ampm = match[3] ? match[3].toUpperCase() : (hours >= 12 ? 'PM' : 'AM');
    if (!match[3]) {
      if (hours > 12) hours -= 12;
      else if (hours === 0) hours = 12;
    }
    return `at ${hours}:${mins} ${ampm}`;
  }
  return `at ${timeStr}`;
}

async function sendDueReminders(source = 'manual', now = new Date()) {
  const startTime = Date.now();
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
      // Atomic Lock: Atomically claim the appointment if reminderSentAt is still null.
      // This strictly prevents duplicate sends even if the VPS cronjob and a manual trigger overlap.
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
        // Another process already claimed or sent this reminder
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
      const timeLabel = formatTimeLabel(appt);
      const message = await sendAppointmentReminder(to, [
        owner?.name || 'Pet Parent',
        pet?.name || 'your pet',
        timeLabel,
      ]);
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
