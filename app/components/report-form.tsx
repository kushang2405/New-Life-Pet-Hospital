'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileImage, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { Button, DateInput, EmptyState, Field, Input, Select, Textarea } from './ui';
import { authFetch, ocrFetch } from '../lib/auth';
import { fetchLetterhead } from '../lib/certificate-letterhead';
import { compressReportImage } from '../lib/report-images';
import { applyCbcReferenceRanges, formatPetAge } from '../lib/report-parser';
import { createReportPdf, openPdfBlobInNewTab } from '../lib/report-pdf';
import type { OcrExtractResult, PatientDetails, ReportAnalyte, ReportDraft, ReportType, SavedReport } from '../lib/report-types';
import type { Owner, Pet } from '../lib/api';

type Props = { owners: Owner[]; pets: Pet[]; report?: SavedReport | null; onSaved: (report: SavedReport) => void };

const emptyDetails: PatientDetails = {
  sampleNo: '', date: new Date().toISOString().slice(0, 10), ageGender: '', registeredOn: '',
  sampleType: '', referredBy: '', doctorName: 'Dr. Arshi K. Vala', doctorPosition: 'M.V.Sc (SURGERY & RADIOLOGY)', uhid: '',
};

const defaultSection = (type: ReportType) => (type === 'CBC' ? 'CBC' : 'Kidney Profile');
const applyReferenceRanges = (rows: ReportAnalyte[], type: ReportType) => type === 'CBC' ? applyCbcReferenceRanges(rows) : rows;
const emptyRow = (type: ReportType): ReportAnalyte => ({ section: defaultSection(type), name: '', result: '', unit: '', referenceRange: '', remarks: '' });

const MAX_PHOTOS = 10;

