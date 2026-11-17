'use client';

import { useState } from 'react';
import {
  CalendarCheck, Plus, CheckCircle2, XCircle, Clock, Calendar,
} from 'lucide-react';
import Shell from '../components/Shell';
import { Card, Button, EmptyState, Modal, Field, Select, Textarea, StatCard, DateInput } from '../components/ui';
import { useDB } from '../lib/store';
import { useAuth } from '../lib/auth';
import {
  applyForLeave, decideLeaveRequest, LEAVE_TYPES, localDate,
} from '../lib/attendance';
import type { Staff, LeaveRequest } from '../lib/api';

export default function LeavesPage() {
  const { user } = useAuth();
  const { db, update } = useDB();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    type: 'Annual' as (typeof LEAVE_TYPES)[number],
    startDate: localDate(),
    endDate: localDate(),
    reason: '',
  });

  if (!db) return <Shell title="Leave Requests" module="leaves"><div className="text-sm text-ink/50">Loading...</div></Shell>;

  const isSuperAdmin = user?.role === 'Super Admin';
  const myStaff = db.staff.find((s) => s.id === user?.id || s.email === user?.email) as Staff | undefined;

  const submitLeave = async () => {
    setError('');
    const today = localDate();
    if (leaveForm.startDate < today) {
      setError('Start date cannot be in the past.');
      return;
    }
    if (leaveForm.endDate < leaveForm.startDate) {
      setError('End date must be on or after the start date.');
      return;
    }
    setBusy(true);
    try {
      const updated = await applyForLeave(leaveForm);
      update('staff', updated.id, { leaveRequests: updated.leaveRequests });
      setLeaveOpen(false);
      setLeaveForm({ type: 'Annual', startDate: localDate(), endDate: localDate(), reason: '' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDecision = async (staffId: string, leaveId: string, decision: 'Approved' | 'Rejected') => {
    try {
      const updated = await decideLeaveRequest(staffId, leaveId, decision);
      update('staff', updated.id, { leaveRequests: updated.leaveRequests });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Staff view
  if (!isSuperAdmin) {
    const myLeaves = (myStaff?.leaveRequests || []).slice().reverse();
    const pending = myLeaves.filter((l) => l.status === 'Pending').length;
    const approved = myLeaves.filter((l) => l.status === 'Approved').length;
    const rejected = myLeaves.filter((l) => l.status === 'Rejected').length;

    return (
      <Shell title="Leave Requests" subtitle="Apply for leave and track your requests" module="leaves">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <StatCard icon={Clock} label="Pending" value={String(pending)} tone="amber" />
          <StatCard icon={CheckCircle2} label="Approved" value={String(approved)} tone="plum" />
          <StatCard icon={XCircle} label="Rejected" value={String(rejected)} tone="coral" />
          <StatCard icon={CalendarCheck} label="Annual balance" value={`${myStaff?.leaveBalance?.annual ?? 0}d`} tone="sky" />
        </div>

        <div className="flex justify-end mb-4">
          <Button onClick={() => setLeaveOpen(true)} icon={Plus}>Apply for Leave</Button>
        </div>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">My Leave Requests</h3>
          {myLeaves.length > 0 ? (
            <>
              {/* Mobile Cards View (< md) */}
              <div className="md:hidden space-y-3">
                {myLeaves.map((lr) => (
                  <div key={lr.id} className="p-3.5 rounded-xl border border-line bg-canvas/40 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-700 font-semibold">{lr.type}</span>
                        <span className="text-xs font-semibold text-ink">{lr.days} {lr.days === 1 ? 'day' : 'days'}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        lr.status === 'Approved' ? 'bg-lilac text-plum' :
                        lr.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                        lr.status === 'Rejected' ? 'bg-coral/10 text-coral' :
                        'bg-line text-ink/60'
                      }`}>{lr.status}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-line/60">
                      <div className="bg-white/80 p-2 rounded-lg border border-line/60">
                        <span className="text-ink/40 text-[10px] block uppercase font-medium">Start Date</span>
                        <span className="font-medium text-ink/80">{lr.startDate}</span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-line/60">
                        <span className="text-ink/40 text-[10px] block uppercase font-medium">End Date</span>
                        <span className="font-medium text-ink/80">{lr.endDate}</span>
                      </div>
                    </div>

                    {lr.reason && (
                      <div className="text-xs bg-white/70 p-2 rounded-lg border border-line/50">
                        <span className="text-ink/40 text-[10px] block uppercase font-medium mb-0.5">Reason</span>
                        <span className="text-ink/70">{lr.reason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-ink/50 uppercase tracking-wide">
                      <th className="py-2.5 px-3 font-medium">Type</th>
                      <th className="py-2.5 px-3 font-medium">Start</th>
                      <th className="py-2.5 px-3 font-medium">End</th>
                      <th className="py-2.5 px-3 font-medium">Days</th>
                      <th className="py-2.5 px-3 font-medium">Reason</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLeaves.map((lr) => (
                      <tr key={lr.id} className="border-b border-line/50 hover:bg-canvas/50 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-medium">{lr.type}</span>
                        </td>
                        <td className="py-2.5 px-3 text-ink/70">{lr.startDate}</td>
                        <td className="py-2.5 px-3 text-ink/70">{lr.endDate}</td>
                        <td className="py-2.5 px-3 text-ink/60">{lr.days}</td>
                        <td className="py-2.5 px-3 text-ink/60 max-w-[200px] truncate">{lr.reason || '—'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            lr.status === 'Approved' ? 'bg-lilac text-plum' :
                            lr.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                            lr.status === 'Rejected' ? 'bg-coral/10 text-coral' :
                            'bg-line text-ink/60'
                          }`}>{lr.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState icon={CalendarCheck} title="No leave requests yet" hint="Click 'Apply for Leave' to submit a request." />
          )}
        </Card>

        <Modal open={leaveOpen} onClose={() => { setLeaveOpen(false); setError(''); }} title="Apply for Leave">
          <div className="space-y-3">
            <Field label="Leave type">
              <Select value={leaveForm.type} onChange={(e) => setLeaveForm((f) => ({ ...f, type: e.target.value as typeof LEAVE_TYPES[number] }))}>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <DateInput value={leaveForm.startDate} onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value }))} />
              </Field>
              <Field label="End date">
                <DateInput value={leaveForm.endDate} min={leaveForm.startDate || localDate()} onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))} />
              </Field>
            </div>
            <Field label="Reason">
              <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Brief reason for your leave request" rows={3} />
            </Field>
            {error && <p className="text-xs text-coral">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => { setLeaveOpen(false); setError(''); }}>Cancel</Button>
              <Button onClick={submitLeave} disabled={busy}>{busy ? 'Submitting...' : 'Submit request'}</Button>
            </div>
          </div>
        </Modal>
      </Shell>
    );
  }

  // Super Admin view
  const allLeaves: { staff: Staff; leave: LeaveRequest }[] = [];
  db.staff.forEach((s) => {
    (s.leaveRequests || []).forEach((lr) => {
      allLeaves.push({ staff: s, leave: lr });
    });
  });
  allLeaves.sort((a, b) => {
    if (a.leave.status === 'Pending' && b.leave.status !== 'Pending') return -1;
    if (a.leave.status !== 'Pending' && b.leave.status === 'Pending') return 1;
    return b.leave.appliedDate.localeCompare(a.leave.appliedDate);
  });

  const pendingCount = allLeaves.filter((l) => l.leave.status === 'Pending').length;
  const approvedCount = allLeaves.filter((l) => l.leave.status === 'Approved').length;
  const rejectedCount = allLeaves.filter((l) => l.leave.status === 'Rejected').length;

  return (
    <Shell title="Leave Requests" subtitle="Review and approve staff leave requests" module="leaves">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <StatCard icon={Clock} label="Pending" value={String(pendingCount)} tone="amber" />
        <StatCard icon={CheckCircle2} label="Approved" value={String(approvedCount)} tone="plum" />
        <StatCard icon={XCircle} label="Rejected" value={String(rejectedCount)} tone="coral" />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-ink mb-4">All Leave Requests</h3>
        {allLeaves.length > 0 ? (
          <>
            {/* Mobile Cards View (< md) */}
            <div className="md:hidden space-y-3">
              {allLeaves.map(({ staff, leave }) => (
                <div key={leave.id} className="p-3.5 rounded-xl border border-line bg-canvas/40 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm text-ink">{staff.name}</div>
                      <div className="text-[11px] text-ink/50">{staff.role}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      leave.status === 'Approved' ? 'bg-lilac text-plum' :
                      leave.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                      leave.status === 'Rejected' ? 'bg-coral/10 text-coral' :
                      'bg-line text-ink/60'
                    }`}>{leave.status}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-700 font-semibold">{leave.type}</span>
                    <span className="text-xs font-semibold text-ink">{leave.days} {leave.days === 1 ? 'day' : 'days'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-line/60">
                    <div className="bg-white/80 p-2 rounded-lg border border-line/60">
                      <span className="text-ink/40 text-[10px] block uppercase font-medium">Start Date</span>
                      <span className="font-medium text-ink/80">{leave.startDate}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-line/60">
                      <span className="text-ink/40 text-[10px] block uppercase font-medium">End Date</span>
                      <span className="font-medium text-ink/80">{leave.endDate}</span>
                    </div>
                  </div>

                  {leave.reason && (
                    <div className="text-xs bg-white/70 p-2 rounded-lg border border-line/50">
                      <span className="text-ink/40 text-[10px] block uppercase font-medium mb-0.5">Reason</span>
                      <span className="text-ink/70">{leave.reason}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-line/60 flex items-center justify-between">
                    <span className="text-[11px] text-ink/50">
                      {leave.reviewedBy ? `Reviewed by ${leave.reviewedBy}` : 'Pending decision'}
                    </span>
                    {leave.status === 'Pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDecision(staff.id, leave.id, 'Approved')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-lilac text-plum hover:bg-plum hover:text-white transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleDecision(staff.id, leave.id, 'Rejected')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-coral/10 text-coral hover:bg-coral hover:text-white transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink/50 uppercase tracking-wide">
                    <th className="py-2.5 px-3 font-medium">Staff</th>
                    <th className="py-2.5 px-3 font-medium">Type</th>
                    <th className="py-2.5 px-3 font-medium">Start</th>
                    <th className="py-2.5 px-3 font-medium">End</th>
                    <th className="py-2.5 px-3 font-medium">Days</th>
                    <th className="py-2.5 px-3 font-medium">Reason</th>
                    <th className="py-2.5 px-3 font-medium">Status</th>
                    <th className="py-2.5 px-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allLeaves.map(({ staff, leave }) => (
                    <tr key={leave.id} className="border-b border-line/50 hover:bg-canvas/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-ink">{staff.name}</div>
                        <div className="text-[11px] text-ink/40">{staff.role}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-medium">{leave.type}</span>
                      </td>
                      <td className="py-2.5 px-3 text-ink/70">{leave.startDate}</td>
                      <td className="py-2.5 px-3 text-ink/70">{leave.endDate}</td>
                      <td className="py-2.5 px-3 text-ink/60">{leave.days}</td>
                      <td className="py-2.5 px-3 text-ink/60 max-w-[180px] truncate">{leave.reason || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          leave.status === 'Approved' ? 'bg-lilac text-plum' :
                          leave.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                          leave.status === 'Rejected' ? 'bg-coral/10 text-coral' :
                          'bg-line text-ink/60'
                        }`}>{leave.status}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        {leave.status === 'Pending' ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleDecision(staff.id, leave.id, 'Approved')}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-lilac text-plum hover:bg-plum hover:text-white transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                            <button
                              onClick={() => handleDecision(staff.id, leave.id, 'Rejected')}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-coral/10 text-coral hover:bg-coral hover:text-white transition-colors"
                            >
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-ink/40">
                            {leave.reviewedBy ? `by ${leave.reviewedBy}` : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState icon={CalendarCheck} title="No leave requests" hint="Staff leave requests will appear here for approval." />
        )}
      </Card>
    </Shell>
  );
}
