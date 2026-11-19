import { jsPDF } from 'jspdf';
import { applyBioDefaults, applyCbcReferenceRanges, formatPetAge, normalizeReferenceRange, normalizeResultValue, resultInRange } from './report-parser';
import type { ReportAnalyte, ReportDraft, ReportType } from './report-types';
import { DEFAULT_REPORT_BANNER } from './report-default-banner';

const TEXT_COLOR: [number, number, number] = [25, 25, 25];
const IN_RANGE_COLOR: [number, number, number] = [30, 80, 200];
const OUT_OF_RANGE_COLOR: [number, number, number] = [200, 35, 35];
const COLUMNS = [38, 215, 285, 355, 475, 554];
const CBC_COLUMNS = [73, 228, 313, 398];
const CBC_TABLE_START_X = 73;
const CBC_TABLE_WIDTH = 450;
const CBC_TABLE_END_X = 523;

function formatSlashDate(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr.replace(/-/g, '/');
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function formatRefBy(ref?: string): string {
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

function formatDoctorName(name?: string): string {
  const d = (name || 'Dr. Arshi K. Vala').trim();
  if (/^Dr\.?\s+/i.test(d)) return d;
  return `Dr. ${d}`;
}

function drawHeaderSection(doc: jsPDF, draft: ReportDraft): number {
  const { owner, pet, patientDetails } = draft;

  // 1. Logo on Left Side
  const logo = draft.logoDataUrl || DEFAULT_REPORT_BANNER;
  const logoTop = 25;
  const targetLogoH = 54;
  let logoH = targetLogoH;
  let logoBottom = logoTop + logoH;
  if (logo) {
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
  }

  // 2. Patient Details on Right Side - vertically centered in line with the logo
  const logoCenterY = logoTop + logoH / 2;
  const rowH = 18;
  const row1Y = Math.round(logoCenterY + 2);
  const row0Y = row1Y - rowH;
  const row2Y = row1Y + rowH;
  const yPositions = [row0Y, row1Y, row2Y];

  // Pet name with MR. or MISS prefix
  const petNameRaw = (pet.name || 'PATIENT').trim();
  const petUpper = petNameRaw.toUpperCase();
  const isFemale = (pet.gender || '').toLowerCase().includes('female');
  const prefix = isFemale ? 'MISS' : 'MR.';
  const petFormatted =
    petUpper.startsWith('MR.') || petUpper.startsWith('MS.') || petUpper.startsWith('MISS')
      ? petUpper
      : `${prefix} ${petUpper}`;

  // Age (separate from gender)
  const ageVal =
    (patientDetails.ageGender && patientDetails.ageGender.includes('/')
      ? patientDetails.ageGender.split('/')[0].trim()
      : patientDetails.ageGender) ||
    (pet.birthDate ? formatPetAge(pet.birthDate) : '') ||
    '—';

  // Gender (separate from age - ensure it always shows)
  let rawGender =
    pet.gender ||
    (patientDetails as any).gender ||
    (patientDetails.ageGender && patientDetails.ageGender.includes('/')
      ? patientDetails.ageGender.split('/')[1].trim()
      : '');
  if (!rawGender && isFemale) rawGender = 'Female';
  const genderVal = rawGender
    ? rawGender.charAt(0).toUpperCase() + rawGender.slice(1).toLowerCase()
    : '—';

  // Owner Name
  const ownerNameVal = owner.name ? owner.name.trim() : '—';

  // Date (DD/MM/YYYY)
  const dateVal = formatSlashDate(patientDetails.date);

  // Ref. By (Dr.ARSHI VALA (M.V.Sc))
  const refByVal = formatRefBy(patientDetails.referredBy);

  // Column 1 (X: 160 to 355)
  const col1LabelX = 160;
  const col1ColonX = 232;
  const col1ValX = 240;

  // Column 2 (X: 365 to 554)
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

    // Col 1
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_COLOR);
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

    // Col 2
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_COLOR);
    doc.text(row.c2Label, col2LabelX, y);
    doc.text(':', col2ColonX, y);
    doc.text(row.c2Val, col2ValX, y);
  });

  // Divider line below header
  const headerBottom = Math.max(logoBottom, row2Y) + 14;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(38, headerBottom, 554, headerBottom);

  return headerBottom + 18;
}

function drawPageStart(doc: jsPDF, draft: ReportDraft): number {
  return drawHeaderSection(doc, draft);
}

