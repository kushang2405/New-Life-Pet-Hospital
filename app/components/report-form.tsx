'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileImage, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { Button, DateInput, EmptyState, Field, Input, Select, Textarea } from './ui';
import { alertModal } from './confirm-dialog';
import { authFetch } from '../lib/auth';
import { fetchLetterhead } from '../lib/certificate-letterhead';
import { DEFAULT_REPORT_BANNER } from '../lib/report-default-banner';
import { compressReportImage } from '../lib/report-images';
import { applyBioDefaults, applyCbcReferenceRanges, computeRemark, formatPetAge } from '../lib/report-parser';
import { createReportPdf, openPdfBlobInNewTab, optimizeLogoForPdf } from '../lib/report-pdf';
import {
  OTHER_TEST_DEFINITIONS,
  OTHER_TEST_TYPES,
  type OtherTestType,
  type OcrExtractResult,
  type PatientDetails,
  type ReportAnalyte,
  type ReportDraft,
  type ReportType,
  type SavedReport,
} from '../lib/report-types';
import type { Owner, Pet } from '../lib/api';

type Props = { owners: Owner[]; pets: Pet[]; report?: SavedReport | null; onSaved: (report: SavedReport) => void };

const emptyDetails: PatientDetails = {
  sampleNo: '', date: new Date().toISOString().slice(0, 10), ageGender: '', registeredOn: '',
  sampleType: '', referredBy: '', doctorName: 'Dr. Arshi K. Vala', doctorPosition: 'M.V.Sc (SURGERY & RADIOLOGY)', uhid: '',
};

const defaultSection = (type: ReportType, otherSub?: string) => {
  if (type === 'CBC') return 'CBC';
  if (type === 'OTHER') return otherSub || 'CANINE FREE T4';
  return 'Kidney Profile';
};

const applyReferenceRanges = (rows: ReportAnalyte[], type: ReportType) => {
  if (type === 'CBC') return applyCbcReferenceRanges(rows);
  if (type === 'BIO') return applyBioDefaults(rows);
  return rows;
};
const emptyRow = (type: ReportType, otherSub?: string): ReportAnalyte => ({ section: defaultSection(type, otherSub), name: '', result: '', unit: '', referenceRange: '', remarks: '' });

const buildOtherRows = (subType: OtherTestType): ReportAnalyte[] => {
  const def = OTHER_TEST_DEFINITIONS[subType] || OTHER_TEST_DEFINITIONS['CANINE FREE T4'];
  return [
    {
      section: def.section,
      name: def.testName,
      result: '',
      unit: def.unit,
      referenceRange: def.referenceRange,
      remarks: '',
    },
  ];
};

const MAX_PHOTOS = 10;

const cleanErrorMessage = (err: unknown, fallback: string): string => {
  const raw = (err instanceof Error ? err.message : String(err || '')).trim();
  if (!raw || /500|failed \(500\)|internal server|something went wrong/i.test(raw)) {
    return 'The report scanner could not process the photo. Please make sure the image is clear and sharp, and try again.';
  }
  if (/502|503|504|timeout|not reachable|not connected|fetch failed|network/i.test(raw)) {
    return 'The report scanner service is temporarily busy or unreachable. Please wait a moment and try again.';
  }
  return raw || fallback;
};

