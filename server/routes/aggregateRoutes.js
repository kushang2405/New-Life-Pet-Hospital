const express = require('express');
const { aggregate } = require('../controllers/aggregateController');
const { authRequired } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/aggregate', authRequired, aggregate);

module.exports = router;
