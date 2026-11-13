import type { ReportAnalyte } from './report-types';

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

const CBC_REFERENCE_RANGES: Record<string, string> = {
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

const normalizeAnalyteName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

export function cbcReferenceRangeFor(name: string): string {
  return CBC_REFERENCE_RANGES[normalizeAnalyteName(name)] || '';
}

export function applyCbcReferenceRanges(rows: ReportAnalyte[]): ReportAnalyte[] {
  return rows.map((row) => ({ ...row, referenceRange: row.referenceRange || cbcReferenceRangeFor(row.name) }));
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