export default function ReportForm({ owners, pets, report, onSaved }: Props) {
  const [reportType, setReportType] = useState<ReportType>(report?.reportType ?? 'BIO');
  const [otherTestType, setOtherTestType] = useState<OtherTestType>(
    (report?.otherTestType as OtherTestType) || 'CANINE FREE T4'
  );
  const [interpretation, setInterpretation] = useState(
    report?.interpretation || (report?.reportType === 'OTHER' ? (OTHER_TEST_DEFINITIONS[(report?.otherTestType as OtherTestType) || 'CANINE FREE T4']?.interpretation || '') : '')
  );
  const [ownerId, setOwnerId] = useState(report?.ownerId ?? '');
  const [petId, setPetId] = useState(report?.petId ?? '');
  const [details, setDetails] = useState<PatientDetails>(report?.patientDetails ?? emptyDetails);
  const [rows, setRows] = useState<ReportAnalyte[]>(() => {
    if (report?.analytes?.length) return report.analytes;
    if (report?.reportType === 'OTHER') {
      return buildOtherRows((report.otherTestType as OtherTestType) || 'CANINE FREE T4');
    }
    return [];
  });
  const [imageName, setImageName] = useState(report?.sourceImageName ?? '');
  const [logoDataUrl, setLogoDataUrl] = useState(report?.logoData ?? '');
  const [ocrText, setOcrText] = useState(report?.ocrText ?? '');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const petOptions = useMemo(() => {
    if (!ownerId) return pets;
    const matching = pets.filter((pet) => pet.ownerId === ownerId);
    return matching.length > 0 ? matching : pets;
  }, [pets, ownerId]);

  const selectedPet = pets.find((pet) => pet.id === petId) || petOptions.find((pet) => pet.id === petId);
  const selectedOwner = owners.find((owner) => owner.id === (ownerId || selectedPet?.ownerId)) || owners.find((owner) => owner.id === ownerId);

  useEffect(() => {
    if (report) return;
    if (!petId && pets.length > 0) {
      setPetId(pets[0].id);
      if (pets[0].ownerId) setOwnerId(pets[0].ownerId);
    } else if (!ownerId && owners.length > 0) {
      setOwnerId(owners[0].id);
    }
  }, [pets, owners, petId, ownerId, report]);

  useEffect(() => {
    if (report?.logoData) return;
    fetchLetterhead()
      .then((letterhead) => setLogoDataUrl(letterhead.logoDataUrl || DEFAULT_REPORT_BANNER))
      .catch(() => setLogoDataUrl(DEFAULT_REPORT_BANNER));
  }, [report?.logoData]);

  useEffect(() => {
    if (!selectedPet?.birthDate) return;
    const reportDate = new Date(`${details.date || new Date().toISOString().slice(0, 10)}T00:00:00`);
    const age = formatPetAge(selectedPet.birthDate, reportDate);
    setDetails((current) => ({ ...current, ageGender: age }));
  }, [selectedPet?.birthDate, details.date]);

  const handleOwnerChange = (newOwnerId: string) => {
    setOwnerId(newOwnerId);
    if (fieldErrors.owner) setFieldErrors((prev) => ({ ...prev, owner: '' }));
    const matching = pets.filter((p) => p.ownerId === newOwnerId);
    if (matching.length > 0) {
      setPetId(matching[0].id);
      if (fieldErrors.pet) setFieldErrors((prev) => ({ ...prev, pet: '' }));
    } else {
      setPetId('');
    }
  };

  const handlePetChange = (newPetId: string) => {
    setPetId(newPetId);
    if (fieldErrors.pet) setFieldErrors((prev) => ({ ...prev, pet: '' }));
    const chosenPet = pets.find((pet) => pet.id === newPetId);
    if (chosenPet?.ownerId) {
      setOwnerId(chosenPet.ownerId);
      if (fieldErrors.owner) setFieldErrors((prev) => ({ ...prev, owner: '' }));
    }
  };

  const updateDetails = (key: keyof PatientDetails, value: string) => setDetails((current) => ({ ...current, [key]: value }));
  const updateRow = (index: number, key: keyof ReportAnalyte, value: string) => {
    setRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const updated = { ...row, [key]: value, needsReview: false };
      if (key === 'result' || key === 'referenceRange') {
        updated.remarks = computeRemark(updated.result, updated.referenceRange, updated.remarks);
      }
      return updated;
    }));
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
      const allRows: ReportAnalyte[] = [];
      const allRawTexts: string[] = [];
      const allWarnings: string[] = [];

      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        if (photos.length > 1) {
          setNotice(`Reading photo ${i + 1} of ${photos.length} (${file.name})...`);
        }
        const dataUrl = await compressReportImage(file);
        const result = (await authFetch('/ocr/extract', {
          method: 'POST',
          body: JSON.stringify({ reportType, images: [{ name: file.name, dataUrl }] }),
        })) as OcrExtractResult;

        if (result.rows && Array.isArray(result.rows)) {
          allRows.push(...result.rows);
        }
        if (result.rawText) {
          allRawTexts.push(result.rawText);
        }
        if (result.warnings && Array.isArray(result.warnings)) {
          allWarnings.push(...result.warnings);
        }
      }

      const seen = new Set<string>();
      const mergedRows: ReportAnalyte[] = [];
      for (const row of allRows) {
        const key = row.name.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        mergedRows.push(row);
      }

      setImageName(photos.map((file) => file.name).join(' · '));
      setOcrText(allRawTexts.join('\n\n'));
      setRows(mergedRows.length ? applyReferenceRanges(mergedRows, reportType) : [emptyRow(reportType)]);
      const summary = `${mergedRows.length} result rows read from ${photos.length} image${photos.length === 1 ? '' : 's'}.`;
      setNotice([summary, ...allWarnings].filter(Boolean).join(' '));
    } catch (err) {
      const friendlyMessage = cleanErrorMessage(err, 'Could not read the uploaded images. Please try again with a clearer photo.');
      setError(friendlyMessage);
      await alertModal({
        title: 'Extraction Notice',
        message: friendlyMessage,
        icon: 'warning',
      });
    } finally {
      setOcrBusy(false);
    }
  };

  const resetResults = () => {
    setPhotos([]);
    if (reportType === 'OTHER') {
      setRows(buildOtherRows(otherTestType));
      setInterpretation(OTHER_TEST_DEFINITIONS[otherTestType]?.interpretation || '');
    } else {
      setRows([]);
    }
    setDetails(emptyDetails);
    setImageName('');
    setOcrText('');
    setError('');
    setNotice('');
  };

  const handleReportTypeChange = (nextType: ReportType) => {
    setReportType(nextType);
    if (fieldErrors.analytes) setFieldErrors((prev) => ({ ...prev, analytes: '' }));
    if (nextType === 'OTHER') {
      setRows(buildOtherRows(otherTestType));
      const def = OTHER_TEST_DEFINITIONS[otherTestType];
      if (def) {
        setInterpretation(def.interpretation);
      }
    } else {
      setRows((current) => applyReferenceRanges(current.filter((r) => !['FREE T4', 'Canine Progesterone', 'Troponin-I', 'CANINE TSH', 'CANINE T4'].includes(r.name)), nextType));
    }
  };

  const handleOtherTestTypeChange = (nextOther: OtherTestType) => {
    setOtherTestType(nextOther);
    setRows(buildOtherRows(nextOther));
    const def = OTHER_TEST_DEFINITIONS[nextOther];
    if (def) {
      setInterpretation(def.interpretation);
    }
  };

  const generateAndSave = async () => {
    const errs: Record<string, string> = {};
    if (!selectedOwner) errs.owner = 'Please select an owner';
    if (!selectedPet) errs.pet = 'Please select a pet';
    const analytes = rows.filter((row) => row.name.trim() || row.result.trim());
    if (!analytes.length || (reportType === 'OTHER' && !rows.some((r) => r.result.trim()))) {
      errs.analytes = reportType === 'OTHER' ? 'Please enter the Observed Value for the test' : 'Add at least one result row or upload photos to generate the report';
    }

    if (Object.keys(errs).length > 0 || !selectedOwner || !selectedPet) {
      setFieldErrors(errs);
      setError('Please fill in the compulsory fields below.');
      return;
    }
    setFieldErrors({});
    setSaveBusy(true);
    setError('');
    try {
      const title = reportType === 'OTHER' ? `${selectedPet.name}-${otherTestType}` : `${selectedPet.name}-${reportType}`;
      const optimizedLogo = await optimizeLogoForPdf(logoDataUrl);
      const draft: ReportDraft = {
        reportType,
        otherTestType: reportType === 'OTHER' ? otherTestType : undefined,
        interpretation: reportType === 'OTHER' ? interpretation : undefined,
        title,
        owner: selectedOwner,
        pet: selectedPet,
        patientDetails: details,
        analytes: applyReferenceRanges(analytes, reportType),
        logoDataUrl: optimizedLogo || undefined,
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
          otherTestType: reportType === 'OTHER' ? otherTestType : undefined,
          interpretation: reportType === 'OTHER' ? interpretation : undefined,
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
          logoData: optimizedLogo || '',
        }),
      }) as SavedReport;
      openPdfBlobInNewTab(pdf);
      onSaved(saved);
    } catch (err) {
      const friendlyMessage = cleanErrorMessage(err, 'Could not save the report. Please try again.');
      setError(friendlyMessage);
      await alertModal({
        title: 'Save Report Notice',
        message: friendlyMessage,
        icon: 'warning',
      });
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div>
      <div className={`grid grid-cols-1 ${reportType === 'OTHER' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3 mb-5`}>
        <Field label="Report type">
          <Select value={reportType} onChange={(event) => handleReportTypeChange(event.target.value as ReportType)}>
            <option value="BIO">BIO</option>
            <option value="CBC">CBC</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        {reportType === 'OTHER' && (
          <Field label="Test type">
            <Select value={otherTestType} onChange={(event) => handleOtherTestTypeChange(event.target.value as OtherTestType)}>
              {OTHER_TEST_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Owner" required error={fieldErrors.owner}>
          <Select
            value={ownerId}
            onChange={(event) => handleOwnerChange(event.target.value)}
          >
            <option value="">Select owner</option>
            {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
          </Select>
        </Field>
        <Field label="Pet" required error={fieldErrors.pet}>
          <Select
            value={petId}
            onChange={(event) => handlePetChange(event.target.value)}
          >
            <option value="">Select pet</option>
            {petOptions.map((pet) => {
              const petOwner = owners.find((o) => o.id === pet.ownerId);
              return (
                <option key={pet.id} value={pet.id}>
                  {pet.name} {pet.species ? `(${pet.species})` : ''} {petOwner && (!ownerId || pet.ownerId !== ownerId) ? `· ${petOwner.name}` : ''}
                </option>
              );
            })}
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

      {reportType !== 'OTHER' && (
        <div className="grid gap-3 mb-5">
          <Field label="Report photos" error={fieldErrors.analytes} className="rounded-xl border border-line bg-canvas/60  p-3">
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
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Field label="Report date"><DateInput value={details.date} onChange={(event) => updateDetails('date', event.target.value)} allowPast /></Field>
        {([['sampleNo', 'Sample no'], ['ageGender', 'Age from pet record'], ['sampleType', 'Sample type'], ['referredBy', 'Referred by'], ['doctorName', 'Doctor name'], ['doctorPosition', 'Doctor position']] as const).map(([key, label]) => (
          <Field key={key} label={label}><Input value={details[key]} onChange={(event) => updateDetails(key, event.target.value)} /></Field>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {reportType === 'OTHER' ? `${otherTestType} test details` : 'Extracted results'}
          </h3>
          <p className="text-xs text-ink/45 mt-0.5">
            {reportType === 'OTHER'
              ? 'Enter the Observed Value. Test details are automatically pre-filled from reference standards.'
              : 'Review OCR values before generating the final PDF.'}
          </p>
        </div>
        {reportType !== 'OTHER' && (
          <Button size="sm" variant="soft" onClick={() => setRows((current) => [...current, emptyRow(reportType)])} icon={Plus}>Add row</Button>
        )}
      </div>

      {fieldErrors.analytes && (
        <div className="mb-3 text-xs text-coral font-medium bg-coral/10 border border-coral/20 rounded-lg p-2.5">
          {fieldErrors.analytes}
        </div>
      )}

      <div className="overflow-x-auto border border-line rounded-xl">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="bg-canvas text-ink/55">
            <tr>
              <th className="text-left p-2">Section</th>
              <th className="text-left p-2">{reportType === 'OTHER' ? 'Test Name' : 'Analyte'}</th>
              <th className="text-left p-2">{reportType === 'OTHER' ? 'Observed Value (Result)' : 'Result'}</th>
              <th className="text-left p-2">Unit</th>
              <th className="text-left p-2">Reference range</th>
              <th className="text-left p-2">Remarks</th>
              {reportType !== 'OTHER' && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={`border-t border-line ${row.needsReview ? 'bg-coral/10' : ''}`}>
                <td className="p-1.5">
                  <input
                    value={row.section}
                    onChange={(event) => updateRow(index, 'section', event.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-line bg-white text-ink outline-none focus:border-plum"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    value={row.name}
                    onChange={(event) => updateRow(index, 'name', event.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-line bg-white text-ink font-medium outline-none focus:border-plum"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    value={row.result}
                    placeholder={reportType === 'OTHER' ? 'Enter observed value...' : ''}
                    autoFocus={reportType === 'OTHER'}
                    onChange={(event) => updateRow(index, 'result', event.target.value)}
                    className={`w-full h-8 px-2 rounded-md border text-ink font-semibold outline-none focus:border-plum ${
                      reportType === 'OTHER' && !row.result.trim() ? 'border-plum/50 bg-lilac/20' : 'border-line bg-white'
                    }`}
                  />
                </td>
                <td className="p-1.5">
                  <input
                    value={row.unit}
                    onChange={(event) => updateRow(index, 'unit', event.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-line bg-white text-ink outline-none focus:border-plum"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    value={row.referenceRange}
                    onChange={(event) => updateRow(index, 'referenceRange', event.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-line bg-white text-ink outline-none focus:border-plum"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    value={row.remarks || ''}
                    onChange={(event) => updateRow(index, 'remarks', event.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-line bg-white text-ink outline-none focus:border-plum"
                  />
                </td>
                {reportType !== 'OTHER' && (
                  <td className="p-1.5">
                    <button
                      onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                      className="text-ink/35 hover:text-coral"
                      aria-label="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <EmptyState
            icon={FileImage}
            title={reportType === 'OTHER' ? 'No test row' : 'Upload a report photo to begin'}
            hint={reportType === 'OTHER' ? 'Select a test type from the dropdown above.' : 'OCR results will appear here for review.'}
          />
        )}
      </div>

      {reportType === 'OTHER' && (
        <div className="mt-4">
          <Field label="Interpretation / Remarks (will be printed below the table in the PDF)">
            <Textarea
              rows={7}
              value={interpretation}
              onChange={(event) => setInterpretation(event.target.value)}
              className="font-mono text-xs whitespace-pre-wrap leading-relaxed"
              placeholder="Interpretation remarks to be printed on PDF..."
            />
          </Field>
        </div>
      )}

      {error && <div className="mt-4 text-sm text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">{error}</div>}
      {notice && <div className="mt-4 text-sm text-plum bg-lilac border border-plum/20 rounded-lg px-3 py-2">{notice}</div>}
      <div className="flex justify-between items-center mt-5 gap-3">
        <Button variant="ghost" onClick={resetResults}>Clear results</Button>
        <Button onClick={generateAndSave} disabled={saveBusy || ocrBusy} icon={Download}>
          {saveBusy ? 'Generating...' : `Generate ${reportType === 'OTHER' ? otherTestType : reportType} PDF`}
        </Button>
      </div>
    </div>
  );
}
