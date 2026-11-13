const mongoose = require('mongoose');

const AnalyteSchema = new mongoose.Schema({
  section: { type: String, default: '' },
  name: { type: String, default: 'Analyte' },
  result: { type: String, default: '' },
  unit: { type: String, default: '' },
  referenceRange: { type: String, default: '' },
  remarks: { type: String, default: '' },
}, { _id: false });

const DiagnosticReportSchema = new mongoose.Schema({
  reportType: { type: String, enum: ['BIO', 'CBC'], required: true },
  title: { type: String, required: true },
  ownerId: { type: String, required: true, index: true },
  petId: { type: String, required: true, index: true },
  ownerSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  petSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  patientDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  analytes: { type: [AnalyteSchema], default: [] },
  ocrText: { type: String, default: '' },
  sourceImageName: { type: String, default: '' },
  logoData: { type: String, default: '' },
  pdfData: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('DiagnosticReport', DiagnosticReportSchema);
