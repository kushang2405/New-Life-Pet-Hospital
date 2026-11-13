'use client';

import { useState, useEffect } from 'react';
import {
  Users, Plus, Mail, Phone, Edit2, Trash2, Lock, Ban, CheckCircle2,
  Clock, DollarSign,
} from 'lucide-react';
import Shell from '../components/Shell';
import { Card, Badge, Button, EmptyState, Modal, Field, Input, Select, StatCard } from '../components/ui';
import { useDB, Staff, newId } from '../lib/store';
import { useAuth, updateStaffStatus, setStaffPassword } from '../lib/auth';
import { useSettings } from '../lib/settings';
import { staffRoleOptions, allRoles } from '../lib/platform';

const statuses: Staff['status'][] = ['Active', 'On leave', 'Inactive', 'Suspended'];

export default function StaffPage() {
  const { user } = useAuth();
  const { db, create, update, remove, refresh } = useDB();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    name: '',
    role: staffRoleOptions[0],
    phone: '',
    email: '',
    password: '',
    shift: 'Mon–Fri 09:00–17:00',
    status: 'Active' as Staff['status'],
  });

  useEffect(() => { refresh(); }, [refresh]);

  if (!db) return <Shell module="staff" title="Staff"><div className="text-sm text-ink/50">Loading...</div></Shell>;

  const isSuperAdmin = user?.role === 'Super Admin';
  const fmtMoney = (n: number) => `${settings.currencySymbol}${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditStaff(null);
    setFormError('');
    setForm({
      name: '', role: staffRoleOptions[0],
      phone: '', email: '', password: '', shift: 'Mon–Fri 09:00–17:00',
      status: 'Active',
    });
    setOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditStaff(s);
    setFormError('');
    setForm({
      name: s.name, role: s.role as typeof staffRoleOptions[number],
      phone: s.phone, email: s.email, password: '',
      shift: s.shift, status: s.status,
    });
    setOpen(true);
  };

  const saveStaff = async () => {
    if (!form.name) return;
    if (!editStaff && form.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    const { password, ...fields } = form;
    const payload = {
      ...fields,
      branch: editStaff?.branch || 'Main',
      branchAccess: editStaff?.branchAccess || ['Main'],
      hireDate: editStaff?.hireDate || '',
      department: editStaff?.department || '',
      employmentType: editStaff?.employmentType || 'Full-time',
      baseSalary: editStaff?.baseSalary || 0,
      allowances: editStaff?.allowances || 0,
      bankAccount: editStaff?.bankAccount || '',
      emergencyContactName: editStaff?.emergencyContactName || '',
      emergencyContactPhone: editStaff?.emergencyContactPhone || '',
      address: editStaff?.address || '',
      dateOfBirth: editStaff?.dateOfBirth || '',
      gender: editStaff?.gender || '' as Staff['gender'],
      nationalId: editStaff?.nationalId || '',
      leaveBalance: editStaff?.leaveBalance || { annual: 0, sick: 0, personal: 0 },
      shiftSchedule: editStaff?.shiftSchedule || [],
      attendance: editStaff?.attendance || [],
      leaveRequests: editStaff?.leaveRequests || [],
      payroll: editStaff?.payroll || [],
      performanceReviews: editStaff?.performanceReviews || [],
      documents: editStaff?.documents || [],
      bonuses: editStaff?.bonuses || [],
      activityLog: editStaff?.activityLog || [],
    };
    if (editStaff) {
      update('staff', editStaff.id, payload);
    } else {
      const id = newId('stf');
      try {
        const created = await create('staff', { id, ...payload } as Staff);
        await setStaffPassword(created.id, password);
      } catch (err) {
        setFormError((err as Error).message);
        return;
      }
    }
    setOpen(false);
    setEditStaff(null);
  };

  const changeStatus = async (s: Staff, newStatus: Staff['status']) => {
    try {
      await updateStaffStatus(s.id, newStatus);
      update('staff', s.id, { status: newStatus });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const deleteStaff = (id: string) => remove('staff', id);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'Active': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'Suspended': return <Ban className="w-3.5 h-3.5" />;
      case 'Inactive': return <Lock className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const activeCount = db.staff.filter((s) => s.status === 'Active').length;
  const onLeaveCount = db.staff.filter((s) => s.status === 'On leave').length;
  const totalPayroll = db.staff.reduce((sum, s) => {
    const latest = s.payroll?.[s.payroll.length - 1];
    return sum + (latest?.netPay || 0);
  }, 0);

  return (
    <Shell title="Staff & HR" subtitle="Team management">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon={Users} label="Total staff" value={String(db.staff.length)} tone="plum" />
        <StatCard icon={CheckCircle2} label="Active" value={String(activeCount)} tone="plum" />
        <StatCard icon={Clock} label="On leave" value={String(onLeaveCount)} tone="amber" />
        <StatCard icon={DollarSign} label="Monthly payroll" value={fmtMoney(totalPayroll)} tone="coral" />
      </div>

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-ink/60">{db.staff.length} staff members</p>
        {isSuperAdmin && <Button onClick={openNew}><Plus className="w-4 h-4" /> Add staff</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {db.staff.map((s) => {
          const canEditThis = isSuperAdmin;
          return (
            <Card key={s.id} className="p-4 group">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-coral/15 text-coral flex items-center justify-center text-sm font-semibold shrink-0">
                  {s.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-ink truncate">{s.name}</div>
                    <div className="flex items-center gap-1 transition-opacity">
                      {canEditThis && (
                        <button onClick={() => openEdit(s)} className="w-7 h-7 rounded-lg hover:bg-canvas text-ink/40 hover:text-ink flex items-center justify-center transition-colors">
                          <Edit2 className="w-5 h-5" />
                        </button>
                      )}
                      {isSuperAdmin && s.role !== 'Super Admin' && (
                        <button onClick={() => deleteStaff(s.id)} className="w-7 h-7 rounded-lg hover:bg-coral/10 text-ink/40 hover:text-coral flex items-center justify-center transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-ink/50">{s.role}</span>
                  </div>
                  <div className="mt-1.5"><Badge status={s.status} /></div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-line text-[11px] text-ink/60 space-y-1">
                <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {s.phone || '—'}</div>
                <div className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3" /> {s.email || '—'}</div>
                <div className="text-ink/40 pt-0.5">Shift: {s.shift || '—'}</div>
                {s.hireDate && <div className="text-ink/40">Hired: {s.hireDate}</div>}
                {s.department && <div className="text-ink/40">Dept: {s.department}</div>}
              </div>
              {canEditThis && s.role !== 'Super Admin' && (
                <div className="mt-3 pt-3 border-t border-line flex gap-1.5">
                  {statuses.map((st) => (
                    <button
                      key={st}
                      onClick={() => changeStatus(s, st)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                        s.status === st ? 'bg-lilac text-plum ring-1 ring-plum/20' : 'text-ink/50 hover:bg-canvas'
                      }`}
                    >
                      {statusIcon(st)}
                      {st}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {db.staff.length === 0 && <Card><EmptyState icon={Users} title="No staff yet" /></Card>}

      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditStaff(null); }}
        title={editStaff ? 'Edit staff member' : 'Add staff member'}
      >
        <div className="space-y-3">
          <Field label="Full name">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Dr. Maya Rivera" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
                {(isSuperAdmin ? allRoles : staffRoleOptions).map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Phone">
              <Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+1 415 555 0200" />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@newlifepet.com" />
            </Field>
            {!editStaff && (
              <Field label="Password">
                <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 6 characters" />
              </Field>
            )}
            <Field label="Status">
              <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                {statuses.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Shift">
              <Input value={form.shift} onChange={(e) => set('shift', e.target.value)} placeholder="Mon–Fri 09:00–17:00" />
            </Field>
          </div>
          {formError && <p className="text-xs text-coral">{formError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => { setOpen(false); setEditStaff(null); }}>Cancel</Button>
            <Button onClick={saveStaff}>{editStaff ? 'Save changes' : 'Add'}</Button>
          </div>
        </div>
      </Modal>
    </Shell>
  );
}
