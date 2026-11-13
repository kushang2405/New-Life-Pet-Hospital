const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { authRequired } = require('../middleware/authMiddleware');

const router = express.Router();
const REPORT_TYPES = ['BIO', 'CBC'];
const MAX_IMAGES = 10;
const OCR_TIMEOUT_MS = 180000;

router.post('/extract', authRequired, asyncHandler(async (req, res) => {
  const serviceUrl = process.env.OCR_SERVICE_URL;
  if (!serviceUrl) {
    return res.status(503).json({ message: 'The report reader is not connected yet. Set OCR_SERVICE_URL to the reader address.' });
  }

  const { reportType, images } = req.body || {};
  if (!REPORT_TYPES.includes(reportType)) {
    return res.status(400).json({ message: 'Choose BIO or CBC before uploading photos.' });
  }
  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_IMAGES) {
    return res.status(400).json({ message: `Upload between 1 and ${MAX_IMAGES} photos.` });
  }

  let response;
  try {
    response = await fetch(`${serviceUrl.replace(/\/$/, '')}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType, images }),
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[ocr] Unable to reach OCR service:', err.message);
    return res.status(502).json({ message: 'The report reader is not reachable right now. Please try again shortly.' });
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('[ocr] OCR service error:', response.status, data);
    const detail = typeof data?.detail === 'string'
      ? data.detail
      : `The report reader returned an error (${response.status}). Check the OCR service logs.`;
    return res.status(response.status === 400 ? 400 : 502).json({ message: detail });
  }
  res.json(data);
}));

module.exports = router;
