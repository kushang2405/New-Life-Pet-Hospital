'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { authFetch } from '../lib/auth';
import { Button, Card, EmptyState, Field, Input, Modal } from './ui';

type ReminderStats = {
  totalSent: number;
  sentLast24h: number;
  pending: number;
  lastRun?: {
    lastRunAt: string;
    source: 'interval' | 'vps-cron' | 'manual';
    dueCount: number;
    sentCount: number;
    errorsCount: number;
    durationMs: number;
  } | null;
  recent: { id: string; ownerName: string; petName: string; date: string; time: string; sentAt: string; whatsappStatus: string; whatsappError: string }[];
};

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/55">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

const SAMPLE_REMINDER = {
  owner: 'Sample Owner',
  pet: 'Buddy',
  date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  time: '10:30',
};

export default function WhatsAppReminders() {
  const [stats, setStats] = useState<ReminderStats | null>(null);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState('');

  const [statusOpen, setStatusOpen] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [metaStatus, setMetaStatus] = useState<any>(null);

  async function checkMetaStatus() {
    setCheckingStatus(true);
    setStatusOpen(true);
    try {
      const data = await authFetch('/whatsapp/templates/status');
      setMetaStatus(data);
    } catch (err) {
      setMetaStatus({ success: false, error: (err as Error).message });
    } finally {
      setCheckingStatus(false);
    }
  }

  const [testOpen, setTestOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testOwner, setTestOwner] = useState('Dr. Arshi Vala');
  const [testPet, setTestPet] = useState('Buddy');
  const [testTime, setTestTime] = useState('tomorrow at 10:30 AM');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ tone: 'ok' | 'err'; message: string } | null>(null);

  function loadStats() {
    authFetch('/whatsapp/reminder-stats')
      .then((data: ReminderStats) => setStats(data))
      .catch((err: Error) => setError(err.message || 'Could not load WhatsApp reminder activity.'));
  }

  useEffect(() => {
    loadStats();
  }, []);

  async function runDueReminders() {
    setRunning(true);
    setRunMessage('');
    try {
      const result: { due: number; sent: number; errors: string[] } = await authFetch('/whatsapp/reminders/run', { method: 'POST' });
      if (!result.due) setRunMessage('No appointments are due for a reminder right now.');
      else if (result.errors.length) setRunMessage(`Sent ${result.sent} of ${result.due}. Problem: ${result.errors[0]}`);
      else setRunMessage(`Sent ${result.sent} reminder(s).`);
      loadStats();
    } catch (err) {
      setRunMessage((err as Error).message || 'Could not send reminders.');
    } finally {
      setRunning(false);
    }
  }

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await authFetch('/whatsapp/reminders/test', {
        method: 'POST',
        body: JSON.stringify({
          phone: testPhone,
          ownerName: testOwner,
          petName: testPet,
          dateTime: testTime,
        }),
      });
      setTestResult({
        tone: 'ok',
        message: `Test reminder sent successfully to ${res.to}! (Message ID: ${res.messageId || 'accepted'})`,
      });
      loadStats();
    } catch (err) {
      setTestResult({
        tone: 'err',
        message: (err as Error).message || 'Failed to send test reminder.',
      });
    } finally {
      setTestSending(false);
    }
  }

  if (error) return <Card className="p-5"><div className="text-sm text-coral">{error}</div></Card>;
  if (!stats) return <Card className="p-5"><div className="text-sm text-ink/50">Loading...</div></Card>;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        {runMessage && <span className="mr-auto text-sm text-ink/70">{runMessage}</span>}
        {/* Commented per user request:
        <Button variant="outline" size="sm" onClick={checkMetaStatus} disabled={checkingStatus}>
          {checkingStatus ? 'Checking...' : 'Check Meta templates'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>Preview reminder</Button>
        <Button variant="outline" size="sm" onClick={() => { setTestOpen(true); setTestResult(null); }}>Send test reminder</Button>
        */}
        {/* <Button size="sm" onClick={runDueReminders} disabled={running}>{running ? 'Sending...' : 'Send due reminders now'}</Button> */}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <StatTile label="Accepted by WhatsApp" value={stats.totalSent} tone="text-emerald-700" />
        <StatTile label="Accepted in last 24 hours" value={stats.sentLast24h} tone="text-plum" />
        <StatTile label="Waiting to send" value={stats.pending} tone="text-ink" />
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-3">
        <MessageCircle className="w-4 h-4 text-emerald-700" /> Recent reminders
      </div>

      {/* Mobile Card View (screens < md) */}
      <div className="block md:hidden border border-line rounded-xl divide-y divide-line overflow-hidden bg-white mb-4">
        {stats.recent.map((r) => (
          <div key={r.id} className="p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink text-sm">{r.petName || 'Pet'}</span>
              <span className={`text-[11px] font-semibold capitalize px-2 py-0.5 rounded-full ${
                r.whatsappStatus === 'failed'
                  ? 'bg-coral/15 text-coral'
                  : r.whatsappStatus === 'delivered' || r.whatsappStatus === 'read'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}>
                {r.whatsappStatus || 'accepted'}
              </span>
            </div>
            <div className="text-xs text-ink/70">
              <span className="text-ink/40">Owner:</span> {r.ownerName || '—'}
            </div>
            <div className="text-xs text-ink/70">
              <span className="text-ink/40">Appointment:</span> <strong className="text-ink">{r.date}</strong> at {r.time}
            </div>
            <div className="text-[11px] text-ink/45 pt-0.5">
              Sent: {new Date(r.sentAt).toLocaleString()}
            </div>
            {r.whatsappError && <div className="text-[10px] text-coral mt-1">{r.whatsappError}</div>}
          </div>
        ))}
        {!stats.recent.length && <EmptyState icon={MessageCircle} title="No reminders accepted yet" hint="Reminders are sent automatically 24 hours before each appointment." />}
      </div>

      {/* Desktop Table View (screens >= md) */}
      <div className="hidden md:block overflow-x-auto border border-line rounded-xl">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-canvas text-ink/55 text-xs">
            <tr>
              <th className="text-left p-3">Sent at</th>
              <th className="text-left p-3">Owner</th>
              <th className="text-left p-3">Pet</th>
              <th className="text-left p-3">Appointment</th>
              <th className="text-left p-3">Delivery</th>
            </tr>
          </thead>
          <tbody>
            {stats.recent.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-canvas/40 transition-colors">
                <td className="p-3 text-ink/70">{new Date(r.sentAt).toLocaleString()}</td>
                <td className="p-3 text-ink font-medium">{r.ownerName || '—'}</td>
                <td className="p-3 text-ink/70">{r.petName || '—'}</td>
                <td className="p-3 text-ink/70">{r.date} at {r.time}</td>
                <td className="p-3"><span className={`text-xs font-medium capitalize ${r.whatsappStatus === 'failed' ? 'text-coral' : r.whatsappStatus === 'delivered' || r.whatsappStatus === 'read' ? 'text-emerald-700' : 'text-amber-700'}`}>{r.whatsappStatus || 'accepted'}</span>{r.whatsappError && <div className="text-[10px] text-coral mt-1">{r.whatsappError}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!stats.recent.length && <EmptyState icon={MessageCircle} title="No reminders accepted yet" hint="Reminders are sent automatically 24 hours before each appointment." />}
      </div>
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Reminder preview">
        <div className="space-y-4">
          <p className="text-xs text-ink/60">This is how the 24-hour reminder reads to the owner. The names and times below are examples; each real reminder uses that appointment's details.</p>
          <div className="rounded-xl border border-line bg-canvas p-4 text-sm leading-relaxed text-ink">
            {`Hello ${SAMPLE_REMINDER.owner}, this is a reminder that ${SAMPLE_REMINDER.pet} has an appointment tomorrow, ${SAMPLE_REMINDER.date} at ${SAMPLE_REMINDER.time}. Please reply to this message if you need to reschedule. See you soon!`}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      <Modal open={testOpen} onClose={() => setTestOpen(false)} title="Send test reminder">
        <form onSubmit={handleSendTest} className="space-y-3">
          <p className="text-xs text-ink/60">
            Send an instant test WhatsApp message to verify that your Meta WhatsApp API credentials and the{' '}
            <code className="bg-canvas px-1 py-0.5 rounded text-plum font-semibold">appointment_reminder_24h</code> template are active.
          </p>
          <Field label="WhatsApp phone number (with country code, e.g. 919876543210)">
            <Input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="919876543210"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner name ({{1}})">
              <Input value={testOwner} onChange={(e) => setTestOwner(e.target.value)} />
            </Field>
            <Field label="Pet name ({{2}})">
              <Input value={testPet} onChange={(e) => setTestPet(e.target.value)} />
            </Field>
          </div>
          <Field label="Appointment date & time ({{3}})">
            <Input value={testTime} onChange={(e) => setTestTime(e.target.value)} />
          </Field>

          {testResult && (
            <div
              className={`text-xs p-3 rounded-lg border ${
                testResult.tone === 'ok'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-coral/10 text-coral border-coral/20'
              }`}
            >
              {testResult.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setTestOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={testSending || !testPhone.trim()}>
              {testSending ? 'Sending...' : 'Send test now'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Meta WhatsApp Templates Status">
        <div className="space-y-4">
          {checkingStatus ? (
            <div className="text-sm text-ink/60 py-4 text-center">Contacting Meta Graph API...</div>
          ) : !metaStatus ? (
            <div className="text-sm text-ink/60">No data available.</div>
          ) : !metaStatus.success ? (
            <div className="rounded-xl border border-coral/30 bg-coral/10 p-3 text-xs text-coral">
              <strong>Error checking Meta templates:</strong> {metaStatus.error || 'Failed to fetch templates from Meta.'}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-ink/70 flex justify-between border-b border-line pb-2">
                <span>Account Phone: <strong>{metaStatus.phone || 'Connected'}</strong></span>
                <span>WABA ID: <strong>{metaStatus.wabaId || '—'}</strong></span>
              </div>
              <div className="text-xs font-semibold text-ink">Required Hospital Templates:</div>
              <div className="space-y-2">
                {(metaStatus.expectedTemplates || []).map((t: any) => {
                  const isApproved = t.variants?.some((v: any) => v.status === 'APPROVED' || v.status === 'ACTIVE');
                  const isPending = t.variants?.some((v: any) => v.status === 'PENDING' || v.status === 'IN_REVIEW');
                  const isRejected = t.variants?.some((v: any) => v.status === 'REJECTED');
                  return (
                    <div key={t.key} className="flex items-center justify-between p-2.5 rounded-lg border border-line bg-canvas">
                      <div>
                        <div className="font-mono text-xs font-medium text-ink">{t.expectedName}</div>
                        <div className="text-[10px] text-ink/50 capitalize">
                          {t.key === 'reminder' ? 'Appointment Reminder (24h)' : t.key === 'report' ? 'Diagnostic Report (PDF)' : 'Certificate (PDF)'}
                          {t.variants?.length ? ` • Lang: ${t.variants.map((v: any) => v.language).join(', ')}` : ''}
                        </div>
                      </div>
                      <div>
                        {isApproved ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Approved ✓
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                            In Review / Pending ⏳
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                            Rejected ✗
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                            Not Found in WABA
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {metaStatus.templates?.length > 0 && (
                <div className="pt-2 text-[11px] text-ink/60 border-t border-line mt-3">
                  <div className="font-semibold text-ink/70 mb-1">Templates active in WABA {metaStatus.wabaId} ({metaStatus.allTemplatesCount} total):</div>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {metaStatus.templates.map((tpl: any) => (
                      <span key={tpl.name} className="px-1.5 py-0.5 rounded bg-line/60 font-mono text-[10px] text-ink">
                        {tpl.name} ({tpl.language}: {tpl.status})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={checkMetaStatus} disabled={checkingStatus}>
              Refresh
            </Button>
            <Button size="sm" onClick={() => setStatusOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
