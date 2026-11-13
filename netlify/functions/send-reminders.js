const { connectDB } = require('../../server/config/db');
const { sendDueReminders } = require('../../server/services/appointmentReminders');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  const isManualRequest = Boolean(event.httpMethod);
  if (isManualRequest) {
    const expected = process.env.CRON_SECRET;
    const provided = event.queryStringParameters?.key;
    if (!expected || provided !== expected) {
      return json(401, { error: 'UNAUTHORIZED', message: 'Missing or invalid key' });
    }
  }

  try {
    await connectDB();
    const sent = await sendDueReminders();
    return json(200, { success: true, due: sent, ranAt: new Date().toISOString() });
  } catch (err) {
    console.error('[reminders] Run failed:', err.message);
    return json(500, { error: 'REMINDER_RUN_FAILED', message: err.message });
  }
};
