import { jsPDF } from 'jspdf';
import { buildCertificateContent, type CertificateDetails, type LetterheadSettings } from './certificate-templates';

const TEXT_COLOR: [number, number, number] = [25, 25, 25];
const LEFT = 38;
const WIDTH = 516;
const RIGHT = LEFT + WIDTH;
const DETAIL_COLUMNS = [LEFT, 230, 400];
const DETAIL_WIDTH = 160;

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawLetterhead(doc: jsPDF, letterhead: LetterheadSettings): number {
  if (letterhead.logoDataUrl) {
    const format = letterhead.logoDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    const { width, height } = doc.getImageProperties(letterhead.logoDataUrl);
    const logoHeight = 80;
    doc.addImage(letterhead.logoDataUrl, format, LEFT, 36, Math.min(180, logoHeight * (width / height)), logoHeight);
  }
  const textX = 250;
  const textWidth = RIGHT - textX;
  doc.setTextColor(...TEXT_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(letterhead.clinicName, textX, 54);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  let y = writeWrapped(doc, letterhead.address, textX, 72, textWidth, 11);
  doc.text(`Email : ${letterhead.email}`, textX, y + 4);
  doc.text(`Phone : ${letterhead.phone}`, textX, y + 16);
  y += 26;
  doc.setDrawColor(190, 190, 190);
  doc.line(LEFT, y, RIGHT, y);
  return y + 40;
}

function drawDetailColumns(doc: jsPDF, details: CertificateDetails, y: number): number {
  const columns: [string, [string, string][]][] = [
    ['Owner Details', [['Name', details.ownerName], ['Contact', details.ownerPhone || '-'], ['Address', details.ownerAddress || '-']]],
    ['Pet Details', [['Pet Name', details.petName], ['Pet Breed', details.petBreed || '-'], ['Pet Species', details.petSpecies || '-'], ['Pet Sex', details.petSex || '-'], ['Microchip No', details.chipNumber || '-']]],
    ['Certificate Details', [['Certificate Date', details.certificateDate], ['Certificate ID', details.certificateNo]]],
  ];
  let bottom = y;
  columns.forEach(([heading, rows], index) => {
    const x = DETAIL_COLUMNS[index];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(heading, x, y);
    let rowY = y + 16;
    rows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`${label} :`, x, rowY);
      doc.setFont('helvetica', 'normal');
      rowY = writeWrapped(doc, value, x + 62, rowY, DETAIL_WIDTH - 62, 11);
      rowY += 3;
    });
    bottom = Math.max(bottom, rowY);
  });
  return bottom + 16;
}

function drawCheckbox(doc: jsPDF, text: string, y: number): number {
  doc.setDrawColor(60, 60, 60);
  doc.rect(LEFT, y - 9, 10, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  return writeWrapped(doc, text, LEFT + 20, y, WIDTH - 20, 12) + 16;
}

function drawFooter(doc: jsPDF, letterhead: LetterheadSettings, y: number): void {
  doc.setTextColor(...TEXT_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DATE :', LEFT, y);
  doc.setDrawColor(120, 120, 120);
  doc.line(LEFT + 50, y + 2, LEFT + 220, y + 2);
  doc.text('PLACE :', LEFT, y + 36);
  doc.line(LEFT + 50, y + 38, LEFT + 220, y + 38);
  doc.setFontSize(8.5);
  doc.text('SIGN OR STAMP', RIGHT - 160, y);
  doc.setFontSize(9);
  doc.text(letterhead.doctorName, RIGHT - 160, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(letterhead.doctorPosition, RIGHT - 160, y + 30);
}

export function createCertificatePdf(details: CertificateDetails, letterhead: LetterheadSettings, includeHeader: boolean): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const content = buildCertificateContent(details, letterhead.doctorName);
  let y = includeHeader ? drawLetterhead(doc, letterhead) : 48;

  doc.setTextColor(...TEXT_COLOR);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(content.title, 297, y + 20, { align: 'center' });
  y += 84;

  if (content.layout === 'paragraph' && content.paragraph) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    y = writeWrapped(doc, content.paragraph, LEFT, y, WIDTH, 12) + 26;
  } else {
    y = drawDetailColumns(doc, details, y);
  }

  if (content.statement) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y = writeWrapped(doc, content.statement, LEFT, y, WIDTH, 12) + 20;
  }

  content.checkboxes.forEach((text) => {
    y = drawCheckbox(doc, text, y);
  });

  content.closing.forEach((text) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    y = writeWrapped(doc, text, LEFT, y, WIDTH, 12) + 14;
  });

  drawFooter(doc, letterhead, Math.max(y + 40, 620));
  return doc.output('blob');
}
