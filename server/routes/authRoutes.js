const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/authMiddleware');
const { login, register, me, changePassword, requestReset, confirmReset, updateStatus, setStaffPassword } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authRequired, me);
router.put('/change-password', authRequired, changePassword);
router.post('/request-reset', requestReset);
router.post('/confirm-reset', confirmReset);
router.put('/:id/status', authRequired, updateStatus);
router.put('/:id/password', authRequired, setStaffPassword);

module.exports = router;
