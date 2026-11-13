'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PawPrint, AlertTriangle, TrendingUp, Users, Hotel } from 'lucide-react';
import Shell from './components/Shell';
import { StatCard } from './components/ui';
import { BIDashboardGrid } from './components/dashboard-widgets';
import { useDB, today } from './lib/store';
import { useAuth } from './lib/auth';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const formatDate = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const sumItems = (items: { qty: number; unitPrice: number }[]) =>
  items.reduce((s, it) => s + it.qty * it.unitPrice, 0);

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { db } = useDB();
  const t = today();

  const isStaff = user?.role === 'Staff';

  useEffect(() => {
    if (isStaff) router.replace('/attendance');
  }, [isStaff, router]);

  const stats = useMemo(() => {
    if (!db) return null;
    const todays = db.appointments.filter((a) => a.date === t).sort((a, b) => a.time.localeCompare(b.time));
    const paid = db.invoices.filter((i) => i.status === 'Paid');
    const open = db.invoices.filter((i) => i.status === 'Pending' || i.status === 'Overdue');
    return {
      todays,
      revenue: paid.reduce((s, i) => s + sumItems(i.items), 0),
      pendingRev: open.reduce((s, i) => s + sumItems(i.items), 0),
      lowStock: db.medStock.filter((m) => m.stock <= m.reorderLevel),
      pets: db.pets.length,
      owners: db.owners.length,
      boarding: db.boarding.filter((b) => b.status === 'Checked-in').length,
      staff: db.staff.length,
      activeStaff: db.staff.filter((s) => s.status === 'Active').length,
    };
  }, [db, t]);

  if (loading || !db || !stats || isStaff) {
    return (
      <Shell title="Dashboard">
        <div className="text-sm text-ink/50">Loading clinic data…</div>
      </Shell>
    );
  }

  if (!user) return null;

  const petName = (id: string) => db.pets.find((p) => p.id === id)?.name ?? 'Unknown';
  const ownerName = (id: string) => db.owners.find((o) => o.id === id)?.name ?? 'Unknown';

  return (
    <Shell title="System Overview" subtitle="Full clinic overview">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-ink">{greeting()}, {user.name.split(' ')[0]}</h2>
        <p className="text-sm text-ink/50">{formatDate()}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Staff" value={stats.staff} sub={`${stats.activeStaff} active`} tone="sky" />
        <StatCard icon={PawPrint} label="Patients" value={stats.pets} sub={`${stats.owners} owners`} tone="amber" />
        <StatCard icon={TrendingUp} label="Revenue (paid)" value={stats.revenue.toLocaleString()} sub={`${stats.pendingRev.toLocaleString()} pending`} tone="coral" />
        <StatCard icon={AlertTriangle} label="Low stock" value={stats.lowStock.length} sub="Items" tone="coral" />
        <StatCard icon={Hotel} label="Boarding" value={stats.boarding} sub="In house" tone="plum" />
      </div>
      <BIDashboardGrid db={db} todays={stats.todays} petName={petName} ownerName={ownerName} />
    </Shell>
  );
}
