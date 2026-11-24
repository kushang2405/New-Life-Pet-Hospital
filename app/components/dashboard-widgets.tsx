'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Clock, Pill, DollarSign, TrendingUp, Receipt, ArrowRight } from 'lucide-react';
import { Card, SectionTitle, Badge, AreaChartCard } from './ui';
import type { DB } from '../lib/store';
import { useSettings } from '../lib/settings';

type Props = { db: DB; todays: any[]; petName: (id: string) => string; ownerName: (id: string) => string };

const invTotal = (i: any) => i.items.reduce((s: number, it: any) => s + it.qty * it.unitPrice, 0);

export function computeBI(db: DB, todays: any[]) {
  const t = new Date().toISOString().slice(0, 10);
  const lowStock = db.medStock.filter((m) => m.stock <= m.reorderLevel);
  const revenue = db.invoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + invTotal(i), 0);
  const dailyIncome = db.invoices.filter((i) => i.status === 'Paid' && i.date === t).reduce((s, i) => s + invTotal(i), 0);
  const monthlyIncome = db.invoices.filter((i) => {
    if (i.status !== 'Paid') return false;
    const d = new Date(i.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, i) => s + invTotal(i), 0);
  const outstanding = db.invoices.filter((i) => i.status === 'Pending' || i.status === 'Overdue').reduce((s, i) => s + invTotal(i), 0);
  const overdue = db.invoices.filter((i) => i.status === 'Overdue');
  const pending = db.invoices.filter((i) => i.status === 'Pending');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyRevenue = months.map((m, i) => {
    const rev = db.invoices.filter((inv) => inv.status === 'Paid' && new Date(inv.date).getMonth() === i)
      .reduce((s, inv) => s + invTotal(inv), 0);
    return { month: m, revenue: rev };
  });
  return { lowStock, revenue, dailyIncome, monthlyIncome, outstanding, overdue, pending, monthlyRevenue };
}

export function TodayAppointmentsWidget({ todays, petName, ownerName }: Props) {
  return (
    <Card className="p-5 flex flex-col justify-between">
      <div>
        <SectionTitle
          title="Today's appointments"
          action={
            <div className="flex items-center gap-2">
              {todays.length > 0 && <span className="text-[11px] text-ink/40">{todays.length} total</span>}
              <Link href="/appointments" className="text-xs text-plum font-medium flex items-center gap-1 hover:underline">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          }
        />
        <div className="space-y-2">
          {todays.slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-canvas transition-colors">
              <span className="text-sm font-semibold text-ink w-14 shrink-0">{a.time}</span>
              <div className="w-px h-10 bg-line" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">{petName(a.petId)} · {a.service}</div>
                <div className="text-[11px] text-ink/50 truncate">{ownerName(a.ownerId)} · {a.vet}</div>
              </div>
              <Badge status={a.status} />
            </div>
          ))}
          {todays.length === 0 && <div className="text-center py-6 text-sm text-ink/50">No appointments today.</div>}
        </div>
      </div>
    </Card>
  );
}

export function WaitingQueueWidget({ todays, petName }: { todays: any[]; petName: (id: string) => string }) {
  const waiting = todays.filter((a) => a.status === 'Scheduled');
  return (
    <Card className="p-5 flex flex-col justify-between">
      <div>
        <SectionTitle
          title="Waiting queue"
          action={
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-ink/40">{waiting.length} waiting</span>
              <Link href="/appointments" className="text-xs text-plum font-medium flex items-center gap-1 hover:underline">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          }
        />
        <div className="space-y-2">
          {waiting.slice(0, 5).map((a, i) => (
            <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-canvas">
              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">{petName(a.petId)} · {a.service}</div>
                <div className="text-[11px] text-ink/50">{a.time} · {a.vet}</div>
              </div>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
          ))}
          {waiting.length === 0 && <div className="text-center py-6 text-sm text-ink/50">Queue is empty.</div>}
        </div>
      </div>
    </Card>
  );
}

export function LowStockWidget({ lowStock }: { lowStock: any[] }) {
  return (
    <Card className="p-5 flex flex-col justify-between">
      <div>
        <SectionTitle
          title="Low-stock medicines"
          action={
            <div className="flex items-center gap-2">
              {lowStock.length > 0 && <span className="text-[11px] text-coral font-medium">{lowStock.length} items</span>}
              <Link href="/pharmacy" className="text-xs text-plum font-medium flex items-center gap-1 hover:underline">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          }
        />
        <div className="space-y-2">
          {lowStock.slice(0, 5).map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-coral/20 bg-coral/5">
              <Pill className="w-4 h-4 text-coral shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">{m.name}</div>
                <div className="text-[11px] text-ink/50">{m.stock} {m.unit} left · reorder at {m.reorderLevel}</div>
              </div>
              <span className="text-sm font-semibold text-coral">{m.stock}</span>
            </div>
          ))}
          {lowStock.length === 0 && <div className="text-center py-6 text-sm text-ink/50">All items well stocked.</div>}
        </div>
      </div>
    </Card>
  );
}

