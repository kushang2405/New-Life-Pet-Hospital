import {
  LayoutDashboard,
  PawPrint,
  CalendarDays,
  Stethoscope,
  Syringe,
  Pill,
  Scissors,
  Hotel,
  Receipt,
  Users,
  Clock,
  Settings,
  FileText,
  Stethoscope as SurgeryIcon,
  BarChart3 as AnalyticsIcon,
  ClipboardList as ReportsIcon,
  Award as CertificateIcon,
  CalendarCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   Roles
   ───────────────────────────────────────────────────────── */

export type Role = 'Super Admin' | 'Staff';

export const allRoles: Role[] = ['Super Admin', 'Staff'];

export type RoleInfo = {
  label: Role;
  description: string;
  badgeColor: string;
};

export const roleInfo: Record<Role, RoleInfo> = {
  'Super Admin': {
    label: 'Super Admin',
    description: 'Full control of the hospital system',
    badgeColor: 'bg-coral/15 text-coral border-coral/20',
  },
  Staff: {
    label: 'Staff',
    description: 'Punch in and punch out for attendance',
    badgeColor: 'bg-lilac text-plum border-lilac',
  },
};

/* ─────────────────────────────────────────────────────────
   Permissions
   ───────────────────────────────────────────────────────── */

export type Module =
  | 'dashboard'
  | 'patients'
  | 'appointments'
  | 'vaccinations'
  | 'surgeries'
  | 'pharmacy'
  | 'grooming'
  | 'boarding'
  | 'billing'
  | 'staff'
  | 'settings'
  | 'analytics'
  | 'attendance'
  | 'leaves'
  | 'reports'
  | 'certificates';

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve';

type PermissionMap = Partial<Record<Module, Action[]>>;

const fullAccess: Action[] = ['view', 'create', 'edit', 'delete', 'approve'];
const viewAccess: Action[] = ['view'];

const superAdminModules: Module[] = [
  'dashboard', 'patients', 'appointments', 'vaccinations',
  'surgeries', 'pharmacy', 'grooming', 'boarding', 'billing', 'staff',
  'settings', 'analytics', 'attendance', 'leaves', 'reports', 'certificates',
];

export const rolePermissions: Record<Role, PermissionMap> = {
  'Super Admin': Object.fromEntries(superAdminModules.map((m) => [m, fullAccess])) as PermissionMap,
  Staff: {
    attendance: viewAccess,
    leaves: viewAccess,
  },
};

export function can(role: Role, module: Module, action: Action = 'view'): boolean {
  const perms = rolePermissions[role]?.[module];
  if (!perms) return false;
  return perms.includes(action);
}

export function canAccessModule(role: Role, module: Module): boolean {
  return can(role, module, 'view');
}

/* ─────────────────────────────────────────────────────────
   Navigation
   ───────────────────────────────────────────────────────── */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  module: Module;
};

export const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { href: '/patients', label: 'Patients', icon: PawPrint, module: 'patients' },
  { href: '/appointments', label: 'Appointments', icon: CalendarDays, module: 'appointments' },
  { href: '/vaccinations', label: 'Vaccinations', icon: Syringe, module: 'vaccinations' },
  { href: '/surgeries', label: 'Surgery', icon: SurgeryIcon, module: 'surgeries' },
  { href: '/pharmacy', label: 'Pharmacy', icon: Pill, module: 'pharmacy' },
  { href: '/grooming', label: 'Grooming', icon: Scissors, module: 'grooming' },
  { href: '/boarding', label: 'Boarding', icon: Hotel, module: 'boarding' },
  { href: '/billing', label: 'Billing', icon: Receipt, module: 'billing' },
  { href: '/attendance', label: 'Punch In / Out', icon: Clock, module: 'attendance' },
  { href: '/leaves', label: 'Leave Requests', icon: CalendarCheck, module: 'leaves' },
  { href: '/reports', label: 'Diagnostic Reports', icon: ReportsIcon, module: 'reports' },
  { href: '/certificates', label: 'Certificates', icon: CertificateIcon, module: 'certificates' },
  { href: '/staff', label: 'Staff', icon: Users, module: 'staff' },
  { href: '/settings', label: 'Settings', icon: Settings, module: 'settings' },
  { href: '/analytics', label: 'Analytics & Reports', icon: AnalyticsIcon, module: 'analytics' },
];

export function navForRole(role: Role): NavItem[] {
  return navItems.filter((item) => canAccessModule(role, item.module));
}

/* ─────────────────────────────────────────────────────────
   Staff role options (for staff management forms)
   ───────────────────────────────────────────────────────── */

export const staffRoleOptions: Role[] = ['Staff'];
