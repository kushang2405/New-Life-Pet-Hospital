'use client';

import { useState, useRef, type ChangeEvent } from 'react';
import {
  Palette, Percent, Check, Sun, Moon, Building, Save, AlertCircle, DollarSign,
} from 'lucide-react';
import Shell from '../components/Shell';
import { Card, SectionTitle, Button, Tabs } from '../components/ui';
import { Input, Select, Switch, ColorInput } from '../components/form';
import { useSettings, CURRENCY_SYMBOLS, type ClinicSettings } from '../lib/settings';
import { confirmAction } from '../lib/helpers';

type Tab = 'branding' | 'themes' | 'currencies' | 'taxes';

export default function SettingsPage() {
  const { settings, update: applySettings, reset: resetSettings } = useSettings();
  const [draft, setDraft] = useState<ClinicSettings | null>(null);
  const current = draft ?? settings;
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>('branding');
  const [logoError, setLogoError] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof ClinicSettings, v: string | boolean) => {
    setDraft((d) => ({ ...(d ?? settings), [k]: v }));
    setSaved(false);
    // Appearance is applied live so the effect is visible while choosing.
    if (k === 'theme' || k === 'primaryColor' || k === 'fontSize') {
      applySettings({ [k]: v } as Partial<ClinicSettings>);
    }
  };

  const onLogoPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      setLogoError('Please choose a PNG, JPG or SVG image.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setLogoError('Logo must be 1 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoError('');
      set('clinicLogo', String(reader.result));
    };
    reader.onerror = () => setLogoError('Could not read that file. Please try another image.');
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (draft) applySettings(draft);
    setDraft(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const restoreDefaults = () => {
    if (!confirmAction('Restore all settings to their defaults? Your customisations will be lost.')) return;
    resetSettings();
    setDraft(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const dirty = draft !== null;

  const tabs: { key: Tab; label: string; icon: typeof Palette }[] = [
    { key: 'branding', label: 'Branding', icon: Palette },
    { key: 'themes', label: 'Themes', icon: Sun },
    { key: 'currencies', label: 'Currencies', icon: DollarSign },
    { key: 'taxes', label: 'Taxes', icon: Percent },
  ];

  const labelCls = 'text-[11px] font-medium text-ink/60 uppercase tracking-wide';

  return (
    <Shell module="settings" title="Administration" subtitle="Clinic configuration">
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'branding' && (
        <Card className="p-5">
          <SectionTitle title="Branding" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className={labelCls}>Clinic logo</span>
              <div className="mt-2 rounded-xl border-2 border-dashed border-line p-8 text-center">
                {current.clinicLogo ? (
                  <img src={current.clinicLogo} alt="Clinic logo" className="max-h-16 max-w-full mx-auto object-contain" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-plum text-white flex items-center justify-center mx-auto text-2xl font-bold">{current.clinicName.charAt(0) || 'C'}</div>
                )}
                <p className="text-xs text-ink/50 mt-3">PNG, JPG or SVG, up to 1 MB</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={onLogoPick} />
                  <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>Upload logo</Button>
                  {current.clinicLogo && <Button size="sm" variant="ghost" onClick={() => set('clinicLogo', '')}>Remove</Button>}
                </div>
                {logoError && <p className="text-xs text-coral mt-2">{logoError}</p>}
              </div>
            </div>
            <div>
              <span className={labelCls}>Letterhead & watermark</span>
              <div className="mt-2 rounded-xl border border-line p-4">
                <div className="bg-white rounded-lg p-4 border border-line">
                  <div className="flex items-center gap-3 pb-3 border-b border-line">
                    {current.clinicLogo ? (
                      <img src={current.clinicLogo} alt="" className="w-10 h-10 rounded-xl object-contain" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-plum text-white flex items-center justify-center text-sm font-bold">{current.clinicName.charAt(0) || 'C'}</div>
                    )}
                    <div>
                      <div className="text-sm font-bold text-ink">{current.clinicName}</div>
                      <div className="text-[10px] text-ink/50">{current.address}</div>
                    </div>
                  </div>
                  <div className="pt-3 text-[10px] text-ink/40">Document letterhead preview</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-line">
            <h4 className="text-sm font-semibold text-ink mb-3">Report styling</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="block">
                <span className={labelCls}>Primary color</span>
                <ColorInput className="mt-1" value={current.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} />
              </div>
              <label className="block">
                <span className={labelCls}>Font size</span>
                <Select className="mt-1" value={current.fontSize} onChange={(e) => set('fontSize', e.target.value)}>
                  <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
                </Select>
              </label>
              <label className="block">
                <span className={labelCls}>Font family</span>
                <Select className="mt-1" defaultValue="Inter">
                  <option>Inter</option><option>Roboto</option><option>Open Sans</option><option>Lato</option><option>Poppins</option>
                </Select>
              </label>
            </div>
          </div>
        </Card>
      )}

      {tab === 'themes' && (
        <Card className="p-5">
          <SectionTitle title="Theme & appearance" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'Light', value: 'light', icon: Sun, bg: 'bg-white', text: 'text-ink', border: 'border-line' },
              { name: 'Dark', value: 'dark', icon: Moon, bg: 'bg-ink', text: 'text-white', border: 'border-line' },
              { name: 'Violet (Default)', value: 'plum', icon: Building, bg: 'bg-lilac', text: 'text-plum', border: 'border-lilac' },
              { name: 'Coral', value: 'coral', icon: Building, bg: 'bg-coral/15', text: 'text-coral', border: 'border-coral/30' },
            ].map((theme) => (
              <button key={theme.value} onClick={() => set('theme', theme.value)}
                className={`rounded-2xl p-5 border-2 transition-all text-center ${current.theme === theme.value ? 'border-plum ring-2 ring-lilac' : 'border-line hover:border-plum/30'}`}>
                <div className={`w-full h-20 rounded-xl border ${theme.bg} ${theme.text} ${theme.border} flex items-center justify-center mb-3`}>
                  <theme.icon className="w-8 h-8" />
                </div>
                <div className="text-sm font-medium text-ink">{theme.name}</div>
                {current.theme === theme.value && <div className="text-[10px] text-plum mt-1">Currently active</div>}
              </button>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-line">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-ink">Color palette preview</h4>
              <span className="text-[11px] text-ink/50">Changes apply live across the entire app</span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { name: 'Primary', var: '--c-plum' },
                { name: 'Deep', var: '--c-grape' },
                { name: 'Accent', var: '--c-iris' },
                { name: 'Tint', var: '--c-lilac' },
                { name: 'Coral', color: '#f17f65' },
                { name: 'Info', color: '#0ea5e9' },
              ].map((c) => (
                <div key={c.name} className="rounded-xl overflow-hidden border border-line">
                  <div className="h-12" style={c.var ? { backgroundColor: `rgb(var(${c.var}))` } : { backgroundColor: c.color }} />
                  <div className="p-2"><div className="text-[10px] font-medium text-ink">{c.name}</div></div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-line">
            <h4 className="text-sm font-semibold text-ink mb-3">Custom primary color</h4>
            <p className="text-[11px] text-ink/50 mb-4">Pick a custom primary color for the Light and Dark themes. The Violet and Coral themes use their own fixed palettes.</p>
            <div className="flex items-center gap-4">
              <ColorInput value={current.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} />
              <div className="flex items-center gap-2 text-xs text-ink/60">
                <span>Current:</span>
                <code className="font-mono text-ink">{current.primaryColor}</code>
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === 'currencies' && (
        <Card className="p-5">
          <SectionTitle title="Currency settings" />
          <p className="text-sm text-ink/60 mb-4">Choose the one currency used across the app.</p>
          <div className="space-y-2">
            {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => (
              <div key={code} className="flex items-center gap-3 p-3 rounded-xl border border-line">
                <div className="w-12 h-9 rounded-lg bg-canvas flex items-center justify-center text-sm font-bold text-ink/60">{symbol}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink">{code}</div>
                </div>
                <Switch
                  checked={current.currency === code}
                  onChange={(on) => { if (on) { set('currency', code); set('currencySymbol', symbol); } }}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'taxes' && (
        <Card className="p-5">
          <SectionTitle title="Tax configuration" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <label className="block">
              <span className={labelCls}>Default tax rate (%)</span>
              <Input className="mt-1" value={current.taxRate} onChange={(e) => set('taxRate', e.target.value)} />
            </label>
            <label className="block">
              <span className={labelCls}>Tax ID / VAT number</span>
              <Input className="mt-1" value={current.taxId} onChange={(e) => set('taxId', e.target.value)} />
            </label>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-line cursor-pointer hover:bg-canvas transition-colors mb-6">
            <div><div className="text-sm font-medium text-ink">Tax-inclusive pricing</div><div className="text-[11px] text-ink/50">Show prices with tax already included</div></div>
            <Switch checked={current.taxInclusive} onChange={(v) => set('taxInclusive', v)} />
          </div>

          <h4 className="text-sm font-semibold text-ink mb-3 mt-6 pt-6 border-t border-line">Tax brackets by service</h4>
          <div className="space-y-2">
            {[
              { service: 'Consultation', rate: '8.5%', exempt: false },
              { service: 'Surgery', rate: '8.5%', exempt: false },
              { service: 'Vaccination', rate: '0%', exempt: true },
              { service: 'Pharmacy / Medication', rate: '8.5%', exempt: false },
              { service: 'Grooming', rate: '8.5%', exempt: false },
              { service: 'Boarding', rate: '12%', exempt: false },
              { service: 'Laboratory tests', rate: '8.5%', exempt: false },
              { service: 'Product sales', rate: '8.5%', exempt: false },
            ].map((t) => (
              <div key={t.service} className="flex items-center gap-3 p-3 rounded-xl border border-line">
                <div className="flex-1">
                  <div className="text-sm font-medium text-ink">{t.service}</div>
                </div>
                {t.exempt && <span className="text-[10px] px-2 py-0.5 rounded-full bg-lilac text-plum">Tax exempt</span>}
                <div className="w-20 text-right">
                  <Input className="text-right" defaultValue={t.rate} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 mt-5">
        {dirty && (
          <span className="text-xs text-coral font-medium flex items-center gap-1 mr-auto">
            <AlertCircle className="w-4 h-4" /> You have unsaved changes
          </span>
        )}
        {saved && (
          <span className="text-xs text-plum font-medium flex items-center gap-1">
            <Check className="w-4 h-4" /> Saved — applied across the app
          </span>
        )}
        <Button variant="outline" onClick={restoreDefaults}>Restore defaults</Button>
        <Button onClick={save} disabled={!dirty}><Save className="w-4 h-4" /> Save changes</Button>
      </div>
    </Shell>
  );
}
