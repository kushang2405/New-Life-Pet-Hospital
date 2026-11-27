'use client';

/* ════════════════════════════════════════════════════════════════════
   Shared helpers
   ────────────────────────────────────────────────────────────────────
   These exist because the same handful of bugs were repeated across
   many pages: UTC date drift, document numbers that collide after a
   delete, invoice totals recomputed from line items (so tax, discounts,
   coupons and payments were ignored), unguarded number parsing, and
   deletes with no confirmation.
   ════════════════════════════════════════════════════════════════════ */

import type { Invoice, Segment, SegmentRule, Owner, Pet, Appointment } from './api';

/* ──────────────────────────────────────────────────────────────
   Dates — always local, never UTC
   ────────────────────────────────────────────────────────────── */

/**
 * `YYYY-MM-DD` for a date in the **local** timezone.
 *
 * `new Date().toISOString().slice(0,10)` is wrong east of UTC in the early
 * hours and west of UTC in the evening — it was shifting "today" by a day
 * and making today unselectable in date pickers.
 */
export function localDateISO(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Local `HH:MM` for a date. */
export function localTimeHHMM(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Next 15-minute slot from now in local time, formatted as HH:MM. */
export function nextQuarterHourHHMM(d: Date = new Date()): string {
  const currentMinutes = d.getMinutes();
  const roundedMinutes = Math.ceil((currentMinutes + 1) / 15) * 15;
  const copy = new Date(d);
  copy.setMinutes(roundedMinutes, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(copy.getHours())}:${p(copy.getMinutes())}`;
}

/** Parse `YYYY-MM-DD` as a local date (never UTC). Returns null if malformed. */
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole days from `a` to `b` (negative if `b` is before `a`). */
export function daysBetween(a: string, b: string): number | null {
  const da = parseISODate(a);
  const dbb = parseISODate(b);
  if (!da || !dbb) return null;
  return Math.round((dbb.getTime() - da.getTime()) / 86_400_000);
}

/** Add days to an ISO date, returning an ISO date. */
export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return localDateISO(d);
}

/** Nights between check-in and check-out, minimum 1. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const n = daysBetween(checkIn, checkOut);
  return n === null || n < 1 ? 1 : n;
}

/** Day-of-week, 0 = Sunday. Null when the date is malformed. */
export function weekdayOf(iso: string): number | null {
  return parseISODate(iso)?.getDay() ?? null;
}

/* ──────────────────────────────────────────────────────────────
   Numbers
   ────────────────────────────────────────────────────────────── */

/** Parse to a finite number, falling back to `fallback` for '' / NaN / Infinity. */
export function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

/** Parse to a finite number that is at least `min`. */
export function numMin(value: unknown, min = 0, fallback = min): number {
  return Math.max(min, num(value, fallback));
}

/** Round to 2 decimal places, avoiding float dust like 0.30000000000000004. */
export function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/** Treat sub-cent differences as zero — float equality on money is a bug. */
export function isZeroMoney(n: number): boolean {
  return Math.abs(n) < 0.005;
}

/* ──────────────────────────────────────────────────────────────
   Document numbers
   ────────────────────────────────────────────────────────────── */

/**
 * Next document number for a prefix, derived from the **highest existing
 * suffix** rather than `list.length`.
 *
 * Using the length means deleting a record and creating another reissues a
 * number that is already in the books.
 */
export function nextDocNumber(
  prefix: string,
  existing: { number?: string }[] | string[],
  startAt = 1,
  pad = 0,
): string {
  let max = startAt - 1;
  for (const entry of existing) {
    const raw = typeof entry === 'string' ? entry : entry.number ?? '';
    if (!raw.startsWith(prefix)) continue;
    const suffix = raw.slice(prefix.length).replace(/^[-/]/, '');
    const n = parseInt(suffix, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  const next = max + 1;
  return `${prefix}${pad > 0 ? String(next).padStart(pad, '0') : next}`;
}

import { confirmModal, alertModal } from '../components/confirm-dialog';

/* ──────────────────────────────────────────────────────────────
   Confirmation & alert modals (replaces native window.confirm/alert)
   ────────────────────────────────────────────────────────────── */

/**
 * Confirm a destructive action with a top-center modal. Returns true when the user agreed.
 * Use as an early guard: `if (!await confirmDelete('invoice INV-1045')) return;`
 */
export async function confirmDelete(what: string, extra?: string): Promise<boolean> {
  const detail = extra ? `\n\n${extra}` : '';
  const firstWord = what.trim().split(' ')[0] || '';
  const title = `Delete ${firstWord.charAt(0).toUpperCase() + firstWord.slice(1)}?`;
  return confirmModal({
    title,
    message: `Are you sure you want to delete ${what}?${detail}\n\nThis cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    variant: 'danger',
  });
}