export default function ReportForm({ owners, pets, report, onSaved }: Props) {
  const [reportType, setReportType] = useState<ReportType>(report?.reportType ?? 'BIO');
  const [ownerId, setOwnerId] = useState(report?.ownerId ?? '');
  const [petId, setPetId] = useState(report?.petId ?? '');
  const [details, setDetails] = useState<PatientDetails>(report?.patientDetails ?? emptyDetails);
  const [rows, setRows] = useState<ReportAnalyte[]>(report?.analytes ?? []);
  const [imageName, setImageName] = useState(report?.sourceImageName ?? '');
  const [logoDataUrl, setLogoDataUrl] = useState(report?.logoData ?? '');
  const [ocrText, setOcrText] = useState(report?.ocrText ?? '');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedOwner = owners.find((owner) => owner.id === ownerId);
  const ownerPets = useMemo(() => pets.filter((pet) => pet.ownerId === ownerId), [pets, ownerId]);
  const selectedPet = ownerPets.find((pet) => pet.id === petId);

  useEffect(() => {
    if (!ownerId && owners[0]) setOwnerId(owners[0].id);
  }, [ownerId, owners]);

  useEffect(() => {
    if (report?.logoData) return;
    fetchLetterhead()
      .then((letterhead) => setLogoDataUrl(letterhead.logoDataUrl))
      .catch(() => setError('Could not load the clinic logo from certificate settings.'));
  }, [report?.logoData]);

  useEffect(() => {
    if (ownerPets.length && !ownerPets.some((pet) => pet.id === petId)) setPetId(ownerPets[0].id);
    if (!ownerPets.length) setPetId('');
  }, [ownerPets, petId]);

  useEffect(() => {
    if (!selectedPet?.birthDate) return;
    const reportDate = new Date(`${details.date || new Date().toISOString().slice(0, 10)}T00:00:00`);
    const age = formatPetAge(selectedPet.birthDate, reportDate);
    setDetails((current) => ({ ...current, ageGender: age }));
  }, [selectedPet?.birthDate, details.date]);

  const updateDetails = (key: keyof PatientDetails, value: string) => setDetails((current) => ({ ...current, [key]: value }));
  const updateRow = (index: number, key: keyof ReportAnalyte, value: string) => {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value, needsReview: false } : row)));
  };

  const addPhotos = (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;
    setError('');
    setPhotos((current) => [...current, ...files].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (index: number) => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));

  const readPhotos = async () => {
    if (!photos.length) return;
    setError('');
    setNotice('');
    setOcrBusy(true);
    try {
      const images = await Promise.all(photos.map(async (file) => ({ name: file.name, dataUrl: await compressReportImage(file) })));
      let result: OcrExtractResult;
      try {
        result = await ocrFetch('/extract', { method: 'POST', body: JSON.stringify({ reportType, images }) }) as OcrExtractResult;
      } catch (firstErr) {
        // Automatic retry once for transient network or cloud hiccups
        result = await ocrFetch('/extract', { method: 'POST', body: JSON.stringify({ reportType, images }) }) as OcrExtractResult;
      }
      setImageName(photos.map((file) => file.name).join(' · '));
      setOcrText(result.rawText);
      setRows(result.rows.length ? applyReferenceRanges(result.rows, reportType) : [emptyRow(reportType)]);
      const summary = `${result.rows.length} result rows read from ${photos.length} image${photos.length === 1 ? '' : 's'}.`;
      setNotice([summary, ...result.warnings].join(' '));
    } catch (err) {
      setError((err as Error).message || 'Could not read the uploaded images. Please try again.');
    } finally {
      setOcrBusy(false);
    }
  };

  const resetResults = () => {
    setPhotos([]);
    setRows([]);
    setDetails(emptyDetails);
    setImageName('');
    setOcrText('');
    setError('');
    setNotice('');
  };

  const generateAndSave = async () => {
    if (!selectedOwner || !selectedPet) {
      setError('Select both an owner and a pet before generating the report.');
      return;
    }
    const analytes = rows.filter((row) => row.name.trim() || row.result.trim());
    setSaveBusy(true);
    setError('');
    try {
      const title = `${selectedPet.name}-${reportType}`;
      const draft: ReportDraft = {
        reportType,
        title,
        owner: selectedOwner,
        pet: selectedPet,
        patientDetails: details,
        analytes: applyReferenceRanges(analytes, reportType),
        logoDataUrl: logoDataUrl || undefined,
      };
      const pdf = createReportPdf(draft);
      const pdfData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not prepare the PDF for storage'));
        reader.readAsDataURL(pdf);
      });
      const saved = await authFetch(report ? `/reports/${report.id}` : '/reports', {
        method: report ? 'PUT' : 'POST',
        body: JSON.stringify({
          reportType,
          title,
          ownerId: selectedOwner.id,
          petId: selectedPet.id,
          ownerSnapshot: { id: selectedOwner.id, name: selectedOwner.name, phone: selectedOwner.phone, email: selectedOwner.email, address: selectedOwner.address },
          petSnapshot: { id: selectedPet.id, ownerId: selectedPet.ownerId, name: selectedPet.name, species: selectedPet.species, breed: selectedPet.breed, gender: selectedPet.gender, birthDate: selectedPet.birthDate, weightKg: selectedPet.weightKg },
          patientDetails: details,
          analytes: applyReferenceRanges(analytes, reportType),
          ocrText,
          sourceImageName: imageName,
          pdfData,
          logoData: logoDataUrl,
        }),
      }) as SavedReport;
      openPdfBlobInNewTab(pdf);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message || 'Could not save the report.');
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Field label="Report type">
          <Select value={reportType} onChange={(event) => { const nextType = event.target.value as ReportType; setReportType(nextType); setRows((current) => applyReferenceRanges(current, nextType)); }}>
            <option value="BIO">BIO</option>
            <option value="CBC">CBC</option>
          </Select>
        </Field>
        <Field label="Owner">
          <Select value={ownerId} onChange={(event) => { setOwnerId(event.target.value); setPetId(''); }}>
            <option value="">Select owner</option>
            {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
          </Select>
        </Field>
        <Field label="Pet">
          <Select value={petId} onChange={(event) => setPetId(event.target.value)} disabled={!ownerId}>
            <option value="">Select pet</option>
            {ownerPets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
          </Select>
        </Field>
      </div>

      {selectedOwner && selectedPet && (
        <div className="rounded-xl bg-canvas/70 border border-line p-4 mb-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><span className="text-ink/40 block">Owner</span><span className="font-medium text-ink">{selectedOwner.name}</span></div>
          <div><span className="text-ink/40 block">Phone</span><span className="font-medium text-ink">{selectedOwner.phone || '—'}</span></div>
          <div><span className="text-ink/40 block">Pet</span><span className="font-medium text-ink">{selectedPet.name}</span></div>
          <div><span className="text-ink/40 block">Species / breed</span><span className="font-medium text-ink">{selectedPet.species} / {selectedPet.breed || '—'}</span></div>
        </div>
      )}

      <div className="grid gap-3 mb-5">
        <Field label="Report photos" className="rounded-xl border border-line bg-canvas/60  p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2 min-w-0">
              <label className="flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg border border-dashed border-plum/35 bg-lilac/30 text-sm text-plum cursor-pointer hover:bg-lilac transition-colors">
                <Upload className="w-4 h-4" />
                Add photos
                <input className="sr-only" type="file" accept="image/*" multiple onChange={(event) => { addPhotos(event.target.files); event.target.value = ''; }} />
              </label>
            </div>
            <div className="flex flex-col justify-between gap-2">
              <Button onClick={readPhotos} disabled={!photos.length || ocrBusy} icon={ocrBusy ? Loader2 : FileImage}>{ocrBusy ? 'Reading photos...' : 'Read photos into table'}</Button>
            </div>
          </div>
              {photos.length ? (
                <ul className="flex my-4 gap-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {photos.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-white border border-line px-2.5 py-1.5 text-xs text-ink">
                      <span className="flex items-center gap-1.5 min-w-0"><FileImage className="w-3.5 h-3.5 shrink-0 text-plum" /><span className="truncate">{file.name}</span></span>
                      <button onClick={() => removePhoto(index)} className="text-ink/35 hover:text-coral shrink-0" aria-label={`Remove ${file.name}`}><X className="w-3.5 h-3.5" /></button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-ink/45">No photos added yet. Add them one at a time or select several.</p>}
              <p className="text-xs text-ink/55">{photos.length} of {MAX_PHOTOS} photos added</p>
        </Field>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Field label="Report date"><DateInput value={details.date} onChange={(event) => updateDetails('date', event.target.value)} /></Field>
        {([['sampleNo', 'Sample no'], ['ageGender', 'Age from pet record'], ['sampleType', 'Sample type'], ['referredBy', 'Referred by'], ['doctorName', 'Doctor name'], ['doctorPosition', 'Doctor position']] as const).map(([key, label]) => (
          <Field key={key} label={label}><Input value={details[key]} onChange={(event) => updateDetails(key, event.target.value)} /></Field>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div><h3 className="text-sm font-semibold text-ink">Extracted results</h3><p className="text-xs text-ink/45 mt-0.5">Review OCR values before generating the final PDF.</p></div>
        <Button size="sm" variant="soft" onClick={() => setRows((current) => [...current, emptyRow(reportType)])} icon={Plus}>Add row</Button>
      </div>
      <div className="overflow-x-auto border border-line rounded-xl">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="bg-canvas text-ink/55"><tr><th className="text-left p-2">Section</th><th className="text-left p-2">Analyte</th><th className="text-left p-2">Result</th><th className="text-left p-2">Unit</th><th className="text-left p-2">Reference range</th><th className="text-left p-2">Remarks</th><th /></tr></thead>
          <tbody>
            {rows.map((row, index) => <tr key={index} className={`border-t border-line ${row.needsReview ? 'bg-coral/10' : ''}`}>
              {(['section', 'name', 'result', 'unit', 'referenceRange', 'remarks'] as const).map((key) => <td className="p-1.5" key={key}><input value={row[key]} onChange={(event) => updateRow(index, key, event.target.value)} className="w-full h-8 px-2 rounded-md border border-line bg-white text-ink outline-none focus:border-plum" /></td>)}
              <td className="p-1.5"><button onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="text-ink/35 hover:text-coral" aria-label="Remove row"><Trash2 className="w-4 h-4" /></button></td>
            </tr>)}
          </tbody>
        </table>
        {!rows.length && <EmptyState icon={FileImage} title="Upload a report photo to begin" hint="OCR results will appear here for review." />}
      </div>

      {error && <div className="mt-4 text-sm text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">{error}</div>}
      {notice && <div className="mt-4 text-sm text-plum bg-lilac border border-plum/20 rounded-lg px-3 py-2">{notice}</div>}
      <div className="flex justify-between items-center mt-5 gap-3">
        <Button variant="ghost" onClick={resetResults}>Clear results</Button>
        <Button onClick={generateAndSave} disabled={saveBusy || ocrBusy} icon={Download}>{saveBusy ? 'Generating...' : `Generate ${reportType} PDF`}</Button>
      </div>

      <details className="mt-5 text-xs text-ink/45"><summary className="cursor-pointer">View OCR text</summary><Textarea className="mt-2" rows={6} value={ocrText} onChange={(event) => setOcrText(event.target.value)} /></details>
    </div>
  );
}
