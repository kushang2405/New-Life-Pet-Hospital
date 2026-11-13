import { authFetch } from './auth';
import type { LeaveRequest, Staff } from './api';

// Actual hospital location (commented for testing):
// export const HOSPITAL_LOCATION = {
//   latitude: 21.2052,
//   longitude: 72.8374,
//   radiusMeters: 150,
// };
export const HOSPITAL_LOCATION = {
  latitude: 21.1528,
  longitude: 72.8310,
  radiusMeters: 150,
};

export const LEAVE_TYPES: LeaveRequest['type'][] = [
  'Annual', 'Sick', 'Personal', 'Maternity', 'Paternity', 'Bereavement', 'Unpaid', 'Compensatory',
];

const pad = (n: number) => String(n).padStart(2, '0');

export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localTime = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export function isAtHospital(latitude: number, longitude: number): boolean {
  return distanceMeters(latitude, longitude, HOSPITAL_LOCATION.latitude, HOSPITAL_LOCATION.longitude) <= HOSPITAL_LOCATION.radiusMeters;
}

export function punchAttendance(type: 'in' | 'out', latitude: number, longitude: number): Promise<Staff> {
  return authFetch('/attendance/punch', {
    method: 'POST',
    body: JSON.stringify({ type, date: localDate(), time: localTime(), latitude, longitude }),
  });
}

export type LeaveInput = {
  type: LeaveRequest['type'];
  startDate: string;
  endDate: string;
  reason: string;
};

export function applyForLeave(input: LeaveInput): Promise<Staff> {
  return authFetch('/attendance/leave', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function decideLeaveRequest(staffId: string, leaveId: string, decision: 'Approved' | 'Rejected'): Promise<Staff> {
  return authFetch(`/attendance/leave/${staffId}/${leaveId}`, {
    method: 'PUT',
    body: JSON.stringify({ decision }),
  });
}
