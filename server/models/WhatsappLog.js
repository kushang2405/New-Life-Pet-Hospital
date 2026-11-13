const mongoose = require('mongoose');

const WhatsappLogSchema = new mongoose.Schema(
  {
    appointmentId: { type: String, default: '' },
    messageId: { type: String, default: '', index: true },
    recipient: { type: String, default: '' },
    ownerName: { type: String, default: '' },
    petName: { type: String, default: '' },
    event: { type: String, enum: ['sent', 'failed', 'status'], required: true },
    status: { type: String, default: '' },
    error: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('WhatsappLog', WhatsappLogSchema);