function drawColumnHeader(doc: jsPDF, y: number, cbc: boolean): number {
  if (cbc) {
    doc.setFillColor(236, 236, 236);
    doc.rect(CBC_TABLE_START_X, y - 13, CBC_TABLE_WIDTH, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const labels = ['TEST NAME', 'RESULTS', 'UNITS', 'REF-RANGE'];
    labels.forEach((label, index) => doc.text(label, CBC_COLUMNS[index] + 4, y));
    doc.setFont('helvetica', 'normal');
    return y + 20;
  }
  doc.setFillColor(236, 236, 236);
  doc.rect(38, y - 13, 516, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const labels = ['Analyte or Parameter', 'Result', 'Unit', 'Reference Range', 'Remarks'];
  labels.forEach((label, index) => doc.text(label, COLUMNS[index] + 4, y));
  doc.setFont('helvetica', 'normal');
  return y + 20;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, cbc: boolean): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title, 296, y, { align: 'center' });
  return drawColumnHeader(doc, y + 24, cbc);
}

function normalizedRow(row: ReportAnalyte): { result: string; referenceRange: string; inRange: boolean | null } {
  const referenceRange = normalizeReferenceRange(row.referenceRange);
  const result = normalizeResultValue(row.result, referenceRange);
  return { result, referenceRange, inRange: resultInRange(result, referenceRange) };
}

function drawResult(doc: jsPDF, value: string, inRange: boolean | null, x: number, y: number): void {
  if (inRange !== null) doc.setTextColor(...(inRange ? IN_RANGE_COLOR : OUT_OF_RANGE_COLOR));
  doc.text(value, x, y);
  doc.setTextColor(...TEXT_COLOR);
}

function drawBioRow(doc: jsPDF, row: ReportAnalyte, y: number): void {
  const normalized = normalizedRow(row);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(38, y + 7, 554, y + 7);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_COLOR);
  doc.text(row.name, COLUMNS[0] + 4, y);

  doc.setFont('helvetica', 'normal');
  if (row.remarks === 'H') {
    doc.setTextColor(...OUT_OF_RANGE_COLOR);
  } else if (row.remarks === 'L') {
    doc.setTextColor(...IN_RANGE_COLOR);
  } else if (normalized.inRange !== null) {
    doc.setTextColor(...(normalized.inRange ? IN_RANGE_COLOR : OUT_OF_RANGE_COLOR));
  } else {
    doc.setTextColor(...TEXT_COLOR);
  }
  doc.text(normalized.result, COLUMNS[1] + 4, y);

  doc.setTextColor(...TEXT_COLOR);
  doc.text(row.unit || '', COLUMNS[2] + 4, y);
  doc.text(normalized.referenceRange || '', COLUMNS[3] + 4, y);

  if (row.remarks === 'H' || row.remarks === 'L') {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(row.remarks === 'H' ? OUT_OF_RANGE_COLOR : IN_RANGE_COLOR));
  }
  doc.text(row.remarks || '', COLUMNS[4] + 4, y);
  doc.setTextColor(...TEXT_COLOR);
}

function drawCbcRow(doc: jsPDF, row: ReportAnalyte, y: number): void {
  const normalized = normalizedRow(row);
  doc.setDrawColor(190, 190, 190);
  doc.line(CBC_TABLE_START_X, y + 7, CBC_TABLE_END_X, y + 7);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(row.name.slice(0, 28), CBC_COLUMNS[0] + 4, y);
  doc.setFont('helvetica', 'normal');
  drawResult(doc, normalized.result.slice(0, 14), normalized.inRange, CBC_COLUMNS[1] + 4, y);
  doc.text(row.unit.slice(0, 14), CBC_COLUMNS[2] + 4, y);
  doc.text(normalized.referenceRange.slice(0, 18), CBC_COLUMNS[3] + 4, y);
}

function drawBioFooter(doc: jsPDF, pageNum: number, totalPages: number): void {
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text('*This is not a legal document', 38, 805);
  doc.text(
    '*This blood sample is analyzed on MISPA ChemDx AUTO DRY BIOCHEMISTRY ANALYZER of veterinary mode. All results are intended to be correlated with clinical findings for final diagnosis.',
    38,
    815,
  );
  doc.text(`Page ${pageNum} of ${totalPages}`, 554, 805, { align: 'right' });
}

function drawPotentialInterference(doc: jsPDF, y: number): number {
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  const interferenceText =
    'Potential Interference if value exceeds: Analyte: Bilirubin (mg/dl)/ Vitamin C (mg/dl)/ Haemoglobin (gm/l): ALB *40 200 *5 - ALP *40 200 *3 -ALT *20 200 *5 - AST *20 200 *3- CHE *40 200 *8- DB \u2014 *5 *3- GGT *40 200 *5- TB \u2014 *75 *2 TBA- *40 200 *5- TP *25 *100 *3 -Crea *5 *0.5 *3 - UA *3 *0.5 *3 - UREA *25 200 *5 - GLU *40 *50 *5 - CK *80 200 *3 - HDL *5 *0.5 *3 - TC *40 *40 *5 - TG * 40 *50 *3 - AMY * 40 *100 *5';
  const wrappedInterference = doc.splitTextToSize(interferenceText, 516) as string[];
  doc.text(wrappedInterference, 38, y);
  return y + wrappedInterference.length * 9;
}