export function RevenueSummaryWidget({ revenue, dailyIncome, monthlyIncome, outstanding }: { revenue: number; dailyIncome: number; monthlyIncome: number; outstanding: number }) {
  const { settings } = useSettings();
  return (
    <Card className="p-5">
      <SectionTitle title="Revenue summary" />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-lilac p-3.5">
          <DollarSign className="w-4 h-4 text-plum mb-1.5" />
          <div className="text-xl font-bold text-ink">{settings.currencySymbol}{dailyIncome.toLocaleString()}</div>
          <div className="text-[11px] text-ink/50">Daily income</div>
        </div>
        <div className="rounded-xl bg-lilac p-3.5">
          <TrendingUp className="w-4 h-4 text-plum mb-1.5" />
          <div className="text-xl font-bold text-ink">{settings.currencySymbol}{monthlyIncome.toLocaleString()}</div>
          <div className="text-[11px] text-ink/50">Monthly income</div>
        </div>
        <div className="rounded-xl bg-canvas p-3.5">
          <Receipt className="w-4 h-4 text-ink/50 mb-1.5" />
          <div className="text-xl font-bold text-ink">{settings.currencySymbol}{revenue.toLocaleString()}</div>
          <div className="text-[11px] text-ink/50">Total collected</div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3.5">
          <Clock className="w-4 h-4 text-amber-600 mb-1.5" />
          <div className="text-xl font-bold text-amber-700">{settings.currencySymbol}{outstanding.toLocaleString()}</div>
          <div className="text-[11px] text-ink/50">Outstanding</div>
        </div>
      </div>
    </Card>
  );
}

export function OutstandingInvoicesWidget({ overdue, pending, ownerName }: { overdue: any[]; pending: any[]; ownerName: (id: string) => string }) {
  const { settings } = useSettings();
  const allOutstanding = [...overdue, ...pending];
  return (
    <Card className="p-5 flex flex-col justify-between">
      <div>
        <SectionTitle
          title="Outstanding invoices"
          action={
            <div className="flex items-center gap-2">
              {allOutstanding.length > 0 && <span className="text-[11px] text-amber-700 font-medium">{allOutstanding.length} open</span>}
              <Link href="/billing" className="text-xs text-plum font-medium flex items-center gap-1 hover:underline">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          }
        />
        <div className="space-y-2">
          {allOutstanding.slice(0, 5).map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-line">
              <Receipt className="w-4 h-4 text-ink/40 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">{i.number} · {ownerName(i.ownerId)}</div>
                <div className="text-[11px] text-ink/50">{i.date}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-ink">{settings.currencySymbol}{invTotal(i).toFixed(0)}</div>
                <Badge status={i.status} />
              </div>
            </div>
          ))}
          {allOutstanding.length === 0 && <div className="text-center py-6 text-sm text-ink/50">All invoices settled.</div>}
        </div>
      </div>
    </Card>
  );
}

export function RevenueGraphWidget({ monthlyRevenue }: { monthlyRevenue: { month: string; revenue: number }[] }) {
  return <AreaChartCard title="Revenue graph (monthly)" data={monthlyRevenue} dataKey="revenue" xKey="month" color="#4C1D95" height={240} />;
}

export function BIDashboardGrid({ db, todays, petName, ownerName }: Props) {
  const bi = useMemo(() => computeBI(db, todays), [db, todays]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TodayAppointmentsWidget db={db} todays={todays} petName={petName} ownerName={ownerName} />
        <WaitingQueueWidget todays={todays} petName={petName} />
        <LowStockWidget lowStock={bi.lowStock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <RevenueSummaryWidget revenue={bi.revenue} dailyIncome={bi.dailyIncome} monthlyIncome={bi.monthlyIncome} outstanding={bi.outstanding} />
        <OutstandingInvoicesWidget overdue={bi.overdue} pending={bi.pending} ownerName={ownerName} />
        <RevenueGraphWidget monthlyRevenue={bi.monthlyRevenue} />
      </div>
    </>
  );
}
