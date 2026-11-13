const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST) throw new Error('SMTP_HOST is not configured');
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true',
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter;
};

const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Reset your New Life Pet Hospital password',
    text: `Hi ${name},\n\nWe received a request to reset your password. Open this link within 1 hour to choose a new one:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hi ${name},</p><p>We received a request to reset your password. The link below is valid for 1 hour.</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
};

module.exports = { sendPasswordResetEmail };