/** Confirm any action that is hard to reverse. */
export async function confirmAction(message: string, title: string = 'Confirm Action'): Promise<boolean> {
  return confirmModal({
    title,
    message,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'primary',
  });
}

/** Show a notice/alert modal instead of native window.alert. */
export async function showAlert(message: string, title: string = 'Notice'): Promise<void> {
  return alertModal({
    title,
    message,
    buttonText: 'OK',
  });
}

/* ──────────────────────────────────────────────────────────────
   Validation
   ────────────────────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test((value || '').trim());
}

/** At least 7 digits, ignoring spaces, dashes, brackets and a leading +. */
export function isPhone(value: string): boolean {
  return (value || '').replace(/[^\d]/g, '').length >= 7;
}

export function isNonEmpty(value: string): boolean {
  return (value || '').trim().length > 0;
}

/* ──────────────────────────────────────────────────────────────
   Invoice money — one correct implementation
   ────────────────────────────────────────────────────────────── */

export type InvoiceTotals = {
  itemsSubtotal: number;
  consultantCharge: number;
  fileCharge: number;
  dripperCharge: number;
  injectionCharge: number;
  surgeryCharge: number;
  subtotal: number;
  itemDiscount: number;
  invoiceDiscount: number;
  couponTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balance: number;
  isSettled: boolean;
};

/**
 * Authoritative totals for an invoice.
 *
 * Several pages recomputed this as `Σ qty × unitPrice`, which silently drops
 * per-item discounts, the invoice-level discount, coupons, tax and every
 * payment already recorded — so Billing, Analytics, the dashboard and the
 * owner portal each showed a different number for the same invoice.
 *
 * Stored `subtotal`/`taxTotal`/`total` are trusted when present (the server
 * is the source of truth); everything else is derived consistently.
 */
export function invoiceTotals(inv: Invoice): InvoiceTotals {
  const items = inv.items ?? [];

  const itemsSubtotal = round2(
    items.reduce((s, it) => s + num(it.qty) * num(it.unitPrice), 0),
  );
  const consultantCharge = round2(num(inv.consultantCharge));
  const fileCharge = round2(num(inv.fileCharge));
  const dripperCharge = round2(num(inv.dripperCharge));
  const injectionCharge = round2(num(inv.injectionCharge));
  const surgeryCharge = round2(num(inv.surgeryCharge));
  const subtotal = round2(itemsSubtotal + consultantCharge + fileCharge + dripperCharge + injectionCharge + surgeryCharge);

  const itemDiscount = round2(
    items.reduce(
      (s, it) => s + num(it.qty) * num(it.unitPrice) * (num(it.discount) / 100),
      0,
    ),
  );

  const afterItemDiscount = round2(subtotal - itemDiscount);

  const invoiceDiscount = round2(
    inv.discountType === 'Percent'
      ? afterItemDiscount * (num(inv.discount) / 100)
      : num(inv.discount),
  );

  const couponTotal = round2(
    (inv.coupon ?? []).reduce((s, c) => s + num(c.amount), 0),
  );

  const afterDiscounts = Math.max(0, round2(afterItemDiscount - invoiceDiscount - couponTotal));

  // Prefer explicit tax lines, then the stored scalar, then per-item rates.
  // Never invent a rate: a genuinely zero-tax invoice must stay zero.
  let taxTotal: number;
  if (inv.taxes?.length) {
    taxTotal = round2(inv.taxes.reduce((s, t) => s + num(t.amount), 0));
  } else if (typeof inv.taxTotal === 'number') {
    taxTotal = round2(inv.taxTotal);
  } else {
    const ratio = afterItemDiscount > 0 ? afterDiscounts / afterItemDiscount : 0;
    taxTotal = round2(
      items.reduce((s, it) => {
        if (!it.taxable) return s;
        const net = num(it.qty) * num(it.unitPrice) * (1 - num(it.discount) / 100);
        return s + net * (num(it.taxRate) / 100);
      }, 0) * ratio,
    );
  }

  const total = round2(
    typeof inv.total === 'number' && inv.total > 0 ? inv.total : afterDiscounts + taxTotal,
  );

  const amountPaid = round2(
    typeof inv.amountPaid === 'number'
      ? inv.amountPaid
      : (inv.payments ?? []).reduce((s, p) => s + num(p.amount), 0),
  );

  const balance = Math.max(0, round2(total - amountPaid));

  return {
    itemsSubtotal,
    consultantCharge,
    fileCharge,
    dripperCharge,
    injectionCharge,
    surgeryCharge,
    subtotal,
    itemDiscount,
    invoiceDiscount,
    couponTotal,
    taxTotal,
    total,
    amountPaid,
    balance,
    isSettled: isZeroMoney(balance),
  };
}

