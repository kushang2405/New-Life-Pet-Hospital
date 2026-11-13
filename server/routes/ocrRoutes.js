const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { authRequired } = require('../middleware/authMiddleware');

const router = express.Router();
const REPORT_TYPES = ['BIO', 'CBC'];
const MAX_IMAGES = 10;
const TIMEOUT_MS = 60000;

let cachedModel = null;

async function resolveModel(apiKey) {
  if (process.env.GEMINI_MODEL) {
    return process.env.GEMINI_MODEL.replace(/^models\//, '');
  }
  if (cachedModel) {
    return cachedModel;
  }

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (listRes.ok) {
      const data = await listRes.json();
      const models = data.models || [];
      const usable = models.filter((m) =>
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes('generateContent')
      );
      const names = usable.map((m) => m.name.replace(/^models\//, ''));
      console.log('[ocr] Available models for this key:', names.join(', '));

      // Prefer non-experimental flash models first, then any flash, then any gemini model
      const preferred =
        usable.find((m) => m.name.includes('flash') && !m.name.includes('exp')) ||
        usable.find((m) => m.name.includes('flash')) ||
        usable.find((m) => m.name.includes('gemini')) ||
        usable[0];

      if (preferred) {
        cachedModel = preferred.name.replace(/^models\//, '');
        console.log('[ocr] Automatically selected Gemini model:', cachedModel);
        return cachedModel;
      }
    } else {
      console.warn('[ocr] ListModels returned status:', listRes.status);
    }
  } catch (err) {
    console.warn('[ocr] ListModels failed, using fallback:', err.message);
  }

  cachedModel = 'gemini-1.5-flash';
  return cachedModel;
}

router.post('/extract', authRequired, asyncHandler(async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      message: 'Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file or deployment settings.',
    });
  }

  const { reportType, images } = req.body || {};
  if (!REPORT_TYPES.includes(reportType)) {
    return res.status(400).json({ message: 'Choose BIO or CBC before uploading photos.' });
  }
  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_IMAGES) {
    return res.status(400).json({ message: `Upload between 1 and ${MAX_IMAGES} photos.` });
  }

  const modelName = await resolveModel(apiKey);

  // Format base64 images into Gemini inlineData parts
  const imageParts = [];
  for (const img of images) {
    const dataUrl = img.dataUrl || '';
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      imageParts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      });
    } else {
      const parts = dataUrl.split(',');
      imageParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: parts.length > 1 ? parts[1] : parts[0],
        },
      });
    }
  }

  const promptText = `You are an expert veterinary laboratory diagnostics technician and automated data extraction engine.
Analyze the provided veterinary lab test report image(s).
The report type is: ${reportType} (${reportType === 'CBC' ? 'Complete Blood Count' : 'Biochemistry / Chemistry Profile'}).

Extract all analyte test results and parameters found in the report into structured JSON.
For each row/analyte:
- "name": The parameter / test name (e.g., "WBC", "RBC", "HGB", "Total protein", "Albumin", "Creatinine", "ALT", etc.).
- "section": For CBC use "CBC". For BIO assign to clinical profile: "Liver Profile", "Kidney Profile", "Pancreatic Profile", "Lipid Profile", or "Other".
- "result": The numerical or text result (e.g., "8.70", "1.20", "+++++").
- "unit": The measurement unit (e.g., "10^9/L", "g/dL", "mg/dL", "fL", or "" if none).
- "referenceRange": The reference/normal range (e.g., "6.0-17.0", "1.20-2.40", or "" if none listed).
- "remarks": High/Low or abnormal flag ("H", "L", or "").
- "needsReview": boolean (true if the text was blurry or ambiguous, false otherwise).

Also provide:
- "warnings": array of strings if any image is unclear or values could not be read; empty array if all clear.
- "rawText": clean text transcription of all visible test results in the image.

Return ONLY a valid JSON object matching this schema:
{
  "rows": [
    {
      "section": "string",
      "name": "string",
      "result": "string",
      "unit": "string",
      "referenceRange": "string",
      "remarks": "string",
      "needsReview": false
    }
  ],
  "warnings": [],
  "rawText": "string"
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          ...imageParts,
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  let geminiRes;
  try {
    geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[ocr] Gemini API request failed:', err.message);
    return res.status(502).json({ message: 'Unable to reach Gemini OCR service. Please check your network and try again.' });
  }

  const data = await geminiRes.json().catch(() => null);

  if (!geminiRes.ok) {
    console.error('[ocr] Gemini API error:', geminiRes.status, data);
    const msg = data?.error?.message || `Gemini API returned error (${geminiRes.status})`;
    return res.status(502).json({ message: msg });
  }

  const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJsonText) {
    return res.status(502).json({ message: 'No data returned from the Gemini vision model.' });
  }

  let parsed;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch (err) {
    console.error('[ocr] Failed to parse Gemini response as JSON:', rawJsonText);
    return res.status(502).json({ message: 'Invalid response format received from Gemini vision model.' });
  }

  const rows = Array.isArray(parsed.rows) ? parsed.rows.map((r) => ({
    section: String(r.section || (reportType === 'CBC' ? 'CBC' : 'Other')),
    name: String(r.name || '').trim(),
    result: String(r.result || '').trim(),
    unit: String(r.unit || '').trim(),
    referenceRange: String(r.referenceRange || '').trim(),
    remarks: String(r.remarks || '').trim(),
    needsReview: Boolean(r.needsReview),
  })).filter((r) => r.name) : [];

  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
  if (rows.length === 0) {
    warnings.push('No test rows were found. Please ensure the image clearly shows the report table.');
  }

  res.json({
    rows,
    warnings,
    rawText: typeof parsed.rawText === 'string' ? parsed.rawText : '',
  });
}));

module.exports = router;
