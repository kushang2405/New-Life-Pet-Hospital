'use client';

import { useMemo, useState } from 'react';
import { PawPrint, Plus, Phone, Cake, Scale, Edit2, Trash2, X, Cpu, Crown, Award, CreditCard } from 'lucide-react';
import Shell from '../components/Shell';
import { Card, Badge, Button, EmptyState, Modal, Field, Input, SearchInput, NumberInput, Textarea, Select, DateInput } from '../components/ui';
import { PetProfileDrawer } from '../components/pet-profile';
import { useDB, Owner, Pet, newId, today } from '../lib/store';

const speciesOptions = ['Dog', 'Cat', 'Rabbit', 'Bird', 'Reptile', 'Other'];
const defaultForm = {
  ownerName: '', phone: '',
  petName: '', species: 'Dog', breed: '', gender: 'Male', color: '',
  birthDate: '', weight: '', height: '', bloodGroup: 'Unknown',
  sterilized: false, allergies: '', conditions: '', dietType: 'Standard',
  microchipNumber: '', rfidNumber: '', qrCodeId: '',
  insuranceProvider: '', insurancePolicyNumber: '', insuranceExpiry: '',
  notes: '',
};

export default function PatientsPage() {
  const { db, create, update, remove } = useDB();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'pets' | 'owners'>('pets');
  const [detailPet, setDetailPet] = useState<Pet | null>(null);
  const [editPet, setEditPet] = useState<Pet | null>(null);
  const [editOwnerObj, setEditOwnerObj] = useState<Owner | null>(null);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerForm, setOwnerForm] = useState({ name: '', phone: '', address: '', occupation: '', notes: '' });
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [form, setForm] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [ownerErrors, setOwnerErrors] = useState<Record<string, string>>({});

  const sortedOwners = useMemo(() => {
    if (!db?.owners) return [];
    return [...db.owners].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [db?.owners]);

  const set = (k: string, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (formErrors[k]) setFormErrors((prev) => ({ ...prev, [k]: '' }));
  };

  const filteredPets = useMemo(() => {
    if (!db) return [];
    const q = query.toLowerCase();
    return db.pets.filter((p) => {
      const o = db.owners.find((x) => x.id === p.ownerId);
      return (
        p.name.toLowerCase().includes(q) ||
        p.breed.toLowerCase().includes(q) ||
        p.species.toLowerCase().includes(q) ||
        (o?.name.toLowerCase().includes(q) ?? false) ||
        (p.microchipNumber?.toLowerCase().includes(q) ?? false) ||
        (p.qrCodeId?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [db, query]);

  const filteredOwners = useMemo(() => {
    if (!db) return [];
    const q = query.toLowerCase();
    return db.owners.filter((o) => o.name.toLowerCase().includes(q) || o.phone.includes(q));
  }, [db, query]);

  const ownerOf = (id: string) => db?.owners.find((o) => o.id === id);
  const petsOf = (oid: string) => db?.pets.filter((p) => p.ownerId === oid) ?? [];
  const apptsOf = (pid: string) => db?.appointments.filter((a) => a.petId === pid) ?? [];
  const invoicesOf = (pid: string) => db?.invoices.filter((i) => i.petId === pid) ?? [];

  const age = (birth: string) => {
    if (!birth) return '—';
    const months = Math.floor((Date.now() - new Date(birth).getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (months < 1) return '<1mo';
    if (months < 12) return `${months}mo`;
    return `${Math.floor(months / 12)}y ${months % 12}mo`;
  };

  const openNew = () => {
    setEditPet(null);
    setSelectedOwnerId('');
    setFormErrors({});
    setForm(defaultForm);
    setOpen(true);
  };

  const openEditOwner = (o: Owner) => {
    setEditOwnerObj(o);
    setOwnerErrors({});
    setOwnerForm({ name: o.name, phone: o.phone, address: o.address ?? '', occupation: o.occupation ?? '', notes: o.notes ?? '' });
    setOwnerOpen(true);
  };

  const saveOwner = () => {
    if (!editOwnerObj) return;
    const errs: Record<string, string> = {};
    if (!ownerForm.name?.trim()) errs.name = 'Please enter owner name';
    if (!ownerForm.phone?.trim()) errs.phone = 'Please enter phone number';
    if (Object.keys(errs).length > 0) {
      setOwnerErrors(errs);
      return;
    }
    update('owners', editOwnerObj.id, {
      name: ownerForm.name,
      phone: ownerForm.phone,
      address: ownerForm.address,
      occupation: ownerForm.occupation,
      notes: ownerForm.notes,
    });
    setOwnerOpen(false);
    setEditOwnerObj(null);
    setOwnerErrors({});
  };

  const openEdit = (p: Pet) => {
    const o = ownerOf(p.ownerId);
    setEditPet(p);
    setSelectedOwnerId(p.ownerId || '');
    setEditOwnerObj(o ?? null);
    setFormErrors({});
    setForm({
      ownerName: o?.name ?? '', phone: o?.phone ?? '',
      petName: p.name, species: p.species, breed: p.breed, gender: p.gender,
      color: p.color ?? '', birthDate: p.birthDate, weight: String(p.weightKg),
      height: p.heightCm ? String(p.heightCm) : '', bloodGroup: p.bloodGroup ?? 'Unknown',
      sterilized: p.sterilized, allergies: p.allergies, conditions: p.conditions,
      dietType: p.dietType ?? 'Standard', microchipNumber: p.microchipNumber ?? '',
      rfidNumber: p.rfidNumber ?? '', qrCodeId: p.qrCodeId ?? '',
      insuranceProvider: p.insuranceProvider ?? '', insurancePolicyNumber: p.insurancePolicyNumber ?? '',
      insuranceExpiry: p.insuranceExpiry ?? '', notes: p.notes ?? '',
    });
    setOpen(true);
  };

  const savePatient = async () => {
    const errs: Record<string, string> = {};
    if (!selectedOwnerId) {
      if (!form.ownerName?.trim()) errs.ownerName = 'Please enter owner name';
      if (!form.phone?.trim()) errs.phone = 'Please enter phone number';
    }
    if (!form.petName?.trim()) errs.petName = 'Please enter pet name';
    if (!form.species?.trim()) errs.species = 'Please select species';

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    const petData: Partial<Pet> = {
      name: form.petName, species: form.species, breed: form.breed,
      gender: form.gender as Pet['gender'], color: form.color,
      birthDate: form.birthDate, weightKg: parseFloat(form.weight) || 0,
      heightCm: parseFloat(form.height) || 0, bloodGroup: form.bloodGroup,
      sterilized: form.sterilized, allergies: form.allergies, conditions: form.conditions,
      dietType: form.dietType, microchipNumber: form.microchipNumber,
      rfidNumber: form.rfidNumber, qrCodeId: form.qrCodeId,
      insuranceProvider: form.insuranceProvider, insurancePolicyNumber: form.insurancePolicyNumber,
      insuranceExpiry: form.insuranceExpiry, notes: form.notes,
    };

    let finalOwnerId = selectedOwnerId;
    if (!finalOwnerId) {
      let owner = db?.owners.find((o) => o.name.toLowerCase() === form.ownerName.toLowerCase());
      if (!owner) {
        const newOwnerObj: Owner = {
          id: newId('own'),
          customerId: `CUST-${String((db?.owners.length ?? 0) + 1).padStart(4, '0')}`,
          name: form.ownerName,
          phone: form.phone,
          email: '',
          address: '',
          dateOfBirth: '',
          occupation: '',
          emergencyContacts: [],
          familyMembers: [],
          membershipPlan: 'None',
          membershipSince: today(),
          loyaltyPoints: 0,
          creditBalance: 0,
          communicationLog: [],
          notifications: [],
          feedback: [],
          createdAt: today(),
        };
        owner = await create('owners', newOwnerObj);
      }
      finalOwnerId = owner.id;
    }

    if (editPet) {
      await update('pets', editPet.id, { ...petData, ownerId: finalOwnerId });
      if (!selectedOwnerId && editOwnerObj && (form.ownerName !== editOwnerObj.name || form.phone !== editOwnerObj.phone)) {
        await update('owners', editOwnerObj.id, { name: form.ownerName, phone: form.phone });
      }
    } else {
      const pet: Pet = {
        id: newId('pet'),
        ownerId: finalOwnerId,
        ...petData as any,
        weightHistory: [],
        photos: [],
        documents: [],
        createdAt: today(),
      };
      await create('pets', pet);
    }
    setOpen(false);
    setEditPet(null);
    setSelectedOwnerId('');
    setFormErrors({});
  };

  const deletePet = (id: string) => remove('pets', id);

  const updatePet = (patch: Partial<Pet>) => {
    if (!detailPet) return;
    update('pets', detailPet.id, patch);
    setDetailPet((prev) => prev ? { ...prev, ...patch } : prev);
  };

  const invoicesOfOwner = (oid: string) => db?.invoices.filter((i) => i.ownerId === oid) ?? [];

  if (!db) return <Shell module="patients" title="Patients"><div className="text-sm text-ink/50">Loading…</div></Shell>;

  return (
    <Shell title="Patients" subtitle="Digital pet profiles and their owners">
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by pet name, breed, owner, microchip, QR…"
          className="flex-1"
        />
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white border border-line max-w-full overflow-x-auto [scrollbar-width:none] shrink-0">
          {(['pets', 'owners'] as const).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={`px-3 h-8 rounded-md text-xs font-medium capitalize shrink-0 whitespace-nowrap transition-colors ${
                tab === tb ? 'bg-lilac text-plum' : 'text-ink/60 hover:bg-canvas'
              }`}
            >
              {tb}
            </button>
          ))}
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4" /> Add patient
        </Button>
      </div>


      {tab === 'pets' ? (
        filteredPets.length === 0 ? (
          <Card><EmptyState icon={PawPrint} title="No pets found" hint="Try a different search or add a new patient." /></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPets.map((p) => {
              const o = ownerOf(p.ownerId);
              return (
                <Card key={p.id} className="p-4 group">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => setDetailPet(p)}
                      className="w-11 h-11 rounded-xl bg-lilac text-plum flex items-center justify-center text-sm font-semibold shrink-0 hover:ring-2 hover:ring-plum/30 transition-all"
                    >
                      {p.name.slice(0, 2).toUpperCase()}
                    </button>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailPet(p)}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink truncate">{p.name}</span>
                        <span className="text-[10px] text-ink/40">#{p.id.slice(-4)}</span>
                      </div>
                      <div className="text-[11px] text-ink/50">{p.species} · {p.breed || 'Mixed'} · {p.gender}</div>
                    </div>
                    <div className="flex items-center gap-1 transition-opacity">
                      <button onClick={() => openEdit(p)} className="w-7 h-7 rounded-lg hover:bg-canvas text-ink/40 hover:text-ink flex items-center justify-center transition-colors">
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => deletePet(p.id)} className="w-7 h-7 rounded-lg hover:bg-coral/10 text-ink/40 hover:text-coral flex items-center justify-center transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                    <div className="rounded-lg bg-canvas py-1.5">
                      <Cake className="w-3 h-3 text-ink/40 mx-auto" />
                      <div className="text-[11px] font-medium text-ink mt-0.5">{age(p.birthDate)}</div>
                    </div>
                    <div className="rounded-lg bg-canvas py-1.5">
                      <Scale className="w-3 h-3 text-ink/40 mx-auto" />
                      <div className="text-[11px] font-medium text-ink mt-0.5">{p.weightKg}kg</div>
                    </div>
                    <div className="rounded-lg bg-canvas py-1.5">
                      <PawPrint className="w-3 h-3 text-ink/40 mx-auto" />
                      <div className="text-[11px] font-medium text-ink mt-0.5">{p.sterilized ? 'Neut.' : 'Intact'}</div>
                    </div>
                    <div className="rounded-lg bg-canvas py-1.5">
                      <Cpu className="w-3 h-3 text-ink/40 mx-auto" />
                      <div className="text-[11px] font-medium text-ink mt-0.5">{p.microchipNumber ? 'Chip' : '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {p.microchipNumber && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-medium">Chip: {p.microchipNumber}</span>
                    )}
                    {p.qrCodeId && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-lilac text-plum font-medium">QR: {p.qrCodeId}</span>
                    )}
                    {p.rfidNumber && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">RFID: {p.rfidNumber}</span>
                    )}
                  </div>
                  {o && (
                    <div className="mt-3 pt-3 border-t border-line text-[11px] text-ink/60 space-y-1">
                      <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {o.phone}</div>
                    </div>
                  )}
                  {p.allergies && p.allergies !== 'None known' && (
                    <div className="mt-2 text-[11px] text-coral font-medium">Allergies: {p.allergies}</div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      ) : (
        filteredOwners.length === 0 ? (
          <Card><EmptyState icon={PawPrint} title="No owners found" /></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOwners.map((o) => {
              const oPets = petsOf(o.id);
              const oInvoices = invoicesOfOwner(o.id);
              const totalPaid = oInvoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.items.reduce((ss, it) => ss + it.qty * it.unitPrice, 0), 0);
              return (
                <Card key={o.id} className="p-4 group">
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-lilac text-plum flex items-center justify-center text-sm font-semibold shrink-0">
                          {o.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-ink flex items-center gap-1.5">
                            {o.name}
                            {o.membershipPlan === 'VIP' && <Crown className="w-3 h-3 text-amber-600" />}
                            {o.membershipPlan === 'Premium' && <Award className="w-3 h-3 text-plum" />}
                          </div>
                          <div className="text-[11px] text-ink/50 mt-0.5">{o.customerId || o.id.slice(-6)} · {oPets.length} pet{oPets.length !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${o.membershipPlan === 'VIP' ? 'bg-amber-100 text-amber-700' : o.membershipPlan === 'Premium' ? 'bg-lilac text-plum' : o.membershipPlan === 'Basic' ? 'bg-sky-100 text-sky-700' : 'bg-ink/10 text-ink/50'}`}>{o.membershipPlan}</span>
                        <button onClick={() => openEditOwner(o)} className="w-7 h-7 rounded-lg hover:bg-canvas text-ink/40 hover:text-ink flex items-center justify-center transition-colors" title="Edit owner">
                          <Edit2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div className="rounded-lg bg-canvas py-1.5">
                        <PawPrint className="w-3 h-3 text-ink/40 mx-auto" />
                        <div className="text-[11px] font-medium text-ink mt-0.5">{oPets.length}</div>
                      </div>
                      <div className="rounded-lg bg-canvas py-1.5">
                        <Award className="w-3 h-3 text-ink/40 mx-auto" />
                        <div className="text-[11px] font-medium text-ink mt-0.5">{o.loyaltyPoints}pts</div>
                      </div>
                      <div className="rounded-lg bg-canvas py-1.5">
                        <CreditCard className="w-3 h-3 text-ink/40 mx-auto" />
                        <div className="text-[11px] font-medium text-ink mt-0.5">${o.creditBalance.toFixed(0)}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-line text-[11px] text-ink/60 space-y-1">
                      <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {o.phone}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {oPets.map((p) => (
                      <button
                        key={p.id}
                        onClick={(e) => { e.stopPropagation(); setDetailPet(p); }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-lilac text-plum text-[11px] font-medium hover:ring-2 hover:ring-plum/30 transition-all"
                      >
                        <PawPrint className="w-3 h-3" /> {p.name}
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Add / Edit modal */}
      <Modal open={open} onClose={() => { setOpen(false); setEditPet(null); setSelectedOwnerId(''); setFormErrors({}); }} title={editPet ? 'Edit patient' : 'Register a new patient'}>
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-semibold text-ink/50 uppercase tracking-wide mb-2">Owner Details</div>
            <div className="space-y-3">
              <Field label="Select Existing Owner">
                <Select
                  value={selectedOwnerId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedOwnerId(val);
                    if (val) {
                      const found = db?.owners.find((o) => o.id === val);
                      if (found) {
                        set('ownerName', found.name);
                        set('phone', found.phone);
                      }
                    } else {
                      set('ownerName', '');
                      set('phone', '');
                    }
                  }}
                >
                  <option value="">Select Existing Owner</option>
                  {sortedOwners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} {o.phone ? `(${o.phone})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              {selectedOwnerId ? (
                <div className="p-3 rounded-xl bg-canvas border border-line flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
                      {form.ownerName || db?.owners.find((o) => o.id === selectedOwnerId)?.name}
                      <span className="text-[10px] text-plum font-medium bg-lilac px-2 py-0.5 rounded-full">Existing Owner</span>
                    </div>
                    <div className="text-[11px] text-ink/60 mt-0.5">
                      Phone: {form.phone || db?.owners.find((o) => o.id === selectedOwnerId)?.phone || 'N/A'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedOwnerId('');
                      set('ownerName', '');
                      set('phone', '');
                    }}
                    className="text-xs text-plum hover:text-plum/80"
                  >
                    Clear / New Owner
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Full name" required error={formErrors.ownerName}>
                    <Input value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="Jane Doe" />
                  </Field>
                  <Field label="Phone" required error={formErrors.phone}>
                    <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+1 415 555 0100" />
                  </Field>
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-line pt-4">
            <div className="text-[11px] font-semibold text-ink/50 uppercase tracking-wide mb-2">Pet — Basic Info</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Pet name" required error={formErrors.petName}>
                <Input value={form.petName} onChange={(e) => set('petName', e.target.value)} placeholder="Biscuit" />
              </Field>
              <Field label="Species" required error={formErrors.species}>
                <Select value={form.species} onChange={(e) => set('species', e.target.value)}>
                  {speciesOptions.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Breed"><Input value={form.breed} onChange={(e) => set('breed', e.target.value)} placeholder="Golden Retriever" /></Field>
              <Field label="Gender">
                <Select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                  <option>Male</option><option>Female</option><option>Unknown</option>
                </Select>
              </Field>
              <Field label="Color"><Input value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="Golden" /></Field>
              <Field label="Birth date"><DateInput value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} allowPast /></Field>
              <Field label="Weight (kg)"><NumberInput step={0.1} min={0} value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="31.5" /></Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setOpen(false); setEditPet(null); setSelectedOwnerId(''); setFormErrors({}); }}>Cancel</Button>
            <Button onClick={savePatient}>{editPet ? 'Save changes' : 'Save patient'}</Button>
          </div>
        </div>
      </Modal>


      {/* Edit owner modal */}
      <Modal open={ownerOpen} onClose={() => { setOwnerOpen(false); setEditOwnerObj(null); setOwnerErrors({}); }} title="Edit owner">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Full name" required error={ownerErrors.name}>
              <Input
                value={ownerForm.name}
                onChange={(e) => {
                  setOwnerForm((f) => ({ ...f, name: e.target.value }));
                  if (ownerErrors.name) setOwnerErrors((prev) => ({ ...prev, name: '' }));
                }}
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Phone" required error={ownerErrors.phone}>
              <Input
                value={ownerForm.phone}
                onChange={(e) => {
                  setOwnerForm((f) => ({ ...f, phone: e.target.value }));
                  if (ownerErrors.phone) setOwnerErrors((prev) => ({ ...prev, phone: '' }));
                }}
                placeholder="+1 415 555 0100"
              />
            </Field>
            <Field label="Occupation"><Input value={ownerForm.occupation} onChange={(e) => setOwnerForm((f) => ({ ...f, occupation: e.target.value }))} placeholder="Teacher" /></Field>
          </div>
          <Field label="Address"><Textarea rows={2} value={ownerForm.address} onChange={(e) => setOwnerForm((f) => ({ ...f, address: e.target.value }))} placeholder="123 Main St, Springfield" /></Field>
          <Field label="Notes"><Textarea rows={2} value={ownerForm.notes} onChange={(e) => setOwnerForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Additional notes about the owner…" /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setOwnerOpen(false); setEditOwnerObj(null); setOwnerErrors({}); }}>Cancel</Button>
            <Button onClick={saveOwner}>Save owner</Button>
          </div>
        </div>
      </Modal>

      {/* Pet profile drawer */}
      {detailPet && db && (
        <PetProfileDrawer
          pet={detailPet}
          owner={ownerOf(detailPet.ownerId)}
          appointments={apptsOf(detailPet.id)}
          invoices={invoicesOf(detailPet.id)}
          onClose={() => setDetailPet(null)}
          onEdit={() => { openEdit(detailPet); setDetailPet(null); }}
          onDelete={() => { deletePet(detailPet.id); setDetailPet(null); }}
          onUpdate={updatePet}
        />
      )}
    </Shell>
  );
}
