import { jsPDF } from 'jspdf';
import { applyCbcReferenceRanges, formatPetAge, normalizeReferenceRange, normalizeResultValue, resultInRange } from './report-parser';
import type { ReportAnalyte, ReportDraft, ReportType } from './report-types';
import { DEFAULT_REPORT_BANNER } from './report-default-banner';

const TEXT_COLOR: [number, number, number] = [25, 25, 25];
const IN_RANGE_COLOR: [number, number, number] = [30, 80, 200];
const OUT_OF_RANGE_COLOR: [number, number, number] = [200, 35, 35];
const COLUMNS = [38, 190, 276, 350, 456, 554];

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
  const logoTop = 20;
  let logoBottom = logoTop;
  if (logo) {
    try {
      const format = logo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      const { width, height } = doc.getImageProperties(logo);
      const aspect = width / height;
      const logoMaxH = 72;
      const logoW = Math.min(105, logoMaxH * aspect);
      const logoH = logoW / aspect;
      doc.addImage(logo, format, 38, logoTop, logoW, logoH);
      logoBottom = logoTop + logoH;
    } catch {
      logoBottom = logoTop + 40;
    }
  }

  // 2. Patient Details on Right Side
  const detailsTop = 22;
  const rowH = 18;

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
    const y = detailsTop + idx * rowH;

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
  const headerBottom = Math.max(logoBottom, detailsTop + 3 * rowH) + 12;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(38, headerBottom, 554, headerBottom);

  return headerBottom + 14;
}

function drawPageStart(doc: jsPDF, draft: ReportDraft): number {
  return drawHeaderSection(doc, draft);
}

function drawColumnHeader(doc: jsPDF, y: number, cbc: boolean): number {
  doc.setFillColor(236, 236, 236);
  doc.rect(38, y - 13, 516, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const labels = cbc ? ['TEST NAME', 'RESULTS', 'UNITS', 'REF-RANGE'] : ['Analyte or Parameter', 'Result', 'Unit', 'Reference Range', 'Remarks'];
  labels.forEach((label, index) => doc.text(label, COLUMNS[index] + 3, y));
  doc.setFont('helvetica', 'normal');
  return y + 20;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, cbc: boolean): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title, 296, y, { align: 'center' });
  return drawColumnHeader(doc, y + 18, cbc);
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
  doc.setDrawColor(190, 190, 190);
  doc.line(38, y + 7, 554, y + 7);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(row.name.slice(0, 28), COLUMNS[0] + 3, y);
  doc.setFont('helvetica', 'normal');
  drawResult(doc, normalized.result.slice(0, 14), normalized.inRange, COLUMNS[1] + 3, y);
  doc.text(row.unit.slice(0, 14), COLUMNS[2] + 3, y);
  doc.text(normalized.referenceRange.slice(0, 18), COLUMNS[3] + 3, y);
  doc.text(row.remarks.slice(0, 12), COLUMNS[4] + 3, y);
}

function drawCbcRow(doc: jsPDF, row: ReportAnalyte, y: number): void {
  const normalized = normalizedRow(row);
  doc.setDrawColor(190, 190, 190);
  doc.line(38, y + 7, 554, y + 7);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(row.name.slice(0, 28), COLUMNS[0] + 3, y);
  doc.setFont('helvetica', 'normal');
  drawResult(doc, normalized.result.slice(0, 14), normalized.inRange, COLUMNS[1] + 3, y);
  doc.text(row.unit.slice(0, 14), COLUMNS[2] + 3, y);
  doc.text(normalized.referenceRange.slice(0, 18), COLUMNS[3] + 3, y);
}

function groupRowsBySection(rows: ReportAnalyte[], fallback: string): Map<string, ReportAnalyte[]> {
  const groups = new Map<string, ReportAnalyte[]>();
  rows.forEach((row) => {
    const section = row.section || fallback;
    groups.set(section, [...(groups.get(section) || []), row]);
  });
  return groups;
}

function drawBioTable(doc: jsPDF, draft: ReportDraft, rows: ReportAnalyte[], y: number): number {
  let cursor = y;
  groupRowsBySection(rows, draft.reportType).forEach((sectionRows, section) => {
    if (cursor > 700) {
      doc.addPage();
      cursor = drawPageStart(doc, draft);
    }
    cursor = drawSectionTitle(doc, section, cursor, false);
    sectionRows.forEach((row) => {
      if (cursor > 760) {
        doc.addPage();
        cursor = drawPageStart(doc, draft);
        cursor = drawSectionTitle(doc, section, cursor, false);
      }
      drawBioRow(doc, row, cursor);
      cursor += 22;
    });
  });
  return cursor;
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
  const analytes = draft.reportType === 'CBC' ? applyCbcReferenceRanges(draft.analytes) : draft.analytes;
  if (draft.reportType === 'CBC') {
    drawCbcTable(doc, draft, analytes, y);
  } else if (draft.reportType === 'OTHER') {
    drawOtherTable(doc, draft, draft.analytes, y, draft.interpretation);
  } else {
    drawBioTable(doc, draft, draft.analytes, y);
  }
  doc.setDrawColor(150, 150, 150);
  doc.line(420, 725, 554, 725);
  doc.setTextColor(...TEXT_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(formatDoctorName(draft.patientDetails.doctorName), 420, 739);
  doc.setFont('helvetica', 'normal');
  doc.text(draft.patientDetails.doctorPosition || 'M.V.Sc (SURGERY & RADIOLOGY)', 420, 752);
  const approvedDate = formatApprovedDate(draft.patientDetails.date);
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text(`** This is an Electronically Approved Report.   **Report Approved on : ${approvedDate}`, 38, 766);
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

