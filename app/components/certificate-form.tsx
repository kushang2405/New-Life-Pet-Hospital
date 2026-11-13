'use client';

import { useMemo, useState } from 'react';
import { Button, DateInput, Field, Input, Radio, Select } from './ui';
import { authFetch } from '../lib/auth';
import { createCertificatePdf } from '../lib/certificate-pdf';
import { openPdfBlobInNewTab } from '../lib/report-pdf';
import { CERTIFICATE_TYPES, type CertificateType, type LetterheadSettings, type SavedCertificate } from '../lib/certificate-templates';
import type { Owner, Pet } from '../lib/api';

type Props = {
  owners: Owner[];
  pets: Pet[];
  letterhead: LetterheadSettings;
  onSaved: (certificate: SavedCertificate) => void;
};

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not prepare the PDF for storage.'));
    reader.readAsDataURL(blob);
  });
}

export default function CertificateForm({ owners, pets, letterhead, onSaved }: Props) {
  const [certificateType, setCertificateType] = useState<CertificateType>('Microchip');
  const [ownerId, setOwnerId] = useState('');
  const [petId, setPetId] = useState('');
  const [certificateDate, setCertificateDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [chipNumber, setChipNumber] = useState('');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ownerPets = useMemo(() => pets.filter((pet) => pet.ownerId === ownerId), [pets, ownerId]);
  const selectedOwner = owners.find((owner) => owner.id === ownerId);
  const selectedPet = ownerPets.find((pet) => pet.id === petId);

  const selectOwner = (id: string) => {
    setOwnerId(id);
    setPetId('');
    setChipNumber('');
  };

  const selectPet = (id: string) => {
    setPetId(id);
    setChipNumber(pets.find((pet) => pet.id === id)?.microchipNumber ?? '');
  };

  const submit = async () => {
    if (!selectedOwner || !selectedPet) {
      setError('Select an owner and a pet before creating the certificate.');
      return;
    }
    if (!certificateDate) {
      setError('Choose the certificate date.');
      return;
    }
    if (certificateType === 'Microchip' && !chipNumber.trim()) {
      setError('Enter the microchip number for a Microchip certificate.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const details = {
        certificateType,
        certificateDate,
        certificateNo: `CERT-${Date.now().toString(36).toUpperCase()}`,
        ownerName: selectedOwner.name,
        ownerPhone: selectedOwner.phone,
        ownerAddress: selectedOwner.address,
        petName: selectedPet.name,
        petBreed: selectedPet.breed,
        petSpecies: selectedPet.species,
        petSex: selectedPet.gender,
        chipNumber: chipNumber.trim(),
      };
      const pdf = createCertificatePdf(details, letterhead, includeHeader);
      const pdfData = await readAsDataUrl(pdf);
      const saved = await authFetch('/certificates', {
        method: 'POST',
        body: JSON.stringify({
          ...details,
          ownerId: selectedOwner.id,
          petId: selectedPet.id,
          includeHeader,
          pdfData,
        }),
      }) as SavedCertificate;
      openPdfBlobInNewTab(pdf);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message || 'Could not save the certificate.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Certificate type">
          <Select value={certificateType} onChange={(e) => setCertificateType(e.target.value as CertificateType)}>
            {CERTIFICATE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </Select>
        </Field>
        <Field label="Certificate date">
          <DateInput value={certificateDate} onChange={(e) => setCertificateDate(e.target.value)} />
        </Field>
        <Field label="Owner">
          <Select value={ownerId} onChange={(e) => selectOwner(e.target.value)}>
            <option value="">Select owner</option>
            {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
          </Select>
        </Field>
        <Field label="Pet">
          <Select value={petId} onChange={(e) => selectPet(e.target.value)} disabled={!ownerId}>
            <option value="">Select pet</option>
            {ownerPets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
          </Select>
        </Field>
      </div>

      {certificateType === 'Microchip' && (
        <Field label="Microchip number">
          <Input value={chipNumber} onChange={(e) => setChipNumber(e.target.value)} placeholder="Chip number read by scanner" />
        </Field>
      )}

      <Field label="Letterhead">
        <div className="flex flex-col gap-2">
          <Radio checked={includeHeader} onChange={() => setIncludeHeader(true)} label="With header" hint="Logo, clinic name and address at the top" name="header" />
          <Radio checked={!includeHeader} onChange={() => setIncludeHeader(false)} label="Without header" hint="Plain page with no logo or address" name="header" />
        </div>
      </Field>

      {error && <div className="text-sm text-coral bg-coral/10 border border-coral/20 rounded-lg px-3 py-2">{error}</div>}
      <div className="flex justify-end">
        <Button onClick={submit} disabled={busy}>{busy ? 'Creating...' : 'Create certificate'}</Button>
      </div>
    </div>
  );
}