/** Does this document represent recognised revenue? */
export function countsAsRevenue(inv: Invoice): boolean {
  if (inv.docType && inv.docType !== 'Invoice') return false;
  return inv.status !== 'Draft' && inv.status !== 'Cancelled';
}

/** Status implied by a balance, preserving Draft/Cancelled. */
export function statusForBalance(
  inv: Pick<Invoice, 'status'>,
  total: number,
  amountPaid: number,
): Invoice['status'] {
  if (inv.status === 'Draft' || inv.status === 'Cancelled' || inv.status === 'Refunded') {
    return inv.status;
  }
  const balance = round2(total - amountPaid);
  if (isZeroMoney(balance) || balance < 0) return 'Paid';
  if (amountPaid > 0) return 'Partial';
  return inv.status === 'Overdue' ? 'Overdue' : 'Pending';
}

/* ──────────────────────────────────────────────────────────────
   Segment rules — evaluated, not pattern-matched on the name
   ────────────────────────────────────────────────────────────── */

export type SegmentContext = {
  owner: Owner;
  pets: Pet[];
  invoices: Invoice[];
  appointments: Appointment[];
  today: string;
};

function ruleValue(field: SegmentRule['field'], ctx: SegmentContext): number | string | null {
  switch (field) {
    case 'loyaltyPoints':
      return num(ctx.owner.loyaltyPoints);
    case 'totalSpent':
      return round2(ctx.invoices.reduce((s, i) => s + invoiceTotals(i).amountPaid, 0));
    case 'visitCount':
      return ctx.appointments.filter((a) => a.status === 'Completed').length;
    case 'daysSinceLastVisit': {
      const dates = ctx.appointments
        .filter((a) => a.status === 'Completed')
        .map((a) => a.date)
        .sort();
      const last = dates[dates.length - 1];
      if (!last) return null;
      return daysBetween(last, ctx.today) ?? null;
    }
    case 'petAgeYears': {
      const ages = ctx.pets
        .map((p) => (p.birthDate ? daysBetween(p.birthDate, ctx.today) : null))
        .filter((d): d is number => d !== null)
        .map((d) => d / 365.25);
      return ages.length ? Math.max(...ages) : null;
    }
    case 'petSpecies':
      return ctx.pets.map((p) => p.species).join(',').toLowerCase();
    case 'vaccinationDue':
      return 0;
    default:
      return null;
  }
}

function compare(actual: number | string | null, op: SegmentRule['op'], expected: string): boolean {
  if (actual === null) return false;
  if (typeof actual === 'string') {
    const a = actual.toLowerCase();
    const b = expected.trim().toLowerCase();
    if (op === 'eq') return a.includes(b);
    if (op === 'neq') return !a.includes(b);
    return false;
  }
  const b = num(expected, NaN);
  if (!Number.isFinite(b)) return false;
  switch (op) {
    case 'gt': return actual > b;
    case 'gte': return actual >= b;
    case 'lt': return actual < b;
    case 'lte': return actual <= b;
    case 'eq': return Math.abs(actual - b) < 0.0001;
    case 'neq': return Math.abs(actual - b) >= 0.0001;
    default: return false;
  }
}

/** Does this owner satisfy the segment's rules? */
export function ownerMatchesSegment(seg: Segment, ctx: SegmentContext): boolean {
  const rules = seg.rules ?? [];
  if (rules.length === 0) return false;
  const results = rules.map((r) => compare(ruleValue(r.field, ctx), r.op, r.value));
  return seg.match === 'any' ? results.some(Boolean) : results.every(Boolean);
}

export const SEGMENT_FIELD_LABELS: Record<SegmentRule['field'], string> = {
  loyaltyPoints: 'Loyalty points',
  totalSpent: 'Total spent',
  visitCount: 'Completed visits',
  daysSinceLastVisit: 'Days since last visit',
  petAgeYears: 'Oldest pet age (years)',
  petSpecies: 'Pet species',
  vaccinationDue: 'Vaccination due',
};

export const SEGMENT_OP_LABELS: Record<SegmentRule['op'], string> = {
  gt: 'is greater than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  eq: 'equals',
  neq: 'does not equal',
};

/* ──────────────────────────────────────────────────────────────
   Export
   ────────────────────────────────────────────────────────────── */

/** Trigger a client-side file download. Used by the Export buttons. */
export function downloadFile(filename: string, content: string, mime = 'application/json') {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJSON(filename: string, data: unknown) {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json');
}

/** Export rows to CSV, quoting correctly. */
export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    downloadFile(filename, '', 'text/csv');
    return;
  }
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(',')),
  ].join('\n');
  downloadFile(filename, csv, 'text/csv');
}

/** Escape a string for safe interpolation into printed HTML documents. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
