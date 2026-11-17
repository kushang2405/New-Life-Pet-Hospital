'use client';

import { useMemo, useState } from 'react';
import {
  CalendarDays, Plus, Clock, Stethoscope, CheckCircle2, XCircle,
  UserCheck, Edit2, Trash2, ChevronLeft, ChevronRight,
  AlertTriangle, Footprints, Globe, Bell, ListOrdered,
  CalendarCheck, X, Activity, ArrowRight, Users,
  MessageCircle,
} from 'lucide-react';
import WhatsAppReminders from '../components/whatsapp-reminders';
import Shell from '../components/Shell';
import { Card, Badge, Button, EmptyState, Modal, Field, Checkbox, Select, DateInput, TimeInput, NumberInput } from '../components/ui';
import { useDB, Appointment, newId, today } from '../lib/store';
import { useAuth } from '../lib/auth';

const services = ['Consultation', 'Vaccination', 'Surgery', 'Dental', 'Grooming', 'Boarding', 'Emergency', 'Walk-in', 'Follow-up', 'Other'];
const statusFlow: Record<Appointment['status'], Appointment['status'] | null> = {
  'Scheduled': 'Checked-in',
  'Checked-in': 'In consultation',
  'In consultation': 'Completed',
  'Completed': null,
  'Cancelled': null,
  'Rescheduled': 'Checked-in',
  'No-show': null,
};

const statusActionLabel: Record<Appointment['status'], string | null> = {
  'Scheduled': 'Check in',
  'Checked-in': 'Start consult',
  'In consultation': 'Complete',
  'Completed': null,
  'Cancelled': null,
  'Rescheduled': 'Check in',
  'No-show': null,
};

const bookingTypeIcon: Record<string, typeof Globe> = {
  Online: Globe, 'Walk-in': Footprints, Emergency: AlertTriangle,
};

const bookingTypeColor: Record<string, string> = {
  Online: 'bg-sky-100 text-sky-700', 'Walk-in': 'bg-amber-100 text-amber-700', Emergency: 'bg-coral/15 text-coral',
};

type ViewMode = 'day' | 'week' | 'month' | 'queue';
type TabId = 'calendar' | 'queue' | 'waitlist' | 'whatsapp';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date) { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); return r; }

function getLocalToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLocalCurrentTime(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function getNextQuarterHour(): string {
  const d = new Date();
  const currentMinutes = d.getMinutes();
  const roundedMinutes = Math.ceil((currentMinutes + 1) / 15) * 15;
  d.setMinutes(roundedMinutes, 0, 0);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export default function AppointmentsPage() {
  const { db, create, update, remove } = useDB();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>('calendar');
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    petId: '', service: services[0], date: getLocalToday(), time: '09:00',
    durationMin: '30', bookingType: 'Online' as Appointment['bookingType'],
    followUpDate: '', followUpReminder: false,
  });
  const set = (k: string, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (formErrors[k]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  };

  const sorted = useMemo(() => {
    if (!db) return [];
    return [...db.appointments].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [db]);

  const petName = (id: string) => db?.pets.find((p) => p.id === id)?.name ?? 'Unknown';
  const ownerName = (id: string) => db?.owners.find((o) => o.id === id)?.name ?? 'Unknown';
  const petOf = (id: string) => db?.pets.find((p) => p.id === id);

  const byDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    sorted.forEach((a) => { (map[a.date] ??= []).push(a); });
    return map;
  }, [sorted]);

  // Queue: today's checked-in + in-consultation appointments
  const todayQueue = useMemo(() => {
    const t = today();
    return sorted.filter((a) => a.date === t && (a.status === 'Checked-in' || a.status === 'In consultation'));
  }, [sorted]);

  // Waitlist: today's scheduled appointments not yet checked in
  const waitlist = useMemo(() => {
    const t = today();
    return sorted.filter((a) => a.date === t && a.status === 'Scheduled');
  }, [sorted]);

  // Follow-up reminders
  const followUps = useMemo(() => {
    if (!db) return [];
    return db.appointments.filter((a) => a.followUpReminder && a.followUpDate && a.followUpDate >= today() && a.status === 'Completed');
  }, [db]);

  const nextToken = useMemo(() => {
    const t = today();
    const todayAppts = sorted.filter((a) => a.date === t);
    return todayAppts.length > 0 ? Math.max(...todayAppts.map((a) => a.tokenNumber || 0)) + 1 : 1;
  }, [sorted]);

  const advanceStatus = (id: string) => {
    const a = db?.appointments.find((x) => x.id === id);
    if (!a) return;
    const next = statusFlow[a.status];
    if (next) update('appointments', id, { status: next });
  };

  const cancelAppt = (id: string) => update('appointments', id, { status: 'Cancelled' as const });
  const noShowAppt = (id: string) => update('appointments', id, { status: 'No-show' as const });

  const rescheduleAppt = (id: string, date: string, time: string) => {
    update('appointments', id, { status: 'Rescheduled' as const, date, time });
  };

  const deleteAppt = (id: string) => remove('appointments', id);

  const openEdit = (a: Appointment) => {
    setEditAppt(a);
    setFormErrors({});
    setForm({
      petId: a.petId, service: a.service, date: a.date, time: a.time,
      durationMin: String(a.durationMin), bookingType: a.bookingType ?? 'Online',
      followUpDate: a.followUpDate ?? '', followUpReminder: a.followUpReminder ?? false,
    });
    setOpen(true);
  };

  const openNew = (presetDate?: string, presetType?: Appointment['bookingType']) => {
    setEditAppt(null);
    setFormErrors({});
    const localToday = getLocalToday();
    const effectiveDate = presetDate && presetDate >= localToday ? presetDate : localToday;
    const initialTime = effectiveDate === localToday ? getNextQuarterHour() : '09:00';
    setForm({
      petId: '', service: presetType === 'Emergency' ? 'Emergency' : presetType === 'Walk-in' ? 'Walk-in' : services[0],
      date: effectiveDate, time: initialTime, durationMin: '30',
      bookingType: presetType ?? 'Online',
      followUpDate: '', followUpReminder: false,
    });
    setOpen(true);
  };

  const saveAppt = () => {
    const errs: Record<string, string> = {};
    if (!form.petId) {
      errs.petId = 'Please select a patient';
    }
    if (!form.service?.trim()) {
      errs.service = 'Please select a service';
    }

    const localToday = getLocalToday();
    const localNow = getLocalCurrentTime();

    if (!form.date) {
      errs.date = 'Please select an appointment date';
    } else if (form.date < localToday) {
      errs.date = 'Cannot book an appointment for a past date';
    }

    if (!form.time) {
      errs.time = 'Please select an appointment time';
    } else if (form.date === localToday && form.time < localNow) {
      errs.time = 'Cannot select a past time for today';
    }

    if (form.followUpReminder && form.followUpDate) {
      if (form.followUpDate < (form.date || localToday)) {
        errs.followUpDate = 'Follow-up date cannot be earlier than appointment date';
      }
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    const pet = db?.pets.find((p) => p.id === form.petId);
    if (!pet) {
      setFormErrors({ petId: 'Selected patient does not exist' });
      return;
    }

    const t = form.date === today() ? nextToken : 1;
    if (editAppt) {
      update('appointments', editAppt.id, {
        petId: pet.id, ownerId: pet.ownerId, service: form.service, date: form.date,
        time: form.time, durationMin: parseInt(form.durationMin) || 30,
        bookingType: form.bookingType, followUpDate: form.followUpDate,
        followUpReminder: form.followUpReminder,
      });
    } else {
      create('appointments', {
        id: newId('apt'), petId: pet.id, ownerId: pet.ownerId, vet: '', service: form.service,
        date: form.date, time: form.time, durationMin: parseInt(form.durationMin) || 30,
        status: form.bookingType === 'Emergency' ? 'Checked-in' : 'Scheduled',
        reason: '', bookingType: form.bookingType, tokenNumber: t,
        queuePosition: 0, isRecurring: false, recurrencePattern: 'None',
        followUpDate: form.followUpDate, followUpReminder: form.followUpReminder, notes: '',
      });
    }
    setOpen(false);
    setEditAppt(null);
    setFormErrors({});
  };

  if (!db) return <Shell module="appointments" title="Appointments"><div className="text-sm text-ink/50">Loading…</div></Shell>;

  return (
    <Shell title="Appointments" subtitle="Scheduling, queue management, and calendar">
      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-white border border-line max-w-full overflow-x-auto [scrollbar-width:none] shrink-0 mb-5">
        {([
          { id: 'calendar' as TabId, label: 'Calendar', icon: CalendarDays },
          { id: 'queue' as TabId, label: 'Queue & Tokens', icon: ListOrdered },
          { id: 'waitlist' as TabId, label: 'Waitlist & Follow-ups', icon: Users },
          { id: 'whatsapp' as TabId, label: 'WhatsApp', icon: MessageCircle },
        ]).map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium shrink-0 whitespace-nowrap transition-colors ${
              tab === tb.id ? 'bg-lilac text-plum' : 'text-ink/60 hover:bg-canvas'
            }`}
          >
            <tb.icon className="w-3.5 h-3.5" /> {tb.label}
            {tb.id === 'queue' && todayQueue.length > 0 && (
              <span className="ml-0.5 text-[10px] bg-plum text-white rounded-full px-1.5 py-0.5 font-semibold">{todayQueue.length}</span>
            )}
            {tb.id === 'waitlist' && (waitlist.length + followUps.length) > 0 && (
              <span className="ml-0.5 text-[10px] bg-coral text-white rounded-full px-1.5 py-0.5 font-semibold">{waitlist.length + followUps.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Calendar tab */}
      {tab === 'whatsapp' && <WhatsAppReminders />}
      {tab === 'calendar' && (
        <>
          {/* View controls */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 mb-5">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white border border-line max-w-full overflow-x-auto [scrollbar-width:none] shrink-0">
              {(['day', 'week', 'month'] as ViewMode[]).map((vm) => (
                <button
                  key={vm}
                  onClick={() => setViewMode(vm)}
                  className={`px-3 h-8 rounded-md text-xs font-medium capitalize shrink-0 transition-colors ${
                    viewMode === vm ? 'bg-lilac text-plum' : 'text-ink/60 hover:bg-canvas'
                  }`}
                >
                  {vm}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2 px-3 h-10 rounded-lg bg-white border border-line">
              <button onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'day' ? -1 : viewMode === 'week' ? -7 : -30))} className="text-ink/50 hover:text-ink">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-ink min-w-[140px] text-center">
                {viewMode === 'day' && new Date(currentDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                {viewMode === 'week' && `${fmtDate(startOfWeek(currentDate))} — ${fmtDate(addDays(startOfWeek(currentDate), 6))}`}
                {viewMode === 'month' && `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
              </span>
              <button onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30))} className="text-ink/50 hover:text-ink">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => setCurrentDate(new Date())} className="ml-1 text-[11px] text-plum font-medium hover:underline">Today</button>
            </div>
            <div className="flex-1 hidden sm:block" />
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => openNew()}><Plus className="w-4 h-4" /> Book</Button>
              <Button variant="outline" onClick={() => openNew(getLocalToday(), 'Walk-in')}><Footprints className="w-4 h-4" /> Walk-in</Button>
              <Button variant="danger" onClick={() => openNew(getLocalToday(), 'Emergency')}><AlertTriangle className="w-4 h-4" /> Emergency</Button>
            </div>
          </div>

          {/* Day view */}
          {viewMode === 'day' && <DayView date={fmtDate(currentDate)} appts={byDate[fmtDate(currentDate)] ?? []} petName={petName} ownerName={ownerName} onDetail={setDetailAppt} onAdvance={advanceStatus} onCancel={cancelAppt} onEdit={openEdit} onDelete={deleteAppt} />}

          {/* Week view */}
          {viewMode === 'week' && <WeekView weekStart={startOfWeek(currentDate)} byDate={byDate} petName={petName} onDetail={setDetailAppt} onBook={(d: string) => openNew(d)} />}

          {/* Month view */}
          {viewMode === 'month' && <MonthView current={currentDate} byDate={byDate} onDayClick={(d: string) => { setCurrentDate(new Date(d + 'T00:00:00')); setViewMode('day'); }} />}
        </>
      )}

      {/* Queue tab */}
      {tab === 'queue' && (
        <div className="space-y-5">
          {/* Active queue */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-plum" />
                <span className="text-sm font-semibold text-ink">Active Queue — Today</span>
              </div>
              <span className="text-[11px] text-ink/50">{todayQueue.length} in queue</span>
            </div>
            {todayQueue.length === 0 ? (
              <EmptyState icon={ListOrdered} title="Queue is empty" hint="Checked-in patients will appear here." />
            ) : (
              <div className="space-y-2">
                {todayQueue.map((a, i) => {
                  const BTIcon = bookingTypeIcon[a.bookingType] || Globe;
                  return (
                    <div key={a.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-3.5 ${a.status === 'In consultation' ? 'border-coral/30 bg-coral/5' : 'border-line bg-white'}`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-lilac text-plum flex items-center justify-center text-sm font-bold shrink-0">
                          {a.tokenNumber || i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink">{petName(a.petId)}</span>
                            <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${bookingTypeColor[a.bookingType] || 'bg-ink/10 text-ink/60'}`}>
                              <BTIcon className="w-2.5 h-2.5" /> {a.bookingType}
                            </span>
                          </div>
                          <div className="text-[11px] text-ink/50">{a.service}</div>
                        </div>
                        <div className="sm:hidden shrink-0">
                          <Badge status={a.status} />
                        </div>
                      </div>
                      <div className="hidden sm:block text-right shrink-0">
                        <Badge status={a.status} />
                      </div>
                      <div className="flex justify-end sm:justify-start">
                        {a.status === 'Checked-in' && (
                          <Button size="sm" variant="outline" onClick={() => advanceStatus(a.id)}>
                            <Stethoscope className="w-3.5 h-3.5 mr-1 text-plum" /> Start
                          </Button>
                        )}
                        {a.status === 'In consultation' && (
                          <Button size="sm" onClick={() => advanceStatus(a.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Token system summary */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ListOrdered className="w-4 h-4 text-plum" />
              <span className="text-sm font-semibold text-ink">Token System — Today</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="rounded-xl bg-canvas p-3 text-center">
                <div className="text-lg font-semibold text-ink">{nextToken}</div>
                <div className="text-[10px] text-ink/50">Next token</div>
              </div>
              <div className="rounded-xl bg-canvas p-3 text-center">
                <div className="text-lg font-semibold text-ink">{sorted.filter((a) => a.date === today()).length}</div>
                <div className="text-[10px] text-ink/50">Total today</div>
              </div>
              <div className="rounded-xl bg-canvas p-3 text-center">
                <div className="text-lg font-semibold text-plum">{sorted.filter((a) => a.date === today() && a.status === 'Completed').length}</div>
                <div className="text-[10px] text-ink/50">Completed</div>
              </div>
              <div className="rounded-xl bg-canvas p-3 text-center">
                <div className="text-lg font-semibold text-coral">{sorted.filter((a) => a.date === today() && a.status === 'Cancelled').length}</div>
                <div className="text-[10px] text-ink/50">Cancelled</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Waitlist tab */}
      {tab === 'waitlist' && (
        <div className="space-y-5">
          {/* Waitlist */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-ink">Waitlist — Today</span>
              </div>
              <span className="text-[11px] text-ink/50">{waitlist.length} waiting</span>
            </div>
            {waitlist.length === 0 ? (
              <EmptyState icon={Users} title="No one on the waitlist" hint="Scheduled appointments without a room or walk-ins will appear here." />
            ) : (
              <div className="space-y-2">
                {waitlist.map((a, i) => {
                  const BTIcon = bookingTypeIcon[a.bookingType] || Globe;
                  return (
                    <div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink">{petName(a.petId)}</span>
                            <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${bookingTypeColor[a.bookingType] || 'bg-ink/10 text-ink/60'}`}>
                              <BTIcon className="w-2.5 h-2.5" /> {a.bookingType}
                            </span>
                          </div>
                          <div className="text-[11px] text-ink/50">{a.time} · {a.service}</div>
                        </div>
                      </div>
                      <div className="flex justify-end sm:justify-start">
                        <Button size="sm" variant="outline" onClick={() => advanceStatus(a.id)}>
                          <UserCheck className="w-3.5 h-3.5 mr-1" /> Check in
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Follow-up reminders */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-plum" />
              <span className="text-sm font-semibold text-ink">Follow-up Reminders</span>
            </div>
            {followUps.length === 0 ? (
              <EmptyState icon={Bell} title="No follow-up reminders" hint="Completed appointments with follow-up dates will appear here." />
            ) : (
              <div className="space-y-2">
                {followUps.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl border border-plum/20 bg-lilac/20 p-3">
                    <Bell className="w-4 h-4 text-plum shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink">{petName(a.petId)} — Follow-up due {a.followUpDate}</div>
                      <div className="text-[11px] text-ink/50">{a.service}</div>
                    </div>
                    <Button size="sm" onClick={() => openNew(a.followUpDate)}>
                      <Plus className="w-3.5 h-3.5" /> Book follow-up
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Book / Edit modal */}
      <Modal open={open} onClose={() => { setOpen(false); setEditAppt(null); setFormErrors({}); }} title={editAppt ? 'Edit appointment' : 'Book an appointment'}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(['Online', 'Walk-in', 'Emergency'] as const).map((bt) => {
              const BTIcon = bookingTypeIcon[bt] || Globe;
              return (
                <button
                  key={bt}
                  onClick={() => set('bookingType', bt)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
                    form.bookingType === bt ? `border-2 ${bt === 'Emergency' ? 'border-coral bg-coral/5' : bt === 'Walk-in' ? 'border-amber-500 bg-amber-50' : 'border-sky-500 bg-sky-50'}` : 'border-line bg-white hover:bg-canvas'
                  }`}
                >
                  <BTIcon className={`w-4 h-4 ${bt === 'Emergency' ? 'text-coral' : bt === 'Walk-in' ? 'text-amber-600' : 'text-sky-600'}`} />
                  <span className="text-[11px] font-medium text-ink">{bt}</span>
                </button>
              );
            })}
          </div>
          <Field label="Patient" required error={formErrors.petId}>
            <Select
              value={form.petId}
              onChange={(e) => {
                set('petId', e.target.value);
                if (formErrors.petId) setFormErrors((prev) => ({ ...prev, petId: '' }));
              }}
            >
              <option value="">Select a pet…</option>
              {db.pets.map((p) => <option key={p.id} value={p.id}>{p.name} ({ownerName(p.ownerId)})</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Service" required error={formErrors.service}>
              <Select
                value={form.service}
                onChange={(e) => {
                  set('service', e.target.value);
                  if (formErrors.service) setFormErrors((prev) => ({ ...prev, service: '' }));
                }}
              >
                {services.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Date" required error={formErrors.date}>
              <DateInput
                value={form.date}
                min={getLocalToday()}
                onChange={(e) => {
                  set('date', e.target.value);
                  if (formErrors.date) setFormErrors((prev) => ({ ...prev, date: '' }));
                }}
              />
            </Field>
            <Field label="Time" required error={formErrors.time}>
              <TimeInput
                value={form.time}
                min={form.date === getLocalToday() ? getLocalCurrentTime() : '00:00'}
                onChange={(e) => {
                  set('time', e.target.value);
                  if (formErrors.time) setFormErrors((prev) => ({ ...prev, time: '' }));
                }}
              />
            </Field>
            <Field label="Duration (min)">
              <NumberInput value={form.durationMin} onChange={(e) => set('durationMin', e.target.value)} placeholder="30" />
            </Field>
          </div>
          <div className="border-t border-line pt-3 space-y-3">
            <Field label="Follow-up date" error={formErrors.followUpDate}>
              <DateInput
                value={form.followUpDate}
                min={form.date || getLocalToday()}
                onChange={(e) => {
                  set('followUpDate', e.target.value);
                  if (formErrors.followUpDate) setFormErrors((prev) => ({ ...prev, followUpDate: '' }));
                }}
              />
            </Field>
            <Checkbox checked={form.followUpReminder} onChange={(e) => set('followUpReminder', e.target.checked)} label="Follow-up reminder" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setOpen(false); setEditAppt(null); setFormErrors({}); }}>Cancel</Button>
            <Button onClick={saveAppt}><Stethoscope className="w-4 h-4" /> {editAppt ? 'Save changes' : 'Book'}</Button>
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detailAppt} onClose={() => setDetailAppt(null)} title="Appointment details" wide>
        {detailAppt && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-ink">{petName(detailAppt.petId)} · {detailAppt.service}</div>
                <div className="text-xs text-ink/50 mt-0.5">{detailAppt.date} at {detailAppt.time} · {detailAppt.durationMin}min</div>
              </div>
              <Badge status={detailAppt.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-canvas p-3">
                <div className="text-ink/40 uppercase tracking-wide text-[10px] mb-1">Owner</div>
                <div className="text-ink font-medium">{ownerName(detailAppt.ownerId)}</div>
              </div>
              <div className="rounded-lg bg-canvas p-3">
                <div className="text-ink/40 uppercase tracking-wide text-[10px] mb-1">Booking type</div>
                <div className="text-ink font-medium">{detailAppt.bookingType}</div>
              </div>
              <div className="rounded-lg bg-canvas p-3">
                <div className="text-ink/40 uppercase tracking-wide text-[10px] mb-1">Token #</div>
                <div className="text-ink font-medium">{detailAppt.tokenNumber || '—'}</div>
              </div>
            </div>
            {detailAppt.followUpDate && (
              <div className="rounded-lg bg-lilac/20 border border-plum/20 p-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-plum" />
                <span className="text-xs text-ink/70">Follow-up scheduled for {detailAppt.followUpDate}</span>
              </div>
            )}
            {petOf(detailAppt.petId) && (
              <div className="rounded-lg border border-line p-3">
                <div className="text-[10px] text-ink/40 uppercase tracking-wide mb-2">Patient info</div>
                <div className="text-xs text-ink/70 space-y-0.5">
                  <div><span className="text-ink/50">Species:</span> {petOf(detailAppt.petId)!.species} · {petOf(detailAppt.petId)!.breed}</div>
                  <div><span className="text-ink/50">Gender:</span> {petOf(detailAppt.petId)!.gender} · {petOf(detailAppt.petId)!.weightKg}kg</div>
                  {petOf(detailAppt.petId)!.allergies && petOf(detailAppt.petId)!.allergies !== 'None known' && (
                    <div className="text-coral font-medium">Allergies: {petOf(detailAppt.petId)!.allergies}</div>
                  )}
                  {petOf(detailAppt.petId)!.conditions && (
                    <div className="text-amber-600">{petOf(detailAppt.petId)!.conditions}</div>
                  )}
                </div>
              </div>
            )}
            {/* Workflow actions */}
            <div className="border-t border-line pt-3 space-y-2">
              <div className="flex items-center gap-1 text-[10px] text-ink/40 uppercase tracking-wide font-medium">
                <Activity className="w-3 h-3" /> Workflow
              </div>
              <div className="flex items-center gap-1 flex-wrap text-[10px]">
                {['Scheduled', 'Checked-in', 'In consultation', 'Completed'].map((s, i) => {
                  const currentIdx = ['Scheduled', 'Checked-in', 'In consultation', 'Completed'].indexOf(detailAppt.status);
                  const isActive = i <= currentIdx && detailAppt.status !== 'Cancelled' && detailAppt.status !== 'No-show';
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-lilac text-plum' : 'bg-ink/5 text-ink/40'}`}>{s}</span>
                      {i < 3 && <ArrowRight className="w-3 h-3 text-ink/20" />}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex gap-2">
              {statusFlow[detailAppt.status] && (
                <Button onClick={() => { advanceStatus(detailAppt.id); setDetailAppt(null); }} className="flex-1">
                  {detailAppt.status === 'Scheduled' ? <UserCheck className="w-4 h-4" /> : detailAppt.status === 'Checked-in' ? <Stethoscope className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {statusActionLabel[detailAppt.status]}
                </Button>
              )}
              {detailAppt.status !== 'Completed' && detailAppt.status !== 'Cancelled' && (
                <>
                  <Button variant="outline" onClick={() => { openEdit(detailAppt); setDetailAppt(null); }}>
                    <Edit2 className="w-4 h-4" /> Reschedule
                  </Button>
                  <Button variant="danger" onClick={() => { cancelAppt(detailAppt.id); setDetailAppt(null); }}>
                    <XCircle className="w-4 h-4" /> Cancel
                  </Button>
                </>
              )}
              {detailAppt.status === 'Scheduled' && (
                <Button variant="ghost" onClick={() => { noShowAppt(detailAppt.id); setDetailAppt(null); }}>
                  <XCircle className="w-4 h-4" /> No-show
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </Shell>
  );
}

/* ---------- Day View ---------- */
function DayView({ date, appts, petName, ownerName, onDetail, onAdvance, onCancel, onEdit, onDelete }: {
  date: string; appts: Appointment[];
  petName: (id: string) => string; ownerName: (id: string) => string;
  onDetail: (a: Appointment) => void; onAdvance: (id: string) => void; onCancel: (id: string) => void;
  onEdit: (a: Appointment) => void; onDelete: (id: string) => void;
}) {
  if (appts.length === 0) {
    return <Card><EmptyState icon={CalendarDays} title="No appointments" hint="Book an appointment for this day." /></Card>;
  }
  return (
    <Card className="divide-y divide-line overflow-hidden">
      {appts.map((a) => {
        const next = statusFlow[a.status];
        const actionLabel = statusActionLabel[a.status];
        const BTIcon = bookingTypeIcon[a.bookingType] || Globe;
        return (
          <div key={a.id} className="group">
            {/* Mobile Card View (< md) */}
            <div className="block md:hidden p-4 space-y-2.5 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink bg-canvas px-2.5 py-1 rounded-md border border-line">
                    <Clock className="w-3.5 h-3.5 text-plum" /> {a.time} ({a.durationMin}m)
                  </span>
                  {a.tokenNumber > 0 && (
                    <span className="text-[10px] font-mono text-ink/50 bg-canvas px-1.5 py-0.5 rounded border border-line">
                      #{a.tokenNumber}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${bookingTypeColor[a.bookingType] || 'bg-ink/10 text-ink/60'}`}>
                    <BTIcon className="w-2.5 h-2.5" /> {a.bookingType}
                  </span>
                  <Badge status={a.status} />
                </div>
              </div>

              <div className="cursor-pointer" onClick={() => onDetail(a)}>
                <div className="text-base font-semibold text-ink flex items-center gap-2">
                  {petName(a.petId)}
                  <span className="text-xs font-normal text-ink/50">· {a.service}</span>
                  {a.followUpReminder && <Bell className="w-3.5 h-3.5 text-amber-500" />}
                </div>
                <div className="text-xs text-ink/60 mt-0.5">
                  Owner: <span className="font-medium text-ink/80">{ownerName(a.ownerId)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-line/60">
                <div>
                  {next && actionLabel && (
                    <Button size="sm" variant="outline" onClick={() => onAdvance(a.id)}>
                      {a.status === 'Scheduled' ? <UserCheck className="w-4 h-4 mr-1 text-plum" /> : a.status === 'Checked-in' ? <Stethoscope className="w-4 h-4 mr-1 text-plum" /> : <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />}
                      {actionLabel}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {a.status !== 'Completed' && a.status !== 'Cancelled' && (
                    <button onClick={() => onCancel(a.id)} className="w-8 h-8 rounded-lg hover:bg-coral/10 text-ink/40 hover:text-coral flex items-center justify-center transition-colors" title="Cancel">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => onEdit(a)} className="w-8 h-8 rounded-lg hover:bg-canvas text-ink/40 hover:text-ink flex items-center justify-center transition-colors" title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDelete(a.id)} className="w-8 h-8 rounded-lg hover:bg-coral/10 text-ink/40 hover:text-coral flex items-center justify-center transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Row View (>= md) */}
            <div className="hidden md:flex items-center gap-4 px-4 py-3 hover:bg-canvas/30 transition-colors">
              <button onClick={() => onDetail(a)} className="flex flex-col items-center w-14 shrink-0 text-left">
                <Clock className="w-3.5 h-3.5 text-ink/40" />
                <span className="text-sm font-semibold text-ink mt-0.5">{a.time}</span>
                <span className="text-[10px] text-ink/40">{a.durationMin}min</span>
              </button>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onDetail(a)}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{petName(a.petId)} · {a.service}</span>
                  <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${bookingTypeColor[a.bookingType] || 'bg-ink/10 text-ink/60'}`}>
                    <BTIcon className="w-2.5 h-2.5" /> {a.bookingType}
                  </span>
                  {a.followUpReminder && <Bell className="w-3 h-3 text-amber-500" />}
                </div>
                <div className="text-[11px] text-ink/50">{ownerName(a.ownerId)}</div>
              </div>
              {a.tokenNumber > 0 && <span className="text-[10px] text-ink/40 font-mono">#{a.tokenNumber}</span>}
              <Badge status={a.status} />
              <div className="flex items-center gap-1 transition-opacity">
                {next && actionLabel && (
                  <Button size="sm" variant="outline" onClick={() => onAdvance(a.id)}>
                    {a.status === 'Scheduled' ? <UserCheck className="w-5 h-5" /> : a.status === 'Checked-in' ? <Stethoscope className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    {actionLabel}
                  </Button>
                )}
                {a.status !== 'Completed' && a.status !== 'Cancelled' && (
                  <button onClick={() => onCancel(a.id)} className="w-8 h-8 rounded-lg hover:bg-coral/10 text-ink/40 hover:text-coral flex items-center justify-center transition-colors" title="Cancel">
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => onEdit(a)} className="w-8 h-8 rounded-lg hover:bg-canvas text-ink/40 hover:text-ink flex items-center justify-center transition-colors" title="Edit">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(a.id)} className="w-8 h-8 rounded-lg hover:bg-coral/10 text-ink/40 hover:text-coral flex items-center justify-center transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

/* ---------- Week View ---------- */
function WeekView({ weekStart, byDate, petName, onDetail, onBook }: {
  weekStart: Date; byDate: Record<string, Appointment[]>;
  petName: (id: string) => string; onDetail: (a: Appointment) => void; onBook: (date: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {days.map((d) => {
        const dateStr = fmtDate(d);
        const appts = byDate[dateStr] ?? [];
        const isToday = dateStr === today();
        return (
          <div key={dateStr} className={`rounded-xl border ${isToday ? 'border-plum/30 bg-lilac/10' : 'border-line bg-white'} min-h-[180px] overflow-hidden`}>
            <div className={`px-3 py-2 border-b ${isToday ? 'border-plum/20' : 'border-line'} flex items-center justify-between`}>
              <div>
                <div className="text-[10px] text-ink/50 uppercase font-medium">{dayNames[d.getDay()]}</div>
                <div className={`text-sm font-semibold ${isToday ? 'text-plum' : 'text-ink'}`}>{d.getDate()}</div>
              </div>
              {appts.length === 0 && (
                <button onClick={() => onBook(dateStr)} className="w-6 h-6 rounded-lg hover:bg-lilac text-ink/30 hover:text-plum flex items-center justify-center transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="p-1.5 space-y-1 max-h-[200px] overflow-y-auto">
              {appts.map((a) => {
                const BTIcon = bookingTypeIcon[a.bookingType] || Globe;
                return (
                  <button
                    key={a.id}
                    onClick={() => onDetail(a)}
                    className={`w-full text-left rounded-lg p-1.5 text-[10px] transition-all hover:ring-2 hover:ring-plum/20 ${
                      a.status === 'Cancelled' ? 'bg-ink/5 opacity-50' :
                      a.status === 'Completed' ? 'bg-lilac/30' :
                      a.status === 'In consultation' ? 'bg-coral/10' :
                      a.bookingType === 'Emergency' ? 'bg-coral/10' :
                      a.bookingType === 'Walk-in' ? 'bg-amber-50' : 'bg-sky-50'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-ink">{a.time}</span>
                      <BTIcon className="w-2.5 h-2.5 text-ink/40" />
                    </div>
                    <div className="text-ink/70 truncate">{petName(a.petId)} · {a.service}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Month View ---------- */
function MonthView({ current, byDate, onDayClick }: {
  current: Date; byDate: Record<string, Appointment[]>;
  onDayClick: (date: string) => void;
}) {
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = firstDay.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-xl border border-line bg-white overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line">
        {dayNames.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[10px] font-semibold text-ink/50 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="min-h-[80px] border-r border-b border-line bg-canvas/50" />;
          const dateStr = fmtDate(d);
          const appts = byDate[dateStr] ?? [];
          const isToday = dateStr === today();
          return (
            <button
              key={i}
              onClick={() => onDayClick(dateStr)}
              className={`min-h-[80px] border-r border-b border-line p-1.5 text-left transition-colors hover:bg-lilac/10 ${isToday ? 'bg-lilac/20' : 'bg-white'}`}
            >
              <div className={`text-xs font-medium ${isToday ? 'text-plum' : 'text-ink/70'}`}>{d.getDate()}</div>
              <div className="mt-1 space-y-0.5">
                {appts.slice(0, 3).map((a) => (
                  <div key={a.id} className={`text-[9px] rounded px-1 py-0.5 truncate ${
                    a.status === 'Completed' ? 'bg-lilac/30 text-plum' :
                    a.status === 'Cancelled' ? 'bg-ink/5 text-ink/40' :
                    a.bookingType === 'Emergency' ? 'bg-coral/10 text-coral' :
                    'bg-sky-50 text-sky-700'
                  }`}>
                    {a.time} {a.service}
                  </div>
                ))}
                {appts.length > 3 && <div className="text-[9px] text-ink/40 px-1">+{appts.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
