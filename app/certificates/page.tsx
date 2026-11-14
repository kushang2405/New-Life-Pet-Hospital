'use client';

import { useEffect, useState } from 'react';
import { Building2, Eye, FileBadge, MessageCircle, Plus, Trash2 } from 'lucide-react';
import Shell from '../components/Shell';
import { Button, Card, EmptyState, Modal, SectionTitle } from '../components/ui';
import CertificateForm from '../components/certificate-form';
import LetterheadForm from '../components/letterhead-form';
import { ListToolbar, Pagination, paginate } from '../components/list-controls';
import { useDB } from '../lib/store';
import { authFetch } from '../lib/auth';
import { fetchLetterhead } from '../lib/certificate-letterhead';
import { CERTIFICATE_TYPES, DEFAULT_LETTERHEAD, type CertificateSummary, type LetterheadSettings, type SavedCertificate } from '../lib/certificate-templates';
import { openPdfDataUrlInNewTab } from '../lib/report-pdf';
import { sendDocumentOnWhatsApp } from '../lib/whatsapp';

const actionButton = 'w-10 h-10 rounded-lg flex items-center justify-center transition-colors hv-icon';

export default function CertificatesPage() {
  const { db } = useDB();
  const [certificates, setCertificates] = useState<CertificateSummary[]>([]);
  const [letterhead, setLetterhead] = useState<LetterheadSettings>(DEFAULT_LETTERHEAD);
  const [loadError, setLoadError] = useState('');
  const [openError, setOpenError] = useState('');
  const [openingId, setOpeningId] = useState('');
  const [sendingId, setSendingId] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [letterheadOpen, setLetterheadOpen] = useState(false);
  const [deleting, setDeleting] = useState<CertificateSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const term = search.trim().toLowerCase();
  const filtered = certificates.filter((certificate) => {
    if (typeFilter && certificate.certificateType !== typeFilter) return false;
    if (!term) return true;
    return [certificate.petName, certificate.ownerName, certificate.certificateNo].some((value) => (value ?? '').toLowerCase().includes(term));
  });
  const pageData = paginate(filtered, page);

  useEffect(() => {
    if (db?.certificates) {
      setCertificates(db.certificates);
    } else {
      authFetch('/certificates')
        .then((data: CertificateSummary[]) => setCertificates(data))
        .catch(() => setLoadError('Could not load saved certificates.'));
    }
    fetchLetterhead().then(setLetterhead).catch(() => {});
  }, [db?.certificates]);

  const openCertificate = async (id: string) => {
    setOpeningId(id);
    setOpenError('');
    try {
      const full = await authFetch(`/certificates/${id}`) as SavedCertificate;
      if (!full.pdfData) throw new Error('This certificate has no PDF saved.');
      openPdfDataUrlInNewTab(full.pdfData);
    } catch (err) {
      setOpenError((err as Error).message || 'Could not open the certificate.');
    } finally {
      setOpeningId('');
    }
  };

  const sendOnWhatsApp = async (certificate: CertificateSummary) => {
    setSendingId(certificate.id);
    setNotice(null);
    try {
      await sendDocumentOnWhatsApp('certificates', certificate.id);
      setNotice({ tone: 'ok', text: `The ${certificate.certificateType} certificate was sent on WhatsApp.` });
    } catch (err) {
      setNotice({ tone: 'err', text: (err as Error).message || 'Could not send the certificate on WhatsApp.' });
    } finally {
      setSendingId('');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await authFetch(`/certificates/${deleting.id}`, { method: 'DELETE' });
      setCertificates((current) => current.filter((certificate) => certificate.id !== deleting.id));
      setDeleting(null);
    } catch (err) {
      setDeleteError((err as Error).message || 'Could not delete the certificate.');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!db) return <Shell title="Certificates"><div className="text-sm text-ink/50">Loading...</div></Shell>;

  return (
    <Shell title="Certificates" subtitle="Microchip, spaying, castration and health certificates" module="certificates">
      <Card className="p-5">
        <SectionTitle
          title="Issued certificates"
          action={
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setLetterheadOpen(true)} icon={Building2}>Letterhead</Button>
              <Button onClick={() => setAddOpen(true)} icon={Plus}>Add certificate</Button>
            </div>
          }
        />
        {loadError && <div className="mb-4 text-sm text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">{loadError}</div>}
        {openError && <div className="mb-4 text-sm text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">{openError}</div>}
        {notice && <div className={`mb-4 text-sm rounded-lg px-3 py-2 border ${notice.tone === 'ok' ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-coral bg-coral/10 border-coral/20'}`}>{notice.text}</div>}
        <ListToolbar
          search={search}
          onSearch={(value) => { setSearch(value); setPage(1); }}
          searchPlaceholder="Search by pet, owner or number"
          filter={typeFilter}
          onFilter={(value) => { setTypeFilter(value); setPage(1); }}
          filterLabel="types"
          filterOptions={CERTIFICATE_TYPES.map((type) => ({ value: type, label: type }))}
        />
        <div className="overflow-x-auto border border-line rounded-xl">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-canvas text-ink/55 text-xs">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Certificate No</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Pet</th>
                <th className="text-left p-3">Owner</th>
                <th className="text-left p-3">Header</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageData.rows.map((certificate) => <tr key={certificate.id} className="border-t border-line hover:bg-canvas/60 transition-colors">
                <td className="p-3 text-ink/70">{certificate.certificateDate}</td>
                <td className="p-3 text-ink/70">{certificate.certificateNo}</td>
                <td className="p-3 font-medium text-ink">{certificate.certificateType}</td>
                <td className="p-3 text-ink/70">{certificate.petName}</td>
                <td className="p-3 text-ink/70">{certificate.ownerName}</td>
                <td className="p-3 text-ink/70">{certificate.includeHeader ? 'With header' : 'Without header'}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => sendOnWhatsApp(certificate)} disabled={sendingId === certificate.id} title="Send PDF on WhatsApp" aria-label="Send PDF on WhatsApp" className={`${actionButton} text-emerald-700 hover:bg-emerald-50 disabled:opacity-50`}><MessageCircle className="w-5 h-5" /></button>
                    <button onClick={() => openCertificate(certificate.id)} disabled={openingId === certificate.id} title="Open PDF" aria-label="Open PDF" className={`${actionButton} text-plum hover:bg-lilac disabled:opacity-50`}><Eye className="w-5 h-5" /></button>
                    <button onClick={() => { setDeleteError(''); setDeleting(certificate); }} title="Delete certificate" aria-label="Delete certificate" className={`${actionButton} text-coral hover:bg-coral/10`}><Trash2 className="w-5 h-5" /></button>
                  </div>
                </td>
              </tr>)}
            </tbody>
          </table>
          {!certificates.length && !loadError && <EmptyState icon={FileBadge} title="No certificates yet" hint="Use Add certificate to issue your first certificate." />}
          {certificates.length > 0 && !filtered.length && <div className="p-6 text-center text-sm text-ink/50">No certificates match your search or filter.</div>}
        </div>
        <Pagination page={pageData.page} totalPages={pageData.totalPages} total={pageData.total} onPage={setPage} />
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New certificate" wide>
        <CertificateForm
          owners={db.owners}
          pets={db.pets}
          letterhead={letterhead}
          onSaved={(saved) => {
            setCertificates((current) => [saved, ...current]);
            setAddOpen(false);
          }}
        />
      </Modal>

      <Modal open={letterheadOpen} onClose={() => setLetterheadOpen(false)} title="Certificate letterhead" wide>
        <LetterheadForm
          letterhead={letterhead}
          onSaved={(saved) => {
            setLetterhead(saved);
            setLetterheadOpen(false);
          }}
        />
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete certificate">
        <p className="text-sm text-ink/70">Delete the {deleting?.certificateType} certificate {deleting?.certificateNo} for {deleting?.petName || 'this pet'}? This cannot be undone.</p>
        {deleteError && <div className="mt-4 text-sm text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">{deleteError}</div>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button onClick={confirmDelete} disabled={deleteBusy} icon={Trash2}>{deleteBusy ? 'Deleting...' : 'Delete certificate'}</Button>
        </div>
      </Modal>
    </Shell>
  );
}
