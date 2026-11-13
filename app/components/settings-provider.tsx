'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { fetchConfig, saveConfig } from '../lib/api';
import {
  SETTINGS_CONFIG_KEY,
  SETTINGS_KEY,
  SettingsContext,
  applySettingsToDocument,
  defaultSettings,
  readSettings,
  writeSettings,
  type ClinicSettings,
} from '../lib/settings';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ClinicSettings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const localSettings = readSettings();
    setSettings(localSettings);
    applySettingsToDocument(localSettings);

    fetchConfig<ClinicSettings>(SETTINGS_CONFIG_KEY)
      .then((serverSettings) => {
        if (!mounted || !serverSettings) return;
        const merged = { ...defaultSettings, ...serverSettings };
        setSettings(merged);
        applySettingsToDocument(merged);
        writeSettings(merged);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    const onChange = (e: Event) => {
      const next = (e as CustomEvent<ClinicSettings>).detail ?? readSettings();
      setSettings(next);
      applySettingsToDocument(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY) {
        const next = readSettings();
        setSettings(next);
        applySettingsToDocument(next);
      }
    };
    window.addEventListener('petcare-settings-change', onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      mounted = false;
      window.removeEventListener('petcare-settings-change', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = useCallback((patch: Partial<ClinicSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      writeSettings(next);
      applySettingsToDocument(next);
      saveConfig(SETTINGS_CONFIG_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(defaultSettings);
    writeSettings(defaultSettings);
    applySettingsToDocument(defaultSettings);
    saveConfig(SETTINGS_CONFIG_KEY, defaultSettings).catch(() => {});
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update, reset, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}
