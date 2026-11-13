'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Field, Input, Textarea } from './ui';
import { saveLetterhead } from '../lib/certificate-letterhead';
import type { LetterheadSettings } from '../lib/certificate-templates';

type Props = { letterhead: LetterheadSettings; onSaved: (letterhead: LetterheadSettings) => void };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the logo file.'));
    reader.readAsDataURL(file);
  });
}

export default function LetterheadForm({ letterhead, onSaved }: Props) {
  const [draft, setDraft] = useState<LetterheadSettings>(letterhead);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (key: keyof LetterheadSettings, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const handleLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError('Upload the logo as a PNG or JPEG image.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setError('The logo must be smaller than 1 MB.');
      return;
    }
    try {
      update('logoDataUrl', await readAsDataUrl(file));
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const saved = await saveLetterhead(draft);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message || 'Could not save the letterhead.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Clinic logo" hint="PNG or JPEG, up to 1 MB. Used on every certificate with header.">
        <div className="flex items-center gap-3">
          {draft.logoDataUrl ? (
            <img src={draft.logoDataUrl} alt="Clinic logo" className="h-16 max-w-[160px] object-contain rounded-lg border border-line bg-white p-1" />
          ) : (
            <div className="h-16 w-28 rounded-lg border border-dashed border-line flex items-center justify-center text-xs text-ink/50">No logo</div>
          )}
          <input type="file" accept="image/png,image/jpeg" onChange={(event) => handleLogo(event.target.files?.[0])} className="text-sm text-ink/70" />
          {draft.logoDataUrl && (
            <button type="button" onClick={() => update('logoDataUrl', '')} aria-label="Remove logo" title="Remove logo" className="w-9 h-9 rounded-lg flex items-center justify-center text-coral hover:bg-coral/10">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </Field>
      <Field label="Clinic name">
        <Input value={draft.clinicName} onChange={(e) => update('clinicName', e.target.value)} />
      </Field>
      <Field label="Address">
        <Textarea value={draft.address} onChange={(e) => update('address', e.target.value)} rows={2} />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Email">
          <Input type="email" value={draft.email} onChange={(e) => update('email', e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input type="tel" value={draft.phone} onChange={(e) => update('phone', e.target.value)} />
        </Field>
        <Field label="Doctor name">
          <Input value={draft.doctorName} onChange={(e) => update('doctorName', e.target.value)} />
        </Field>
        <Field label="Doctor position">
          <Input value={draft.doctorPosition} onChange={(e) => update('doctorPosition', e.target.value)} />
        </Field>
      </div>
      {error && <div className="text-sm text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">{error}</div>}
      <div className="flex justify-end">
        <Button onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Save letterhead'}</Button>
      </div>
    </div>
  );
}
