import type { ReportAnalyte } from './report-types';

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

const CBC_REFERENCE_RANGES: Record<string, string> = {
  // WBC & Differential Counts
  wbc: '6.00-17.00',
  totalwbccount: '6.00-17.00',
  'lym#': '0.83-4.91',
  lymphocytescount: '0.83-4.91',
  'mid#': '0.18-3.71',
  midcount: '0.18-3.71',
  'gran#': '3.62-12.30',
  granulocytescount: '3.62-12.30',

  // Differential Percentages
  'lym%': '12.0-33.0',
  lymphocytes: '12.0-33.0',
  'mid%': '2.5-24.3',
  mid: '2.5-24.3',
  'gran%': '52.0-81.0',
  granulocytes: '52.0-81.0',

  // RBC Parameters
  rbc: '5.10-8.50',
  rbccount: '5.10-8.50',
  hgb: '11.0-19.0',
  hb: '11.0-19.0',
  haemoglobin: '11.0-19.0',
  hemoglobin: '11.0-19.0',
  hct: '33.0-56.0',
  haematocritpcv: '33.0-56.0',
  hematocritpcv: '33.0-56.0',
  mcv: '60.0-76.0',
  mch: '20.0-27.0',
  mchc: '30.0-38.0',
  'rdw-cv': '0.125-0.172',
  rdwcv: '0.125-0.172',
  'rdw-sd': '33.2-46.3',
  rdwsd: '33.2-46.3',

  // Platelet Parameters
  plt: '117-490',
  plateletcount: '117-490',
  mpv: '8.0-14.1',
  'pdw-cv': '0.133-0.185',
  pdwcv: '0.133-0.185',
  'pdw-sd': '',
  pdwsd: '',
  pct: '0.40-0.85',
  'p-lcc': '45-170',
  plcc: '45-170',
  'p-lcr': '0.200-0.600',
  plcr: '0.200-0.600',
};

