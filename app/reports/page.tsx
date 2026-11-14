'use client';

import { useEffect, useState } from 'react';
import { Eye, FileText, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { openPdfDataUrlInNewTab } from '../lib/report-pdf';
import { sendDocumentOnWhatsApp } from '../lib/whatsapp';
import Shell from '../components/Shell';
import { Badge, Button, Card, EmptyState, Modal, SectionTitle } from '../components/ui';
import ReportForm from '../components/report-form';
import { ListToolbar, Pagination, paginate } from '../components/list-controls';
import { useDB } from '../lib/store';
import { authFetch } from '../lib/auth';
import type { SavedReport } from '../lib/report-types';

const actionButton = 'w-10 h-10 rounded-lg flex items-center justify-center transition-colors hv-icon';

export default function ReportsPage() {
  const { db } = useDB();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loadError, setLoadError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SavedReport | null>(null);
  const [deleting, setDeleting] = useState<SavedReport | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [sendingId, setSendingId] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const term = search.trim().toLowerCase();
  const filtered = reports.filter((report) => {
    if (typeFilter && report.reportType !== typeFilter) return false;
    if (!term) return true;
    return (report.petSnapshot?.name ?? '').toLowerCase().includes(term) || (report.ownerSnapshot?.name ?? '').toLowerCase().includes(term);
  });
  const pageData = paginate(filtered, page);

  useEffect(() => {
    if (db?.reports) {
      setReports(db.reports);
    } else {
      authFetch('/reports')
        .then((data: SavedReport[]) => setReports(data))
        .catch(() => setLoadError('Could not load saved reports.'));
    }
  }, [db?.reports]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (report: SavedReport) => {
    setEditing(report);
    setFormOpen(true);
  };

  const sendOnWhatsApp = async (report: SavedReport) => {
    setSendingId(report.id);
    setNotice(null);
    try {
      await sendDocumentOnWhatsApp('reports', report.id);
      setNotice({ tone: 'ok', text: `The ${report.reportType} report was sent on WhatsApp.` });
    } catch (err) {
      setNotice({ tone: 'err', text: (err as Error).message || 'Could not send the report on WhatsApp.' });
    } finally {
      setSendingId('');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await authFetch(`/reports/${deleting.id}`, { method: 'DELETE' });
      setReports((current) => current.filter((report) => report.id !== deleting.id));
      setDeleting(null);
    } catch (err) {
      setDeleteError((err as Error).message || 'Could not delete the report.');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!db) return <Shell title="Diagnostic Reports"><div className="text-sm text-ink/50">Loading...</div></Shell>;

  return (
    <Shell title="Diagnostic Reports" subtitle="BIO and CBC reports generated from laboratory photos" module="reports">
      <Card className="p-5">
        <SectionTitle title="Generated reports" action={<Button onClick={openNew} icon={Plus}>Add report</Button>} />
        {loadError && <div className="mb-4 text-sm text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">{loadError}</div>}
        {notice && <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${notice.tone === 'ok' ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-coral bg-coral/10 border-coral/20'}`}>{notice.text}</div>}
        <ListToolbar
          search={search}
          onSearch={(value) => { setSearch(value); setPage(1); }}
          searchPlaceholder="Search by pet or owner"
          filter={typeFilter}
          onFilter={(value) => { setTypeFilter(value); setPage(1); }}
          filterLabel="types"
          filterOptions={[{ value: 'BIO', label: 'BIO' }, { value: 'CBC', label: 'CBC' }]}
        />
        <div className="overflow-x-auto border border-line rounded-xl">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-canvas text-ink/55 text-xs">
              <tr>
                <th className="text-left p-3">Created</th>
                <th className="text-left p-3">Pet</th>
                <th className="text-left p-3">Owner</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Results</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageData.rows.map((report) => <tr key={report.id} className="border-t border-line hover:bg-canvas/60 transition-colors">
                <td className="p-3 text-ink/70">{new Date(report.createdAt).toLocaleString()}</td>
                <td className="p-3 font-medium text-ink">{report.petSnapshot?.name || '—'}</td>
                <td className="p-3 text-ink/70">{report.ownerSnapshot?.name || '—'}</td>
                <td className="p-3"><Badge status={report.reportType} /></td>
                <td className="p-3 text-ink/70">{report.analytes?.length ?? 0}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-2">
                    {report.pdfData && <button onClick={() => sendOnWhatsApp(report)} disabled={sendingId === report.id} title="Send PDF on WhatsApp" aria-label="Send PDF on WhatsApp" className={`${actionButton} text-emerald-700 hover:bg-emerald-50 disabled:opacity-50`}><MessageCircle className="w-5 h-5" /></button>}
                    {report.pdfData && <button onClick={() => openPdfDataUrlInNewTab(report.pdfData)} title="Open PDF" aria-label="Open PDF" className={`${actionButton} text-plum hover:bg-lilac`}><Eye className="w-5 h-5" /></button>}
                    <button onClick={() => openEdit(report)} title="Edit report" aria-label="Edit report" className={`${actionButton} text-sky-700 hover:bg-sky-50`}><Pencil className="w-5 h-5" /></button>
                    <button onClick={() => { setDeleteError(''); setDeleting(report); }} title="Delete report" aria-label="Delete report" className={`${actionButton} text-coral hover:bg-coral/10`}><Trash2 className="w-5 h-5" /></button>
                  </div>
                </td>
              </tr>)}
            </tbody>
          </table>
          {!reports.length && !loadError && <EmptyState icon={FileText} title="No reports yet" hint="Use Add report to create your first BIO or CBC report." />}
          {reports.length > 0 && !filtered.length && <div className="p-6 text-center text-sm text-ink/50">No reports match your search or filter.</div>}
        </div>
        <Pagination page={pageData.page} totalPages={pageData.totalPages} total={pageData.total} onPage={setPage} />
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit diagnostic report' : 'New diagnostic report'} wide>
        <ReportForm
          key={editing?.id ?? 'new'}
          owners={db.owners}
          pets={db.pets}
          report={editing}
          onSaved={(saved) => {
            setReports((current) => (editing ? current.map((report) => (report.id === saved.id ? saved : report)) : [saved, ...current]));
            setFormOpen(false);
          }}
        />
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete report">
        <p className="text-sm text-ink/70">Delete the {deleting?.reportType} report for {deleting?.petSnapshot?.name || 'this pet'}? This cannot be undone.</p>
        {deleteError && <div className="mt-4 text-sm text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">{deleteError}</div>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button onClick={confirmDelete} disabled={deleteBusy} icon={Trash2}>{deleteBusy ? 'Deleting...' : 'Delete report'}</Button>
        </div>
      </Modal>
    </Shell>
  );
}
