'use client';

import { ChevronDown, LogOut, KeyRound, Menu } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '../lib/auth';
import { logout } from '../lib/auth';

const roleInitials = (name: string) =>
  name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

export default function Topbar({ title, subtitle, user, onPasswordChange, onOpenMobileNav }: {
  title: string;
  subtitle?: string;
  user: User;
  onPasswordChange?: () => void;
  onOpenMobileNav?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 px-4 md:px-6 h-16 bg-surface/90 backdrop-blur border-b border-line">
      {onOpenMobileNav && (
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-ink/70 hover:bg-lilac hover:text-plum shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold text-ink truncate">{title}</h1>
        {subtitle && <p className="text-[11px] text-ink/50 truncate">{subtitle}</p>}
      </div>
      <div className="flex-1" />

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="hv-lift flex items-center gap-2 h-9 pl-1 pr-2 rounded-lg hover:bg-lilac"
        >
          <div className="w-7 h-7 rounded-full bg-coral/20 text-coral flex items-center justify-center text-xs font-semibold">
            {roleInitials(user.name)}
          </div>
          <div className="hidden md:block text-left leading-tight">
            <div className="text-sm font-medium text-ink">{user.name}</div>
            <div className="text-[10px] text-ink/50">{user.role}</div>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-ink/50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-11 mt-1 w-64 rounded-xl bg-surface border border-line shadow-soft py-2 text-sm z-40 animate-popIn">
              <div className="px-3 py-2 border-b border-line">
                <div className="font-medium text-ink">{user.name}</div>
                <div className="text-[11px] text-ink/50">{user.role}</div>
                <div className="text-[11px] text-ink/40 mt-0.5">{user.email}</div>
              </div>
              {onPasswordChange && (
                <button
                  onClick={() => { setOpen(false); onPasswordChange(); }}
                  className="hv-slide-parent w-full text-left px-3 py-2 hover:bg-lilac hover:text-plum text-ink/80 transition-colors duration-150 flex items-center gap-2"
                >
                  <KeyRound className="w-4 h-4 hv-slide" /> Change password
                </button>
              )}
              <button
                onClick={handleLogout}
                className="hv-slide-parent w-full text-left px-3 py-2 hover:bg-coral/10 text-coral font-medium transition-colors duration-150 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4 hv-slide" /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
