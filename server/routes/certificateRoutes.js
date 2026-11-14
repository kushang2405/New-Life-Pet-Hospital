const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const createCrudRoutes = require('./crudRoutes');
const { authRequired } = require('../middleware/authMiddleware');
const Certificate = require('../models/Certificate');

const router = express.Router();

router.get(
  '/',
  authRequired,
  asyncHandler(async (req, res) => {
    const docs = await Certificate.find({}, { pdfData: 0 }).sort({ createdAt: -1 }).lean();
    res.json(docs.map((doc) => ({ ...doc, id: doc._id.toString() })));
  }),
);

router.use('/', createCrudRoutes(Certificate));

module.exports = router;
