/**
 * Attendance routes — punch in/out, leave requests, leave decisions.
 */
const express = require('express');
const router = express.Router();
const { authRequired, requireRole } = require('../middleware/authMiddleware');
const { punch, applyLeave, decideLeave } = require('../controllers/attendanceController');

router.post('/punch', authRequired, punch);
router.post('/leave', authRequired, applyLeave);
router.put('/leave/:staffId/:leaveId', authRequired, requireRole('Super Admin'), decideLeave);

module.exports = router;
