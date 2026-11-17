const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const mongoose = require('mongoose');
require('dotenv').config();

const bannerPath = path.join(__dirname, '../public/images/report-header-banner.jpg');
const banner = fs.readFileSync(bannerPath);
const DEFAULT_BANNER = 'data:image/jpeg;base64,' + banner.toString('base64');

const CBC_REFERENCE_RANGES = {
  haemoglobin: '11.0-19.0',
  hemoglobin: '11.0-19.0',
  totalwbccount: '6.00-17.00',
  granulocytes: '52.0-81.0',
  lymphocytes: '12.0-33.0',
  mid: '2.5-24.3',
  granulocytescount: '3.62-12.30',
  lymphocytescount: '0.83-4.91',
  midcount: '0.18-3.71',
  rbccount: '5.10-8.50',
  haematocritpcv: '33.0-56.0',
  hematocritpcv: '33.0-56.0',
  mcv: '60.0-76.0',
  mch: '20.0-27.0',
  mchc: '30.0-38.0',
  rdwcv: '0.125-0.172',
  rdwsd: '33.2-46.3',
  plateletcount: '117-490',
  pct: '0.40-0.85',
  mpv: '8.0-14.1',
  pdwcv: '0.133-0.185',
  plcc: '45-170',
  plcr: '0.200-0.600',
};

function cbcRef(name) {
  const k = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return CBC_REFERENCE_RANGES[k] || '';
}

function formatSlashDate(dateStr) {
  if (!dateStr) {
    const now = new Date();
    return (
      String(now.getDate()).padStart(2, '0') +
      '/' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '/' +
      now.getFullYear()
    );
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr.replace(/-/g, '/');
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }
  return dateStr;
}

function formatApprovedDate(dateStr) {
  if (!dateStr) {
    const now = new Date();
    return (
      String(now.getDate()).padStart(2, '0') +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      now.getFullYear()
    );
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return parts[2] + '-' + parts[1] + '-' + parts[0];
  }
  return dateStr;
}

function generatePdf(r) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const logo = r.logoData || DEFAULT_BANNER;
  const format = logo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
  const { width, height } = doc.getImageProperties(logo);
  const aspect = width / height;
  let bannerHeight = 80;
  if (aspect >= 2.2) {
    bannerHeight = Math.min(115, 516 / aspect);
    doc.addImage(logo, format, 38, 18, 516, bannerHeight);
  } else {
    bannerHeight = 65;
    doc.addImage(logo, format, 38, 18, Math.min(220, bannerHeight * aspect), bannerHeight);
  }

  const startY = 18 + bannerHeight + 14;
  const pet = r.petSnapshot || {};
  const petUpper = (pet.name || 'PATIENT').trim().toUpperCase();
  const isFemale = (pet.gender || '').toLowerCase().includes('female');
  const prefix = isFemale ? 'MISS' : 'MR.';
  const petFormatted =
    petUpper.startsWith('MR.') || petUpper.startsWith('MS.') || petUpper.startsWith('MISS')
      ? petUpper
      : prefix + ' ' + petUpper;

  const pDetails = r.patientDetails || {};
  const ageVal = pDetails.ageGender || pet.birthDate || pet.gender || '—';
  const refVal = pDetails.referredBy || 'Dr.ARSHI VALA M.V.Sc';
  const branchVal =
    pDetails.sampleType && pDetails.sampleType.toLowerCase().includes('branch')
      ? pDetails.sampleType
      : 'Main Branch';
  const patIdVal =
    pDetails.sampleNo || pDetails.uhid || (pet.id ? String(pet.id).slice(-8) : '202609033');
  const dVal = formatSlashDate(pDetails.date);

  const leftCol = [
    { label: 'Collected by', val: branchVal, bold: false },
    { label: "Patient's Name", val: petFormatted, bold: true },
    { label: 'Age / Gender', val: ageVal, bold: false },
    { label: 'Ref. By', val: refVal, bold: false },
  ];
  const rightCol = [
    { label: 'Patient ID', val: patIdVal },
    { label: 'Collection Date', val: dVal },
    { label: 'Received Date', val: dVal },
    { label: 'Reporting Date', val: dVal },
  ];

  for (let i = 0; i < 4; i++) {
    const y = startY + i * 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(25, 25, 25);
    doc.text(leftCol[i].label, 44, y);
    doc.text(':', 118, y);
    if (leftCol[i].bold) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
    }
    doc.text(leftCol[i].val, 126, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(rightCol[i].label, 355, y);
    doc.text(':', 432, y);
    doc.text(rightCol[i].val, 442, y);
  }

  const tableTop = startY + 4 * 16 + 20;
  const isCbc = r.reportType === 'CBC';
  doc.setFillColor(236, 236, 236);
  doc.rect(38, tableTop - 13, 516, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(25, 25, 25);
  const cols = [38, 190, 276, 350, 456];
  if (isCbc) {
    ['TEST NAME', 'RESULTS', 'UNITS', 'REF-RANGE'].forEach((lbl, idx) =>
      doc.text(lbl, cols[idx] + 3, tableTop)
    );
  } else {
    ['Analyte or Parameter', 'Result', 'Unit', 'Reference Range', 'Remarks'].forEach((lbl, idx) =>
      doc.text(lbl, cols[idx] + 3, tableTop)
    );
  }

  let curY = tableTop + 20;
  const analytes = r.analytes || [];
  analytes.forEach((a) => {
    if (curY > 740) {
      doc.addPage();
      curY = 40;
    }
    doc.setDrawColor(190, 190, 190);
    doc.line(38, curY + 7, 554, curY + 7);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text((a.name || '').slice(0, 28), cols[0] + 3, curY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(a.result || '').slice(0, 14), cols[1] + 3, curY);
    doc.text(String(a.unit || '').slice(0, 14), cols[2] + 3, curY);
    doc.text(
      String(a.referenceRange || (isCbc ? cbcRef(a.name) : '')).slice(0, 18),
      cols[3] + 3,
      curY
    );
    if (!isCbc) doc.text(String(a.remarks || '').slice(0, 12), cols[4] + 3, curY);
    curY += 22;
  });

  doc.setDrawColor(150, 150, 150);
  doc.line(420, 762, 554, 762);
  doc.setTextColor(25, 25, 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(
    pDetails.doctorName ? 'Dr. ' + pDetails.doctorName : 'Dr. Arshi K. Vala',
    420,
    778
  );
  doc.setFont('helvetica', 'normal');
  doc.text(pDetails.doctorPosition || 'M.V.Sc (SURGERY & RADIOLOGY)', 420, 792);
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text(
    '** This is an Electronically Approved Report.   **Report Approved on : ' +
      formatApprovedDate(pDetails.date),
    38,
    805
  );

  const b64 = Buffer.from(doc.output('arraybuffer')).toString('base64');
  return 'data:application/pdf;base64,' + b64;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'petcare_pro' });
  const col = mongoose.connection.collection('diagnosticreports');
  const reports = await col.find().toArray();
  console.log(`Found ${reports.length} report(s) in database to update...`);
  for (const rep of reports) {
    const updatedPdf = generatePdf(rep);
    await col.updateOne({ _id: rep._id }, { $set: { pdfData: updatedPdf } });
    console.log(`Migrated report "${rep.title}" (${rep._id}) -> PDF length: ${updatedPdf.length}`);
  }
  console.log('Migration complete!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
