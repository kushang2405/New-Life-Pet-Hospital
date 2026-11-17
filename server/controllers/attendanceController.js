const crypto = require('crypto');
const asyncHandler = require('../middleware/asyncHandler');
const Staff = require('../models/Staff');

// Hospital geo-fencing location (Surat)
const HOSPITAL = { latitude: 21.2052, longitude: 72.8374, radiusMeters: 300 };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const LEAVE_TYPES = ['Annual', 'Sick', 'Personal', 'Maternity', 'Paternity', 'Bereavement', 'Unpaid', 'Compensatory'];

function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

const minutesOf = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const punch = asyncHandler(async (req, res) => {
  const { type, date, time, latitude, longitude } = req.body;
  if (!['in', 'out'].includes(type) || !DATE_RE.test(date || '') || !TIME_RE.test(time || '')) {
    return res.status(400).json({ error: 'INVALID_PUNCH', message: 'Invalid punch request' });
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: 'LOCATION_REQUIRED', message: 'Location is required to punch in or out' });
  }
  if (distanceMeters(latitude, longitude, HOSPITAL.latitude, HOSPITAL.longitude) > HOSPITAL.radiusMeters) {
    return res.status(403).json({ error: 'NOT_AT_HOSPITAL', message: 'You need to arrive at the hospital to punch in or out.' });
  }

  const staff = await Staff.findById(req.user.sub);
  if (!staff) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Staff member not found' });
  }

  const record = staff.attendance.find((a) => a.date === date);
  if (type === 'in') {
    if (record?.checkIn) {
      return res.status(409).json({ error: 'ALREADY_PUNCHED_IN', message: 'You have already punched in today.' });
    }
    if (record) {
      record.checkIn = time;
      record.status = 'Present';
    } else {
      staff.attendance.push({ date, checkIn: time, checkOut: '', status: 'Present', hoursWorked: 0, notes: '' });
    }
  } else {
    if (!record?.checkIn) {
      return res.status(409).json({ error: 'NOT_PUNCHED_IN', message: 'You need to punch in before punching out.' });
    }
    if (record.checkOut) {
      return res.status(409).json({ error: 'ALREADY_PUNCHED_OUT', message: 'You have already punched out today.' });
    }
    record.checkOut = time;
    record.hoursWorked = Math.round((Math.max(0, minutesOf(time) - minutesOf(record.checkIn)) / 60) * 100) / 100;
  }

  await staff.save();
  res.json(staff.toSafeObject());
});

const applyLeave = asyncHandler(async (req, res) => {
  const { type, startDate, endDate, reason } = req.body;
  if (!LEAVE_TYPES.includes(type)) {
    return res.status(400).json({ error: 'INVALID_LEAVE_TYPE', message: 'Choose a valid leave type' });
  }
  if (!DATE_RE.test(startDate || '') || !DATE_RE.test(endDate || '') || endDate < startDate) {
    return res.status(400).json({ error: 'INVALID_LEAVE_DATES', message: 'End date must be on or after the start date' });
  }

  const staff = await Staff.findById(req.user.sub);
  if (!staff) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Staff member not found' });
  }

  const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1;
  staff.leaveRequests.push({
    id: `lv_${crypto.randomUUID()}`,
    type,
    startDate,
    endDate,
    days,
    status: 'Pending',
    reason: (reason || '').trim(),
    appliedDate: new Date().toISOString().slice(0, 10),
    reviewedBy: '',
    reviewedDate: '',
    notes: '',
  });
  await staff.save();
  res.status(201).json(staff.toSafeObject());
});

const decideLeave = asyncHandler(async (req, res) => {
  const { decision } = req.body;
  if (!['Approved', 'Rejected'].includes(decision)) {
    return res.status(400).json({ error: 'INVALID_DECISION', message: 'Decision must be Approved or Rejected' });
  }

  const [reviewer, staff] = await Promise.all([
    Staff.findById(req.user.sub),
    Staff.findById(req.params.staffId),
  ]);
  if (!staff) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Staff member not found' });
  }

  const leave = staff.leaveRequests.find((l) => l.id === req.params.leaveId);
  if (!leave) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Leave request not found' });
  }
  if (leave.status !== 'Pending') {
    return res.status(409).json({ error: 'ALREADY_DECIDED', message: 'This leave request has already been decided' });
  }

  leave.status = decision;
  leave.reviewedBy = reviewer.name;
  leave.reviewedDate = new Date().toISOString().slice(0, 10);
  await staff.save();
  res.json(staff.toSafeObject());
});

module.exports = { punch, applyLeave, decideLeave };
