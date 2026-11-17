const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const mongoose = require('mongoose');
require('dotenv').config();

const logoData = fs.readFileSync('C:/Users/KUSHANG TANAWALA/.gemini/antigravity/brain/1371a0fa-2e21-49d8-8287-e48eeed407cd/cropped_heart_logo.png');
const DEFAULT_LOGO = 'data:image/png;base64,' + logoData.toString('base64');

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

function formatRefBy(ref) {
  if (!ref || !ref.trim()) return 'Dr.ARSHI VALA (M.V.Sc)';
  const cleaned = ref.trim();
  if (/Dr\.?\s*ARSHI\s*VALA/i.test(cleaned)) {
    return 'Dr.ARSHI VALA (M.V.Sc)';
  }
  if (cleaned.includes('M.V.Sc') && !cleaned.includes('(M.V.Sc)')) {
    return cleaned.replace('M.V.Sc', '(M.V.Sc)');
  }
  return cleaned;
}

function formatDoctorName(name) {
  const d = (name || 'Dr. Arshi K. Vala').trim();
  if (/^Dr\.?\s+/i.test(d)) return d;
  return 'Dr. ' + d;
}

function generatePdf(r) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const logo = DEFAULT_LOGO;
  const logoTop = 25;
  const targetLogoH = 54;
  let logoH = targetLogoH;
  let logoBottom = logoTop + logoH;
  try {
    const format = logo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    const { width, height } = doc.getImageProperties(logo);
    const aspect = width / height;
    const logoW = Math.min(85, targetLogoH * aspect);
    logoH = logoW / aspect;
    doc.addImage(logo, format, 38, logoTop, logoW, logoH);
    logoBottom = logoTop + logoH;
  } catch {
    logoBottom = logoTop + 54;
  }

  const logoCenterY = logoTop + logoH / 2;
  const rowH = 18;
  const row1Y = Math.round(logoCenterY + 2);
  const row0Y = row1Y - rowH;
  const row2Y = row1Y + rowH;
  const yPositions = [row0Y, row1Y, row2Y];

  const pet = r.petSnapshot || {};
  const petUpper = (pet.name || 'PATIENT').trim().toUpperCase();
  const isFemale = (pet.gender || '').toLowerCase().includes('female');
  const prefix = isFemale ? 'MISS' : 'MR.';
  const petFormatted =
    petUpper.startsWith('MR.') || petUpper.startsWith('MS.') || petUpper.startsWith('MISS')
      ? petUpper
      : prefix + ' ' + petUpper;

  const pDetails = r.patientDetails || {};
  const ageVal =
    (pDetails.ageGender && pDetails.ageGender.includes('/')
      ? pDetails.ageGender.split('/')[0].trim()
      : pDetails.ageGender) ||
    pet.birthDate ||
    '—';

  let rawGender =
    pet.gender ||
    pDetails.gender ||
    (pDetails.ageGender && pDetails.ageGender.includes('/')
      ? pDetails.ageGender.split('/')[1].trim()
      : '');
  if (!rawGender && isFemale) rawGender = 'Female';
  const genderVal = rawGender
    ? rawGender.charAt(0).toUpperCase() + rawGender.slice(1).toLowerCase()
    : '—';

  const owner = r.ownerSnapshot || {};
  const ownerNameVal = owner.name ? owner.name.trim() : '—';
  const dateVal = formatSlashDate(pDetails.date);
  const refByVal = formatRefBy(pDetails.referredBy);

  const col1LabelX = 160;
  const col1ColonX = 232;
  const col1ValX = 240;

  const col2LabelX = 365;
  const col2ColonX = 415;
  const col2ValX = 422;

  const detailsRows = [
    {
      c1Label: "Patient's Name", c1Val: petFormatted, c1Bold: true,
      c2Label: 'Date', c2Val: dateVal, c2Bold: false,
    },
    {
      c1Label: 'Owner Name', c1Val: ownerNameVal, c1Bold: false,
      c2Label: 'Gender', c2Val: genderVal, c2Bold: false,
    },
    {
      c1Label: 'Age', c1Val: ageVal, c1Bold: false,
      c2Label: 'Ref. By', c2Val: refByVal, c2Bold: false,
    },
  ];

  detailsRows.forEach((row, idx) => {
    const y = yPositions[idx];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(25, 25, 25);
    doc.text(row.c1Label, col1LabelX, y);
    doc.text(':', col1ColonX, y);
    if (row.c1Bold) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
    }
    doc.text(row.c1Val, col1ValX, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(25, 25, 25);
    doc.text(row.c2Label, col2LabelX, y);
    doc.text(':', col2ColonX, y);
    doc.text(row.c2Val, col2ValX, y);
  });

  const headerBottom = Math.max(logoBottom, yPositions[2]) + 14;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(38, headerBottom, 554, headerBottom);

  let curY = headerBottom + 18;

  const isCbc = (r.reportType || '').toUpperCase() === 'CBC';
  const sectionTitle = isCbc ? 'CBC' : (r.reportType || 'BIOCHEMISTRY');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(25, 25, 25);
  doc.text(sectionTitle, 296, curY, { align: 'center' });
  curY += 24;

  const cols = isCbc ? [73, 228, 313, 398] : [38, 172, 250, 316, 420];
  const tableStartX = isCbc ? 73 : 38;
  const tableW = isCbc ? 450 : 516;
  const tableEndX = tableStartX + tableW;

  doc.setFillColor(236, 236, 236);
  doc.rect(tableStartX, curY - 13, tableW, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(25, 25, 25);
  const headers = isCbc
    ? ['TEST NAME', 'RESULTS', 'UNITS', 'REF-RANGE']
    : ['Analyte or Parameter', 'Result', 'Unit', 'Reference Range', 'Remarks'];
  headers.forEach((h, idx) => {
    doc.text(h, cols[idx] + (isCbc ? 4 : 3), curY);
  });
  curY += 20;

  const analytes = r.analytes || [];
  analytes.forEach((a) => {
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.5);
    doc.line(tableStartX, curY + 7, tableEndX, curY + 7);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(25, 25, 25);
    doc.text(String(a.name || '').slice(0, 28), cols[0] + (isCbc ? 4 : 3), curY);

    doc.setFont('helvetica', 'normal');
    const val = String(a.result || '');
    const ref = String(a.referenceRange || (isCbc ? cbcRef(a.name) : ''));
    let inRange = null;
    if (ref.includes('-')) {
      const [low, high] = ref.split('-').map((v) => parseFloat(v));
      const num = parseFloat(val);
      if (!isNaN(low) && !isNaN(high) && !isNaN(num)) {
        inRange = num >= low && num <= high;
      }
    }
    if (inRange !== null) {
      if (inRange) {
        doc.setTextColor(30, 100, 220); // Blue
      } else {
        doc.setTextColor(215, 38, 56); // Red
      }
    } else {
      doc.setTextColor(25, 25, 25);
    }
    doc.text(val.slice(0, 14), cols[1] + (isCbc ? 4 : 3), curY);

    doc.setTextColor(25, 25, 25);
    doc.text(String(a.unit || '').slice(0, 14), cols[2] + (isCbc ? 4 : 3), curY);
    doc.text(
      String(a.referenceRange || (isCbc ? cbcRef(a.name) : '')).slice(0, 18),
      cols[3] + (isCbc ? 4 : 3),
      curY
    );
    if (!isCbc) doc.text(String(a.remarks || '').slice(0, 12), cols[4] + 3, curY);
    curY += 22;
  });

  doc.setDrawColor(150, 150, 150);
  doc.line(420, 725, 554, 725);
  doc.setTextColor(25, 25, 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(formatDoctorName(pDetails.doctorName), 420, 739);
  doc.setFont('helvetica', 'normal');
  doc.text(pDetails.doctorPosition || 'M.V.Sc (SURGERY & RADIOLOGY)', 420, 752);
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text(
    '** This is an Electronically Approved Report.   **Report Approved on : ' +
      formatApprovedDate(pDetails.date),
    38,
    766
  );

  const b64 = Buffer.from(doc.output('arraybuffer')).toString('base64');
  return 'data:application/pdf;base64,' + b64;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'petcare_pro' });
  const col = mongoose.connection.collection('diagnosticreports');
  const reports = await col.find().toArray();
  console.log(`Found ${reports.length} report(s) to update...`);
  for (const rep of reports) {
    const updatedPdf = generatePdf(rep);
    await col.updateOne({ _id: rep._id }, { $set: { pdfData: updatedPdf } });
    console.log(`Updated report "${rep.title}" (${rep._id})`);
  }
  console.log('Migration complete!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
