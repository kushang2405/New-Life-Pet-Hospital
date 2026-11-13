const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
  certificateType: { type: String, enum: ['Microchip', 'Spaying', 'Castration', 'Health'], required: true },
  certificateDate: { type: String, required: true },
  certificateNo: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true, index: true },
  ownerName: { type: String, required: true },
  ownerPhone: { type: String, default: '' },
  ownerAddress: { type: String, default: '' },
  petId: { type: String, required: true, index: true },
  petName: { type: String, required: true },
  petBreed: { type: String, default: '' },
  petSpecies: { type: String, default: '' },
  petSex: { type: String, default: '' },
  chipNumber: { type: String, default: '' },
  includeHeader: { type: Boolean, default: true },
  pdfData: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Certificate', CertificateSchema);
