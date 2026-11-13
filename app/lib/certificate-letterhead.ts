import { fetchConfig, saveConfig } from './api';
import { DEFAULT_LETTERHEAD, type LetterheadSettings } from './certificate-templates';

export const LETTERHEAD_CONFIG_KEY = 'certificate-letterhead';

export async function fetchLetterhead(): Promise<LetterheadSettings> {
  const saved = await fetchConfig<Partial<LetterheadSettings>>(LETTERHEAD_CONFIG_KEY);
  return { ...DEFAULT_LETTERHEAD, ...saved };
}

export function saveLetterhead(letterhead: LetterheadSettings): Promise<LetterheadSettings> {
  return saveConfig<LetterheadSettings>(LETTERHEAD_CONFIG_KEY, letterhead);
}
