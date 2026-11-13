import { authFetch } from './auth';

export type WhatsAppDocumentKind = 'reports' | 'certificates';

export function sendDocumentOnWhatsApp(kind: WhatsAppDocumentKind, id: string) {
  return authFetch('/whatsapp/send-document', {
    method: 'POST',
    body: JSON.stringify({ kind, id }),
  }) as Promise<{ success: true; filename: string }>;
}