function drawDoctorSignature(doc: jsPDF, draft: ReportDraft, sigY = 720): void {
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.5);
  doc.line(420, sigY, 554, sigY);
  doc.setTextColor(...TEXT_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(formatDoctorName(draft.patientDetails.doctorName), 420, sigY + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(draft.patientDetails.doctorPosition || 'M.V.Sc (SURGERY & RADIOLOGY)', 420, sigY + 26);
  const approvedDate = formatApprovedDate(draft.patientDetails.date);
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text(`** This is an Electronically Approved Report.   **Report Approved on : ${approvedDate}`, 38, sigY + 40);
}

function drawBioTable(doc: jsPDF, draft: ReportDraft, rows: ReportAnalyte[], startY: number): void {
  const kidneyRows: ReportAnalyte[] = [];
  const liverRows: ReportAnalyte[] = [];
  const pancRows: ReportAnalyte[] = [];
  const lipidRows: ReportAnalyte[] = [];
  const otherRows: ReportAnalyte[] = [];

  rows.forEach((r) => {
    const s = (r.section || '').toLowerCase();
    if (s.includes('kidney')) kidneyRows.push(r);
    else if (s.includes('liver')) liverRows.push(r);
    else if (s.includes('panc')) pancRows.push(r);
    else if (s.includes('lipid')) lipidRows.push(r);
    else otherRows.push(r);
  });

  const totalRows = rows.length;

  if (totalRows <= 13) {
    let cursor = startY;
    const sections: [string, ReportAnalyte[]][] = [
      ['Kidney Profile', kidneyRows],
      ['Liver Profile', liverRows],
      ['Pancreatic Profile', pancRows],
      ['Lipid Profile', lipidRows],
      ['Other', otherRows],
    ];

    sections.forEach(([secName, secRows]) => {
      if (!secRows.length) return;
      cursor = drawSectionTitle(doc, secName, cursor, false);
      secRows.forEach((r) => {
        drawBioRow(doc, r, cursor);
        cursor += 20;
      });
      cursor += 12;
    });

    if (cursor < 640) {
      drawPotentialInterference(doc, cursor + 8);
    }
    drawDoctorSignature(doc, draft, 720);
    drawBioFooter(doc, 1, 1);
    return;
  }

  // 2-page layout matching sample PDF
  // Page 1
  let cursor = startY;
  if (kidneyRows.length > 0) {
    cursor = drawSectionTitle(doc, 'Kidney Profile', cursor, false);
    kidneyRows.forEach((r) => {
      drawBioRow(doc, r, cursor);
      cursor += 20;
    });
    cursor += 12;
  }

  const page1Liver = liverRows.slice(0, 10);
  const page2Liver = liverRows.slice(10);

  if (page1Liver.length > 0) {
    cursor = drawSectionTitle(doc, 'Liver Profile', cursor, false);
    page1Liver.forEach((r) => {
      drawBioRow(doc, r, cursor);
      cursor += 20;
    });
  }
  drawBioFooter(doc, 1, 2);

  // Page 2
  doc.addPage();
  cursor = drawPageStart(doc, draft);

  if (page2Liver.length > 0) {
    cursor = drawSectionTitle(doc, 'Liver Profile', cursor, false);
    page2Liver.forEach((r) => {
      drawBioRow(doc, r, cursor);
      cursor += 20;
    });
    cursor += 12;
  }

  if (pancRows.length > 0) {
    cursor = drawSectionTitle(doc, 'Pancreatic Profile', cursor, false);
    pancRows.forEach((r) => {
      drawBioRow(doc, r, cursor);
      cursor += 20;
    });
    cursor += 12;
  }

  if (lipidRows.length > 0) {
    cursor = drawSectionTitle(doc, 'Lipid Profile', cursor, false);
    lipidRows.forEach((r) => {
      drawBioRow(doc, r, cursor);
      cursor += 20;
    });
    cursor += 12;
  }

  if (otherRows.length > 0) {
    cursor = drawSectionTitle(doc, 'Other', cursor, false);
    otherRows.forEach((r) => {
      drawBioRow(doc, r, cursor);
      cursor += 20;
    });
    cursor += 12;
  }

  drawPotentialInterference(doc, Math.min(cursor + 12, 650));
  drawDoctorSignature(doc, draft, 720);
  drawBioFooter(doc, 2, 2);
}

function drawCbcTable(doc: jsPDF, draft: ReportDraft, rows: ReportAnalyte[], y: number): number {
  let cursor = y;
  let index = 0;
  while (index < rows.length) {
    const section = rows[index].section || draft.reportType;
    const sectionRows: ReportAnalyte[] = [];
    while (index < rows.length && (rows[index].section || draft.reportType) === section) {
      sectionRows.push(rows[index]);
      index += 1;
    }
    if (cursor > 700) {
      doc.addPage();
      cursor = drawPageStart(doc, draft);
    }
    cursor = drawSectionTitle(doc, section, cursor, true);
    sectionRows.forEach((row) => {
      if (cursor > 760) return;
      drawCbcRow(doc, row, cursor);
      cursor += 22;
    });
  }
  return cursor;
}

function formatApprovedDate(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}-${m}-${y}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

export async function optimizeLogoForPdf(dataUrl?: string): Promise<string | undefined> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const MAX_W = 600;
      const MAX_H = 180;
      const scale = Math.min(1, MAX_W / img.width, MAX_H / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function drawOtherTable(
  doc: jsPDF,
  draft: ReportDraft,
  rows: ReportAnalyte[],
  startY: number,
  interpretation?: string,
): number {
  let cursor = startY;

  // 1. Table Header Bar (matching PDF screenshot: light blue/cyan fill with dark border)
  doc.setFillColor(232, 244, 248);
  doc.setDrawColor(20, 30, 45);
  doc.rect(38, cursor - 13, 516, 20, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_COLOR);

  const colX = {
    testName: 48,
    observedValue: 245,
    unit: 380,
    referenceRange: 450,
  };

  doc.text('Test Name', colX.testName, cursor);
  doc.text('Observed Value', colX.observedValue, cursor);
  doc.text('Unit', colX.unit, cursor);
  doc.text('Reference Range', colX.referenceRange, cursor);

  cursor += 24;

  // 2. Centered Underlined Test Title
  const testTitle = (draft.otherTestType || rows[0]?.section || draft.title || 'TEST').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_COLOR);
  const textWidth = doc.getTextWidth(testTitle);
  const centerX = 296;
  doc.text(testTitle, centerX, cursor, { align: 'center' });
  doc.setDrawColor(25, 25, 25);
  doc.setLineWidth(0.75);
  doc.line(centerX - textWidth / 2 - 2, cursor + 2, centerX + textWidth / 2 + 2, cursor + 2);

  cursor += 20;

  // 3. Test Rows
  rows.forEach((row) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_COLOR);
    doc.text(row.name, colX.testName, cursor);

    // Observed value with colon: ": 2.3"
    const valText = row.result ? `: ${row.result}` : ': —';
    const normalized = normalizedRow(row);
    drawResult(doc, valText, normalized.inRange, colX.observedValue, cursor);

    doc.text(row.unit || '—', colX.unit, cursor);
    doc.text(row.referenceRange || '—', colX.referenceRange, cursor);

    cursor += 20;
  });

  cursor += 12;

  // 4. Interpretation / Remarks below the table
  const interpText = interpretation || draft.interpretation;
  if (interpText) {
    const lines = interpText.split('\n');
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        cursor += 8;
        return;
      }
      if (
        trimmed.startsWith('Interpretation') ||
        trimmed.startsWith('Report remark') ||
        trimmed.startsWith('***')
      ) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...TEXT_COLOR);
        doc.text(trimmed, 48, cursor);
        cursor += 14;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(40, 40, 40);
        const wrapped = doc.splitTextToSize(trimmed, 500) as string[];
        doc.text(wrapped, 48, cursor);
        cursor += wrapped.length * 11;
      }
    });
  }

  // 5. Divider Line & End of Report
  cursor += 14;
  if (cursor < 670) {
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.line(38, cursor, 554, cursor);
    cursor += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text('*** End of Report ***', centerX, cursor, { align: 'center' });
  }

  // 6. Draw SIGNATURE label at bottom right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_COLOR);
  doc.text('SIGNATURE', 487, 708, { align: 'center' });

  return cursor;
}

export function createReportPdf(draft: ReportDraft): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const y = drawPageStart(doc, draft);
  if (draft.reportType === 'CBC') {
    const analytes = applyCbcReferenceRanges(draft.analytes);
    drawCbcTable(doc, draft, analytes, y);
    drawDoctorSignature(doc, draft, 725);
  } else if (draft.reportType === 'OTHER') {
    drawOtherTable(doc, draft, draft.analytes, y, draft.interpretation);
    drawDoctorSignature(doc, draft, 725);
  } else {
    const analytes = applyBioDefaults(draft.analytes);
    drawBioTable(doc, draft, analytes, y);
  }
  return doc.output('blob');
}

export function openPdfBlobInNewTab(pdf: Blob): void {
  const url = URL.createObjectURL(pdf);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function openPdfDataUrlInNewTab(dataUrl: string): void {
  const base64 = dataUrl.split(',', 2)[1] || '';
  const binary = window.atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  openPdfBlobInNewTab(new Blob([bytes], { type: 'application/pdf' }));
}

