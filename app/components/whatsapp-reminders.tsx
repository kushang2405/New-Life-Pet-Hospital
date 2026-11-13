'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { authFetch } from '../lib/auth';
import { Button, Card, EmptyState, Modal } from './ui';

type ReminderStats = {
  totalSent: number;
  sentLast24h: number;
  pending: number;
  recent: { id: string; ownerName: string; petName: string; date: string; time: string; sentAt: string; whatsappStatus: string; whatsappError: string }[];
};

type ReminderLog = {
  id: string;
  createdAt: string;
  event: 'sent' | 'failed' | 'status';
  status: string;
  error: string;
  ownerName: string;
  petName: string;
  recipient: string;
  messageId: string;
};

const EVENT_LABEL: Record<ReminderLog['event'], string> = {
  sent: 'Sent to WhatsApp',
  failed: 'Failed',
  status: 'Delivery update',
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
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState('');

  function loadStats() {
    Promise.all([authFetch('/whatsapp/reminder-stats'), authFetch('/whatsapp/logs')])
      .then(([statsData, logData]: [ReminderStats, { logs: ReminderLog[] }]) => {
        setStats(statsData);
        setLogs(logData.logs);
      })
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

  if (error) return <Card className="p-5"><div className="text-sm text-coral">{error}</div></Card>;
  if (!stats) return <Card className="p-5"><div className="text-sm text-ink/50">Loading...</div></Card>;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        {runMessage && <span className="mr-auto text-sm text-ink/70">{runMessage}</span>}
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>Preview reminder</Button>
        <Button size="sm" onClick={runDueReminders} disabled={running}>{running ? 'Sending...' : 'Send due reminders now'}</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <StatTile label="Accepted by WhatsApp" value={stats.totalSent} tone="text-emerald-700" />
        <StatTile label="Accepted in last 24 hours" value={stats.sentLast24h} tone="text-plum" />
        <StatTile label="Waiting to send" value={stats.pending} tone="text-ink" />
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-3">
        <MessageCircle className="w-4 h-4 text-emerald-700" /> Recent reminders
      </div>
      <div className="overflow-x-auto border border-line rounded-xl">
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
              <tr key={r.id} className="border-t border-line">
                <td className="p-3 text-ink/70">{new Date(r.sentAt).toLocaleString()}</td>
                <td className="p-3 text-ink">{r.ownerName || '—'}</td>
                <td className="p-3 text-ink/70">{r.petName || '—'}</td>
                <td className="p-3 text-ink/70">{r.date} at {r.time}</td>
                <td className="p-3"><span className={`text-xs font-medium capitalize ${r.whatsappStatus === 'failed' ? 'text-coral' : r.whatsappStatus === 'delivered' || r.whatsappStatus === 'read' ? 'text-emerald-700' : 'text-amber-700'}`}>{r.whatsappStatus || 'accepted'}</span>{r.whatsappError && <div className="text-[10px] text-coral mt-1">{r.whatsappError}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!stats.recent.length && <EmptyState icon={MessageCircle} title="No reminders accepted yet" hint="Reminders are sent automatically 24 hours before each appointment." />}
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold text-ink mt-6 mb-3">
        <MessageCircle className="w-4 h-4 text-plum" /> Delivery log
      </div>
      <div className="overflow-x-auto border border-line rounded-xl">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-canvas text-ink/55 text-xs">
            <tr>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Event</th>
              <th className="text-left p-3">Owner / Pet</th>
              <th className="text-left p-3">Recipient</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Message ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="p-3 text-ink/70 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="p-3 text-ink">{EVENT_LABEL[l.event]}</td>
                <td className="p-3 text-ink/70">{[l.ownerName, l.petName].filter(Boolean).join(' / ') || '—'}</td>
                <td className="p-3 text-ink/70">{l.recipient || '—'}</td>
                <td className="p-3">
                  <span className={`text-xs font-medium capitalize ${l.status === 'failed' ? 'text-coral' : l.status === 'delivered' || l.status === 'read' ? 'text-emerald-700' : 'text-amber-700'}`}>{l.status || '—'}</span>
                  {l.error && <div className="text-[10px] text-coral mt-1">{l.error}</div>}
                </td>
                <td className="p-3 text-[10px] text-ink/50 font-mono">{l.messageId || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs.length && <EmptyState icon={MessageCircle} title="No activity yet" hint="Every reminder attempt and WhatsApp delivery update will be logged here." />}
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
    </Card>
  );
}
