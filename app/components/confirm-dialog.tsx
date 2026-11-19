'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { AlertTriangle, Info, Trash2, X } from 'lucide-react';
import { Button } from './ui';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  icon?: 'trash' | 'warning' | 'info';
}

export interface AlertOptions {
  title?: string;
  message: string;
  buttonText?: string;
  icon?: 'warning' | 'error' | 'info';
}

type DialogState =
  | ({ type: 'confirm' } & ConfirmOptions & { resolve: (val: boolean) => void })
  | ({ type: 'alert' } & AlertOptions & { resolve: () => void });

let activeDialogSetter: ((d: DialogState | null) => void) | null = null;

export function confirmModal(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
  if (!activeDialogSetter) {
    if (typeof window !== 'undefined') {
      return Promise.resolve(window.confirm(opts.message));
    }
    return Promise.resolve(false);
  }
  return new Promise<boolean>((resolve) => {
    activeDialogSetter?.({
      type: 'confirm',
      ...opts,
      resolve,
    });
  });
}

export function alertModal(options: AlertOptions | string): Promise<void> {
  const opts: AlertOptions = typeof options === 'string' ? { message: options } : options;
  if (!activeDialogSetter) {
    if (typeof window !== 'undefined') {
      window.alert(opts.message);
    }
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    activeDialogSetter?.({
      type: 'alert',
      ...opts,
      resolve,
    });
  });
}

export function useConfirm() {
  return { confirm: confirmModal, alert: alertModal };
}

export function ConfirmDialogProvider({ children }: { children?: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    activeDialogSetter = setDialog;
    return () => {
      activeDialogSetter = null;
    };
  }, []);

  const handleClose = () => {
    if (!dialog) return;
    if (dialog.type === 'confirm') {
      dialog.resolve(false);
    } else {
      dialog.resolve();
    }
    setDialog(null);
  };

  const handleConfirm = () => {
    if (!dialog) return;
    if (dialog.type === 'confirm') {
      dialog.resolve(true);
    } else {
      dialog.resolve();
    }
    setDialog(null);
  };

  return (
    <>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm transition-opacity" onClick={handleClose} />
          <div className="relative w-full max-w-md mt-16 mb-10 bg-white rounded-2xl shadow-soft border border-line animate-popIn overflow-hidden">
            <div className="flex items-center justify-between px-5 h-14 border-b border-line">
              <div className="flex items-center gap-2.5">
                {dialog.type === 'confirm' && (dialog.variant === 'danger' || !dialog.variant) ? (
                  <div className="w-8 h-8 rounded-lg bg-coral/15 text-coral flex items-center justify-center shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                ) : dialog.icon === 'warning' ? (
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-lilac text-plum flex items-center justify-center shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                )}
                <h3 className="text-sm font-semibold text-ink">
                  {dialog.title || (dialog.type === 'confirm' ? 'Confirm Action' : 'Notice')}
                </h3>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close"
                className="hv-icon w-7 h-7 rounded-lg flex items-center justify-center text-ink/40 hover:text-coral hover:bg-coral/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-ink/70 whitespace-pre-line leading-relaxed">
                {dialog.message}
              </p>
              <div className="flex items-center justify-end gap-2.5 mt-6 pt-2">
                {dialog.type === 'confirm' ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleClose}>
                      {dialog.cancelText || 'Cancel'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleConfirm}
                      className={
                        dialog.variant === 'danger' || !dialog.variant
                          ? 'bg-coral hover:bg-coral/90 text-white border-transparent'
                          : ''
                      }
                    >
                      {dialog.confirmText || 'Confirm'}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={handleConfirm}>
                    {('buttonText' in dialog && dialog.buttonText) || 'OK'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
