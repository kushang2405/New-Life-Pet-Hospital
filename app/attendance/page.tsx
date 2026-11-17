'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock, MapPin, LogIn, LogOut, CheckCircle2, AlertTriangle,
  Loader2, X, Coffee, Play,
} from 'lucide-react';
import Shell from '../components/Shell';
import { Card, Button, EmptyState, StatCard, DateInput } from '../components/ui';
import { useDB } from '../lib/store';
import { useAuth } from '../lib/auth';
import {
  punchAttendance,
  type PunchType,
  HOSPITAL_LOCATION, distanceMeters, isAtHospital, localDate,
} from '../lib/attendance';
import type { Staff } from '../lib/api';

function formatMinutes(mins: number): string {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function AttendancePage() {
  const { user, loading } = useAuth();
  const { db, update, refresh } = useDB();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [filterDate, setFilterDate] = useState(localDate());

  const today = localDate();
  const isSuperAdmin = user?.role === 'Super Admin';

  const myStaff = db?.staff.find((s) => s.id === user?.id || s.email === user?.email) as Staff | undefined;
  const todayRecord = myStaff?.attendance?.find((a) => a.date === today);
  const punchedIn = !!todayRecord?.checkIn;
  const punchedOut = !!todayRecord?.checkOut;
  const isOnBreak = !!todayRecord?.isOnBreak || (!!todayRecord?.breakStart && !todayRecord?.breakEnd);
  const hasBreakStarted = !!todayRecord?.breakStart;
  const hasBreakEnded = !!todayRecord?.breakEnd;
  const breakMinutes = todayRecord?.breakMinutes || 0;
  const recentAttendance = (myStaff?.attendance || []).slice(-7).reverse();

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }
    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationStatus('granted');
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    // Only request location for staff members who need to punch in/out
    // Super Admins only view attendance reports and should NEVER be prompted for location
    if (loading || isSuperAdmin || !user) return;
    requestLocation();
  }, [requestLocation, loading, isSuperAdmin, user]);

  const distFromHospital = location
    ? Math.round(distanceMeters(location.lat, location.lon, HOSPITAL_LOCATION.latitude, HOSPITAL_LOCATION.longitude))
    : null;
  const atHospital = location ? isAtHospital(location.lat, location.lon) : false;

  const handlePunch = async (type: PunchType) => {
    if (!location) {
      setMessage({ type: 'error', text: 'Please allow location access to record attendance or breaks.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const updated = await punchAttendance(type, location.lat, location.lon);
      update('staff', updated.id, { attendance: updated.attendance });
      const successMsg =
        type === 'in'
          ? 'Punched in successfully. Have a great shift!'
          : type === 'break_start'
          ? 'Break started. Enjoy your break!'
          : type === 'break_end'
          ? 'Break ended. Welcome back to work!'
          : 'Punched out successfully. See you next time!';
      setMessage({
        type: 'success',
        text: successMsg,
      });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // Super Admin: build attendance table for selected date
  const dayRecords = useMemo(() => {
    if (!db) return [];
    return db.staff.map((s) => {
      const rec = (s.attendance || []).find((a) => a.date === filterDate);
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        shift: s.shift,
        checkIn: rec?.checkIn || '—',
        checkOut: rec?.checkOut || '—',
        status: rec?.status || (rec ? 'Present' : 'No record'),
        hoursWorked: rec?.hoursWorked || 0,
        breakStart: rec?.breakStart || '',
        breakEnd: rec?.breakEnd || '',
        breakMinutes: rec?.breakMinutes || 0,
        isOnBreak: !!rec?.isOnBreak || (!!rec?.breakStart && !rec?.breakEnd),
      };
    });
  }, [db, filterDate]);

  const presentCount = dayRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length;
  const lateCount = dayRecords.filter((r) => r.status === 'Late').length;
  const absentCount = dayRecords.filter((r) => r.status === 'Absent' || r.status === 'No record').length;
  const onBreakCount = dayRecords.filter((r) => r.isOnBreak).length;
  const totalBreakMinutes = dayRecords.reduce((sum, r) => sum + (r.breakMinutes || 0), 0);

  if (loading || !db) return <Shell title="Attendance"><div className="text-sm text-ink/50">Loading...</div></Shell>;

  // Super Admin view
  if (isSuperAdmin) {
    return (
      <Shell title="Attendance" subtitle="View all staff attendance records and break times" module="attendance">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
          <StatCard icon={CheckCircle2} label="Present" value={String(presentCount)} tone="plum" />
          <StatCard icon={Clock} label="Late" value={String(lateCount)} tone="amber" />
          <StatCard icon={AlertTriangle} label="Absent" value={String(absentCount)} tone="coral" />
          <StatCard
            icon={Coffee}
            label="Total Break Time"
            value={formatMinutes(totalBreakMinutes)}
            sub={onBreakCount > 0 ? `${onBreakCount} staff on break now` : 'All breaks completed'}
            tone="amber"
          />
          <StatCard icon={Clock} label="Total staff" value={String(db.staff.length)} tone="sky" />
        </div>

        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-semibold text-ink">Attendance for {filterDate}</h3>
            <div className="flex items-center gap-2">
              <DateInput
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                allowPast
                className="w-40"
              />
              <Button variant="ghost" size="sm" onClick={() => setFilterDate(localDate())}>Today</Button>
              <Button variant="ghost" size="sm" onClick={() => refresh()}>Refresh</Button>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink/50 uppercase tracking-wide">
                  <th className="py-2.5 px-3 font-medium">Staff</th>
                  <th className="py-2.5 px-3 font-medium">Role</th>
                  <th className="py-2.5 px-3 font-medium">Check In</th>
                  <th className="py-2.5 px-3 font-medium">Check Out</th>
                  <th className="py-2.5 px-3 font-medium">Break Time</th>
                  <th className="py-2.5 px-3 font-medium">Work Hours</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dayRecords.map((r) => (
                  <tr key={r.id} className="border-b border-line/50 hover:bg-canvas/50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-ink">{r.name}</div>
                      <div className="text-[11px] text-ink/40">{r.shift}</div>
                    </td>
                    <td className="py-2.5 px-3 text-ink/60">{r.role}</td>
                    <td className="py-2.5 px-3 text-ink/70">{r.checkIn}</td>
                    <td className="py-2.5 px-3 text-ink/70">{r.checkOut}</td>
                    <td className="py-2.5 px-3">
                      {r.isOnBreak ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 animate-pulse border border-amber-300">
                          <Coffee className="w-3 h-3" /> On break ({r.breakStart})
                        </span>
                      ) : r.breakStart ? (
                        <div className="text-xs">
                          <span className="font-semibold text-ink/80">{formatMinutes(r.breakMinutes)}</span>
                          <span className="text-[11px] text-ink/40 ml-1">({r.breakStart} → {r.breakEnd || '—'})</span>
                        </div>
                      ) : (
                        <span className="text-ink/30">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-ink/70 font-medium">{r.hoursWorked ? `${r.hoursWorked}h` : '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        r.isOnBreak ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        r.status === 'Present' ? 'bg-lilac text-plum' :
                        r.status === 'Late' ? 'bg-amber-100 text-amber-700' :
                        r.status === 'Absent' || r.status === 'No record' ? 'bg-coral/10 text-coral' :
                        r.status === 'On leave' ? 'bg-sky-100 text-sky-700' :
                        'bg-line text-ink/60'
                      }`}>{r.isOnBreak ? 'On break' : r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (< md) */}
          <div className="md:hidden space-y-3">
            {dayRecords.map((r) => (
              <div key={r.id} className="p-3.5 rounded-xl border border-line bg-canvas/40 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-ink">{r.name}</div>
                    <div className="text-xs text-ink/50">{r.role} · {r.shift}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    r.status === 'Present' ? 'bg-lilac text-plum' :
                    r.status === 'Late' ? 'bg-amber-100 text-amber-700' :
                    r.status === 'Absent' || r.status === 'No record' ? 'bg-coral/10 text-coral' :
                    r.status === 'On leave' ? 'bg-sky-100 text-sky-700' :
                    'bg-line text-ink/60'
                  }`}>{r.status}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-line/60">
                  <div className="bg-white/80 p-2 rounded-lg border border-line/60">
                    <span className="text-ink/40 text-[10px] block uppercase font-medium">Punch Times</span>
                    <span className="font-medium text-ink/80">{r.checkIn} → {r.checkOut}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-line/60">
                    <span className="text-ink/40 text-[10px] block uppercase font-medium">Work Hours</span>
                    <span className="font-semibold text-ink/90">{r.hoursWorked ? `${r.hoursWorked}h` : '—'}</span>
                  </div>
                </div>

                <div className="bg-white/80 p-2 rounded-lg border border-line/60 text-xs">
                  <span className="text-ink/40 text-[10px] block uppercase font-medium mb-0.5">Break Taken</span>
                  {r.isOnBreak ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 animate-pulse border border-amber-300">
                      <Coffee className="w-3 h-3" /> Currently on break (since {r.breakStart})
                    </span>
                  ) : r.breakStart ? (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink/80">{formatMinutes(r.breakMinutes)}</span>
                      <span className="text-[11px] text-ink/50">{r.breakStart} → {r.breakEnd || '—'}</span>
                    </div>
                  ) : (
                    <span className="text-ink/40">No break recorded</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Shell>
    );
  }

  // Staff view: punch in / out & break management
  return (
    <Shell title="Punch In / Out" subtitle="Mark your attendance and break time" module="attendance">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-plum" />
            <h2 className="text-base font-semibold text-ink">Today&apos;s Attendance</h2>
          </div>
          <p className="text-sm text-ink/50 mb-5">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <div className="flex flex-wrap gap-2 mb-5">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${punchedIn ? 'bg-lilac text-plum' : 'bg-canvas text-ink/50'}`}>
              {punchedIn ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              In: {todayRecord?.checkIn || '—'}
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${punchedOut ? 'bg-lilac text-plum' : 'bg-canvas text-ink/50'}`}>
              {punchedOut ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              Out: {todayRecord?.checkOut || '—'}
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              isOnBreak ? 'bg-amber-100 text-amber-800 animate-pulse' :
              breakMinutes > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-canvas text-ink/50'
            }`}>
              <Coffee className="w-3.5 h-3.5" />
              {isOnBreak ? `On Break (${todayRecord?.breakStart})` :
               breakMinutes > 0 ? `Break: ${formatMinutes(breakMinutes)}` :
               'Break: None'}
            </div>
            {todayRecord?.hoursWorked ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-100 text-sky-700">
                <Clock className="w-3.5 h-3.5" />
                {todayRecord.hoursWorked}h worked
              </div>
            ) : null}
          </div>

          {/* Break Management Section (Appears after Punch In, before Punch Out) */}
          {punchedIn && !punchedOut && (
            <div className="mb-5 p-4 rounded-xl border border-line bg-canvas/40">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-semibold text-ink uppercase tracking-wider">Break Management</h4>
                </div>
                <span className="text-[11px] text-ink/50">1 break per shift</span>
              </div>

              {isOnBreak ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Coffee className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900">Break in progress</p>
                      <p className="text-xs text-amber-700">
                        Started at <strong>{todayRecord?.breakStart}</strong>. Click below when you return to duty.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="md"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm border-none"
                    disabled={busy || !atHospital}
                    onClick={() => handlePunch('break_end')}
                    icon={Play}
                  >
                    End Break & Resume Work
                  </Button>
                </div>
              ) : hasBreakEnded ? (
                <div className="rounded-xl border border-line bg-white p-3 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-ink/70">
                    <CheckCircle2 className="w-4 h-4 text-plum shrink-0" />
                    <span>
                      Break completed: <strong>{formatMinutes(breakMinutes)}</strong>
                      <span className="text-[11px] text-ink/40 ml-1.5">({todayRecord?.breakStart} → {todayRecord?.breakEnd})</span>
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-ink/40 bg-canvas px-2 py-0.5 rounded border border-line">
                    Locked (1/1)
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs font-medium text-ink">Take your break</p>
                    <p className="text-[11px] text-ink/50">Only 1 break is permitted per shift. Once ended, it cannot be reopened.</p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white font-medium border-none shadow-sm"
                    disabled={busy || !atHospital}
                    onClick={() => handlePunch('break_start')}
                    icon={Coffee}
                  >
                    Start Break
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className={`rounded-xl border p-4 mb-5 ${
            locationStatus === 'granted' && atHospital ? 'bg-lilac/50 border-plum/20' :
            locationStatus === 'granted' && !atHospital ? 'bg-amber-50 border-amber-200' :
            locationStatus === 'denied' || locationStatus === 'unavailable' ? 'bg-coral/5 border-coral/20' :
            'bg-canvas border-line'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                locationStatus === 'granted' && atHospital ? 'bg-lilac text-plum' :
                locationStatus === 'granted' && !atHospital ? 'bg-amber-100 text-amber-700' :
                'bg-coral/15 text-coral'
              }`}>
                <MapPin className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                {locationStatus === 'loading' && (
                  <p className="text-sm text-ink/60 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Detecting your location...</p>
                )}
                {locationStatus === 'granted' && atHospital && (
                  <>
                    <p className="text-sm font-medium text-plum">You are at the hospital</p>
                    <p className="text-xs text-ink/50 mt-0.5">{distFromHospital}m from the hospital — you can punch in, out, or record breaks.</p>
                  </>
                )}
                {locationStatus === 'granted' && !atHospital && (
                  <>
                    <p className="text-sm font-medium text-amber-700">You are not at the hospital</p>
                    <p className="text-xs text-amber-700/80 mt-0.5">{distFromHospital}m from the hospital. You need to arrive at the hospital to punch in, out, or record breaks.</p>
                  </>
                )}
                {locationStatus === 'denied' && (
                  <>
                    <p className="text-sm font-medium text-coral">Location access denied</p>
                    <p className="text-xs text-ink/50 mt-0.5">Allow location access in your browser to verify you are at the hospital.</p>
                  </>
                )}
                {locationStatus === 'unavailable' && (
                  <>
                    <p className="text-sm font-medium text-coral">Location unavailable</p>
                    <p className="text-xs text-ink/50 mt-0.5">Your device does not support location detection.</p>
                  </>
                )}
                {locationStatus === 'idle' && (
                  <p className="text-sm text-ink/50">Waiting for location...</p>
                )}
              </div>
              {locationStatus !== 'loading' && (
                <Button variant="ghost" size="sm" onClick={requestLocation}>Retry</Button>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              size="lg"
              variant={punchedIn ? 'ghost' : 'primary'}
              disabled={busy || !atHospital || punchedIn}
              onClick={() => handlePunch('in')}
              icon={LogIn}
              full
            >
              {punchedIn ? 'Already punched in' : 'Punch In'}
            </Button>
            <Button
              size="lg"
              variant={punchedOut ? 'ghost' : 'soft'}
              disabled={busy || !atHospital || !punchedIn || punchedOut || isOnBreak}
              onClick={() => handlePunch('out')}
              icon={LogOut}
              full
            >
              {punchedOut ? 'Already punched out' : isOnBreak ? 'End break before punch out' : 'Punch Out'}
            </Button>
          </div>

          {message && (
            <div className={`mt-4 rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${
              message.type === 'success' ? 'bg-lilac/60 text-plum border border-plum/20' : 'bg-coral/10 text-coral border border-coral/20'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{message.text}</span>
              <button onClick={() => setMessage(null)} className="ml-auto shrink-0"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </Card>

        {/* Recent Attendance positioned directly in the right column */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-plum" />
            <h3 className="text-sm font-semibold text-ink">Recent Attendance</h3>
          </div>
          {recentAttendance.length > 0 ? (
            <div className="space-y-1.5">
              {recentAttendance.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-canvas/50">
                  <span className="text-ink/70 font-medium">{a.date}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-ink/50">{a.checkIn || '—'} → {a.checkOut || '—'}</span>
                    {a.breakMinutes ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200/60">
                        Break: {formatMinutes(a.breakMinutes)}
                      </span>
                    ) : null}
                    <span className={`px-1.5 py-0.5 rounded font-medium ${
                      a.status === 'Present' ? 'bg-lilac text-plum' :
                      a.status === 'Late' ? 'bg-amber-100 text-amber-700' :
                      a.status === 'Absent' ? 'bg-coral/10 text-coral' :
                      a.status === 'On leave' ? 'bg-sky-100 text-sky-700' :
                      'bg-line text-ink/60'
                    }`}>{a.status}</span>
                    <span className="text-ink/40 w-12 text-right">{a.hoursWorked ? `${a.hoursWorked}h` : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Clock} title="No attendance records yet" hint="Punch in to start recording your shifts." />
          )}
        </Card>
      </div>
    </Shell>
  );
}
