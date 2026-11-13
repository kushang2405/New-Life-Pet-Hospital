'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock, MapPin, LogIn, LogOut, CheckCircle2, AlertTriangle,
  Loader2, X,
} from 'lucide-react';
import Shell from '../components/Shell';
import { Card, Badge, Button, EmptyState, StatCard, DateInput } from '../components/ui';
import { useDB } from '../lib/store';
import { useAuth } from '../lib/auth';
import {
  punchAttendance,
  HOSPITAL_LOCATION, distanceMeters, isAtHospital, localDate,
} from '../lib/attendance';
import type { Staff } from '../lib/api';

export default function AttendancePage() {
  const { user } = useAuth();
  const { db, update } = useDB();
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
    if (!isSuperAdmin) requestLocation();
  }, [requestLocation, isSuperAdmin]);

  const distFromHospital = location
    ? Math.round(distanceMeters(location.lat, location.lon, HOSPITAL_LOCATION.latitude, HOSPITAL_LOCATION.longitude))
    : null;
  const atHospital = location ? isAtHospital(location.lat, location.lon) : false;

  const handlePunch = async (type: 'in' | 'out') => {
    if (!location) {
      setMessage({ type: 'error', text: 'Please allow location access to punch in or out.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const updated = await punchAttendance(type, location.lat, location.lon);
      update('staff', updated.id, { attendance: updated.attendance });
      setMessage({
        type: 'success',
        text: type === 'in' ? 'Punched in successfully. Have a great shift!' : 'Punched out successfully. See you next time!',
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
      };
    });
  }, [db, filterDate]);

  const presentCount = dayRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length;
  const lateCount = dayRecords.filter((r) => r.status === 'Late').length;
  const absentCount = dayRecords.filter((r) => r.status === 'Absent' || r.status === 'No record').length;

  if (!db) return <Shell title="Attendance"><div className="text-sm text-ink/50">Loading...</div></Shell>;

  // Super Admin view
  if (isSuperAdmin) {
    return (
      <Shell title="Attendance" subtitle="View all staff attendance records" module="attendance">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <StatCard icon={CheckCircle2} label="Present" value={String(presentCount)} tone="plum" />
          <StatCard icon={Clock} label="Late" value={String(lateCount)} tone="amber" />
          <StatCard icon={AlertTriangle} label="Absent" value={String(absentCount)} tone="coral" />
          <StatCard icon={Clock} label="Total staff" value={String(db.staff.length)} tone="sky" />
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink">Attendance for {filterDate}</h3>
            <div className="flex items-center gap-2">
              <DateInput
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-40"
              />
              <Button variant="ghost" size="sm" onClick={() => setFilterDate(localDate())}>Today</Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink/50 uppercase tracking-wide">
                  <th className="py-2.5 px-3 font-medium">Staff</th>
                  <th className="py-2.5 px-3 font-medium">Role</th>
                  <th className="py-2.5 px-3 font-medium">Check In</th>
                  <th className="py-2.5 px-3 font-medium">Check Out</th>
                  <th className="py-2.5 px-3 font-medium">Hours</th>
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
                    <td className="py-2.5 px-3 text-ink/60">{r.hoursWorked ? `${r.hoursWorked}h` : '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        r.status === 'Present' ? 'bg-lilac text-plum' :
                        r.status === 'Late' ? 'bg-amber-100 text-amber-700' :
                        r.status === 'Absent' || r.status === 'No record' ? 'bg-coral/10 text-coral' :
                        r.status === 'On leave' ? 'bg-sky-100 text-sky-700' :
                        'bg-line text-ink/60'
                      }`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Shell>
    );
  }

  // Staff view: punch in / out
  return (
    <Shell title="Punch In / Out" subtitle="Mark your attendance" module="attendance">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
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
              {todayRecord?.hoursWorked ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-100 text-sky-700">
                  <Clock className="w-3.5 h-3.5" />
                  {todayRecord.hoursWorked}h worked
                </div>
              ) : null}
            </div>

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
                      <p className="text-xs text-ink/50 mt-0.5">{distFromHospital}m from the test location — you can punch in or out.</p>
                    </>
                  )}
                  {locationStatus === 'granted' && !atHospital && (
                    <>
                      <p className="text-sm font-medium text-amber-700">You are not at the hospital</p>
                      <p className="text-xs text-amber-700/80 mt-0.5">{distFromHospital}m from the test location. You need to arrive at the hospital to punch in or out.</p>
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
                disabled={busy || !atHospital || !punchedIn || punchedOut}
                onClick={() => handlePunch('out')}
                icon={LogOut}
                full
              >
                {punchedOut ? 'Already punched out' : 'Punch Out'}
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

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-ink mb-3">Recent Attendance</h3>
            {recentAttendance.length > 0 ? (
              <div className="space-y-1.5">
                {recentAttendance.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-canvas/50">
                    <span className="text-ink/70 font-medium">{a.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-ink/50">{a.checkIn || '—'} → {a.checkOut || '—'}</span>
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

        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-line flex items-center gap-2">
            <MapPin className="w-4 h-4 text-coral" />
            <h3 className="text-sm font-semibold text-ink">Hospital Location</h3>
          </div>
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d3720.9895543323564!2d72.83103907635667!3d21.15281398350394!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMjHCsDA5JzEwLjEiTiA3MsKwNTAnMDEuMCJF!5e0!3m2!1sen!2sin!4v1793790421365!5m2!1sen!2sin"
            width="100%"
            height="400"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            title="Hospital location"
          />
        </Card>
      </div>
    </Shell>
  );
}