const normalizeAnalyteName = (value: string) => value.toLowerCase().replace(/[^a-z0-9#%]+/g, '');

export function cbcReferenceRangeFor(name: string): string {
  return CBC_REFERENCE_RANGES[normalizeAnalyteName(name)] || '';
}

export const BIO_DEFAULT_UNITS: Record<string, string> = {
  // Kidney Profile
  urea: 'mg/dL',
  creatinine: 'mg/dL',
  uricacid: 'mg/dL',
  uc: '',
  ucratio: '',
  ck: 'U/L',
  ckmb: 'U/L',
  creatinekinasemb: 'U/L',
  creatinekinasembckmb: 'U/L',
  egfrcr: '',

  // Liver Profile
  totalprotein: 'g/dL',
  albumin: 'g/dL',
  globulin: 'g/L',
  ag: '',
  agratio: '',
  totalbilirubin: 'mg/dL',
  directbilirubin: 'mg/dL',
  indirectbilirubin: 'umol/L',
  gammaglutamyltranspeptidaseggt: 'U/L',
  ggt: 'U/L',
  aspartateaminotransferaseast: 'U/L',
  ast: 'U/L',
  alaninetransaminasealt: 'U/L',
  alt: 'U/L',
  alkalinephosphatase: 'U/L',
  alp: 'U/L',
  cholinesterase: 'U/L',
  che: 'U/L',
  thiobarbituricacidtba: 'umol/L',
  tba: 'umol/L',

  // Pancreatic Profile
  amylase: 'U/L',
  amy: 'U/L',

  // Lipid Profile
  totalcholesterol: 'mg/dL',
  tc: 'mg/dL',
  triglycerides: 'mg/dL',
  tg: 'mg/dL',
  hdlcholesterol: 'mg/dL',
  hdl: 'mg/dL',
  ldlcholesterol: 'mg/dL',
  ldl: 'mg/dL',
  glucose: 'mg/dL',
  glu: 'mg/dL',
};

export const BIO_FULL_NAMES: Record<string, string> = {
  totalprotein: 'Total protein',
  tp: 'Total protein',
  albumin: 'Albumin',
  alb: 'Albumin',
  globulin: 'Globulin',
  glob: 'Globulin',
  ag: 'A/G Ratio',
  agratio: 'A/G Ratio',
  totalbilirubin: 'Total bilirubin',
  tb: 'Total bilirubin',
  directbilirubin: 'Direct bilirubin',
  db: 'Direct bilirubin',
  indirectbilirubin: 'Indirect bilirubin',
  ibil: 'Indirect bilirubin',
  gammaglutamyltranspeptidaseggt: 'Gamma-glutamyl transpeptidase (GGT)',
  ggt: 'Gamma-glutamyl transpeptidase (GGT)',
  aspartateaminotransferaseast: 'Aspartate aminotransferase (AST)',
  ast: 'Aspartate aminotransferase (AST)',
  alaninetransaminasealt: 'Alanine Transaminase (ALT)',
  alt: 'Alanine Transaminase (ALT)',
  alkalinephosphatase: 'Alkaline phosphatase',
  alp: 'Alkaline phosphatase',
  cholinesterase: 'Cholinesterase',
  che: 'Cholinesterase',
  thiobarbituricacidtba: 'Thiobarbituric acid (TBA)',
  tba: 'Thiobarbituric acid (TBA)',
  amylase: 'Amylase',
  amy: 'Amylase',
  ck: 'Creatine kinase MB (CK-MB)',
  ckmb: 'Creatine kinase MB (CK-MB)',
  creatinekinasemb: 'Creatine kinase MB (CK-MB)',
  creatinekinasembckmb: 'Creatine kinase MB (CK-MB)',
  creatinine: 'Creatinine',
  crea: 'Creatinine',
  uricacid: 'Uric Acid',
  ua: 'Uric Acid',
  urea: 'Urea',
  uc: 'U/C Ratio',
  ucratio: 'U/C Ratio',
  totalcholesterol: 'Total Cholesterol',
  tc: 'Total Cholesterol',
  triglycerides: 'Triglycerides',
  tg: 'Triglycerides',
  hdlcholesterol: 'HDL Cholesterol',
  hdl: 'HDL Cholesterol',
  ldlcholesterol: 'LDL Cholesterol',
  ldl: 'LDL Cholesterol',
  glucose: 'Glucose',
  glu: 'Glucose',
  egfrcr: 'eGFRcr',
};

export function bioFullNameFor(name: string): string {
  const norm = normalizeAnalyteName(name);
  return BIO_FULL_NAMES[norm] || name;
}

export const BIO_SECTION_MAP: Record<string, string> = {
  // Kidney Profile
  urea: 'Kidney Profile',
  creatinine: 'Kidney Profile',
  crea: 'Kidney Profile',
  uricacid: 'Kidney Profile',
  ua: 'Kidney Profile',
  uc: 'Kidney Profile',
  ucratio: 'Kidney Profile',
  ck: 'Kidney Profile',
  ckmb: 'Kidney Profile',
  creatinekinasemb: 'Kidney Profile',
  creatinekinasembckmb: 'Kidney Profile',

  // Liver Profile
  totalprotein: 'Liver Profile',
  tp: 'Liver Profile',
  albumin: 'Liver Profile',
  alb: 'Liver Profile',
  globulin: 'Liver Profile',
  glob: 'Liver Profile',
  ag: 'Liver Profile',
  agratio: 'Liver Profile',
  totalbilirubin: 'Liver Profile',
  tb: 'Liver Profile',
  directbilirubin: 'Liver Profile',
  db: 'Liver Profile',
  indirectbilirubin: 'Liver Profile',
  ibil: 'Liver Profile',
  gammaglutamyltranspeptidaseggt: 'Liver Profile',
  ggt: 'Liver Profile',
  aspartateaminotransferaseast: 'Liver Profile',
  ast: 'Liver Profile',
  alaninetransaminasealt: 'Liver Profile',
  alt: 'Liver Profile',
  alkalinephosphatase: 'Liver Profile',
  alp: 'Liver Profile',
  cholinesterase: 'Liver Profile',
  che: 'Liver Profile',
  thiobarbituricacidtba: 'Liver Profile',
  tba: 'Liver Profile',
  egfrcr: 'Liver Profile',

  // Pancreatic Profile
  amylase: 'Pancreatic Profile',
  amy: 'Pancreatic Profile',

  // Lipid Profile
  totalcholesterol: 'Lipid Profile',
  tc: 'Lipid Profile',
  triglycerides: 'Lipid Profile',
  tg: 'Lipid Profile',
  hdlcholesterol: 'Lipid Profile',
  hdl: 'Lipid Profile',
  ldlcholesterol: 'Lipid Profile',
  ldl: 'Lipid Profile',
  glucose: 'Lipid Profile',
  glu: 'Lipid Profile',
};

export function bioDefaultSectionFor(name: string): string {
  const norm = normalizeAnalyteName(name);
  return BIO_SECTION_MAP[norm] || '';
}

export function bioDefaultUnitFor(name: string): string {
  const norm = normalizeAnalyteName(name);
  return BIO_DEFAULT_UNITS[norm] || '';
}

export function computeRemark(result?: string, referenceRange?: string, fallback = ''): string {
  if (!referenceRange || !result) return (fallback || '').trim();
  const normalizedRange = normalizeReferenceRange(referenceRange);
  const bounds = parseReferenceBounds(normalizedRange);
  if (!bounds) return (fallback || '').trim();

  const raw = result.trim();
  const less = raw.match(/^<\s*(-?\d+(?:\.\d+)?)/);
  if (less) {
    const v = Number(less[1]);
    if (v <= bounds.low) return 'L';
    if (v > bounds.high) return 'H';
    return '';
  }
  const greater = raw.match(/^>\s*(-?\d+(?:\.\d+)?)/);
  if (greater) {
    const v = Number(greater[1]);
    if (v >= bounds.high) return 'H';
    if (v < bounds.low) return 'L';
    return '';
  }

  const numMatch = raw.match(/-?\d+(?:\.\d+)?/);
  if (!numMatch) return (fallback || '').trim();
  const val = Number(numMatch[0]);
  if (Number.isNaN(val)) return (fallback || '').trim();

  if (val > bounds.high) return 'H';
  if (val < bounds.low) return 'L';
  if ((val <= bounds.low || val >= bounds.high) && (fallback === 'H' || fallback === 'L')) {
    return fallback;
  }
  return '';
}

export function applyCbcReferenceRanges(rows: ReportAnalyte[]): ReportAnalyte[] {
  return rows.map((row) => {
    const range = row.referenceRange || cbcReferenceRangeFor(row.name);
    const remark = computeRemark(row.result, range, row.remarks);
    return { ...row, referenceRange: range, remarks: remark };
  });
}

export function applyBioDefaults(rows: ReportAnalyte[]): ReportAnalyte[] {
  return rows.map((row) => {
    const fullName = bioFullNameFor(row.name);
    const unit = row.unit || bioDefaultUnitFor(fullName) || bioDefaultUnitFor(row.name);
    const mappedSection = bioDefaultSectionFor(fullName) || bioDefaultSectionFor(row.name);
    const section =
      row.section && row.section !== 'Other' && row.section !== 'BIO'
        ? row.section
        : (mappedSection || row.section || 'General Profile');
    const remark = computeRemark(row.result, row.referenceRange, row.remarks);
    return { ...row, name: fullName, section, unit, remarks: remark };
  });
}

function repairOcrNumber(value: string): string {
  return clean(value).replace(/[£€]1/gi, '55').replace(/[oO](?=\d)/g, '0');
}

export function normalizeReferenceRange(value: string): string {
  const normalized = clean(value).replace(',', '.').replace('–', '-');
  if (/^\d{3}$/.test(normalized)) return `${normalized[0]}-${normalized.slice(1)}`;
  if (/^\d{4}$/.test(normalized)) return `0.${normalized[1]}-${normalized[2]}.${normalized[3]}`;
  if (/^\d{5}$/.test(normalized)) return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
  const splitLow = normalized.match(/^(\d{3})-(\d+(?:\.\d+)?)$/);
  if (splitLow && Number(splitLow[1]) > Number(splitLow[2])) return `${splitLow[1][0]}${splitLow[1][1]}.${splitLow[1][2]}-${splitLow[2]}`;
  const decimalPair = normalized.match(/^(\d{2})-(\d{2})$/);
  if (decimalPair) return `${decimalPair[1][0]}.${decimalPair[1][1]}-${decimalPair[2][0]}.${decimalPair[2][1]}`;
  const dashed = normalized.match(/^(\d{2})-(\d)$/);
  if (dashed) return `${dashed[1][0]}.${dashed[1][1]}-${dashed[2]}`;
  const zeroDashed = normalized.match(/^0{2}-(0?\d)$/);
  if (zeroDashed) return `0.0-0.${zeroDashed[1].replace(/^0/, '')}`;
  const dotlessPair = normalized.match(/^(\d+\.\d+)\.?(\d+\.\d+)$/);
  if (dotlessPair) return `${dotlessPair[1]}-${dotlessPair[2]}`;
  const missingDash = normalized.match(/^(\d+\.\d{2})(\d)(\d{2})$/);
  if (missingDash) return `${missingDash[1]}-${missingDash[2]}.${missingDash[3]}`;
  return normalized;
}

export function parseReferenceBounds(referenceRange: string): { low: number; high: number } | null {
  const match = referenceRange.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const low = Number(match[1]);
  const high = Number(match[2]);
  return low <= high ? { low, high } : null;
}

export function normalizeResultValue(result: string, referenceRange: string): string {
  const normalized = repairOcrNumber(result).replace(',', '.');
  if (normalized.includes('.') || !/^\d+$/.test(normalized)) return normalized;
  const bounds = parseReferenceBounds(referenceRange);
  if (!bounds) return normalized;
  const numeric = Number(normalized);
  if (normalized.length === 2 && (bounds.high <= 10 || (numeric > bounds.high && bounds.high < 50))) {
    return normalized.startsWith('0') ? `0.${normalized[1]}` : `${normalized[0]}.${normalized[1]}`;
  }
  if (normalized.length === 3 && numeric > bounds.high && bounds.high <= 100) {
    const candidates = [`${normalized[0]}.${normalized.slice(1)}`, `${normalized.slice(0, 2)}.${normalized[2]}`];
    const inRange = candidates.find((candidate) => Number(candidate) >= bounds.low && Number(candidate) <= bounds.high);
    return inRange || candidates[0];
  }
  return normalized;
}

export function resultInRange(result: string, referenceRange: string): boolean | null {
  const value = Number.parseFloat(normalizeResultValue(result, referenceRange));
  const bounds = parseReferenceBounds(referenceRange);
  if (!Number.isFinite(value) || !bounds) return null;
  return value >= bounds.low && value <= bounds.high;
}

export function formatPetAge(birthDate: string, onDate = new Date()): string {
  if (!birthDate) return '';
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > onDate) return '';
  let years = onDate.getFullYear() - birth.getFullYear();
  let months = onDate.getMonth() - birth.getMonth();
  if (onDate.getDate() < birth.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years > 0) return `${years} year${years === 1 ? '' : 's'}${months ? ` ${months} month${months === 1 ? '' : 's'}` : ''}`;
  return `${Math.max(months, 0)} month${months === 1 ? '' : 's'}`;
}
