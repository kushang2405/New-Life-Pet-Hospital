const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { authRequired } = require('../middleware/authMiddleware');

const router = express.Router();
const REPORT_TYPES = ['BIO', 'CBC'];
const MAX_IMAGES = 10;
const SINGLE_IMAGE_TIMEOUT_MS = 12000;

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
      signal: AbortSignal.timeout(8000),
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

      // Fast models priority: flash-8b, flash, then any gemini
      const preferred =
        usable.find((m) => m.name.includes('flash-8b')) ||
        usable.find((m) => m.name.includes('flash') && !m.name.includes('exp')) ||
        usable.find((m) => m.name.includes('flash')) ||
        usable.find((m) => m.name.includes('gemini')) ||
        usable[0];

      if (preferred) {
        cachedModel = preferred.name.replace(/^models\//, '');
        console.log('[ocr] Automatically selected Gemini model:', cachedModel);
        return cachedModel;
      }
    }
  } catch (err) {
    console.warn('[ocr] ListModels notice:', err.message);
  }

  cachedModel = 'gemini-1.5-flash';
  return cachedModel;
}

// Single image extractor - fast, lightweight, no wasted tokens
async function extractSingleImage(modelName, apiKey, reportType, image) {
  const dataUrl = image.dataUrl || '';
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = match ? match[1] : 'image/jpeg';
  const data = match ? match[2] : dataUrl.split(',').pop();

  const prompt = `You are an expert veterinary laboratory diagnostics technician and automated data extraction engine.
Analyze this ${reportType === 'CBC' ? 'Complete Blood Count (CBC)' : 'Biochemistry (BIO)'} test report photo.
Extract all test analyte rows found in the table.

Return ONLY a valid JSON object matching this schema:
{
  "rows": [
    {
      "section": "${reportType === 'CBC' ? 'CBC' : 'Liver Profile | Kidney Profile | Pancreatic Profile | Lipid Profile | Other'}",
      "name": "analyte name (e.g. WBC, RBC, Urea, Creatinine, ALT)",
      "result": "result number or value",
      "unit": "measurement unit or empty string",
      "referenceRange": "reference/normal range or empty string",
      "remarks": "flag (H, L, or empty string)",
      "needsReview": false
    }
  ]
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(SINGLE_IMAGE_TIMEOUT_MS),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error?.message || `Gemini API error (${res.status})`);
  }

  const json = await res.json();
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return [];

  try {
    const parsed = JSON.parse(rawText);
    return Array.isArray(parsed.rows) ? parsed.rows : [];
  } catch {
    return [];
  }
}

// Automatic retry wrapper to guard against transient network/API hiccups
async function extractWithRetry(modelName, apiKey, reportType, image, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await extractSingleImage(modelName, apiKey, reportType, image);
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[ocr] Image request attempt ${attempt + 1} failed (${err.message}). Retrying in 1.2s...`);
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
}

router.post('/extract', authRequired, asyncHandler(async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      message: 'Gemini API key is not configured. Please add GEMINI_API_KEY to your settings.',
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

  // Process all images in parallel with retry and graceful error boundaries
  const settled = await Promise.allSettled(
    images.map((img) => extractWithRetry(modelName, apiKey, reportType, img))
  );

  const seen = new Set();
  const allRows = [];
  const warnings = [];
  let failedPages = 0;

  settled.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      const pageRows = result.value || [];
      for (const r of pageRows) {
        const name = String(r.name || '').trim();
        if (!name) continue;
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (seen.has(key)) continue;
        seen.add(key);

        allRows.push({
          section: String(r.section || (reportType === 'CBC' ? 'CBC' : 'Other')).trim(),
          name,
          result: String(r.result || '').trim(),
          unit: String(r.unit || '').trim(),
          referenceRange: String(r.referenceRange || '').trim(),
          remarks: String(r.remarks || '').trim(),
          needsReview: Boolean(r.needsReview),
        });
      }
    } else {
      failedPages++;
      console.error(`[ocr] Photo ${idx + 1} extraction failed:`, result.reason?.message);
    }
  });

  if (allRows.length === 0 && failedPages > 0) {
    return res.status(502).json({
      message: 'The report reader timed out while reaching Google AI. Please try again with clear photos.',
    });
  }

  if (failedPages > 0) {
    warnings.push(`${failedPages} of ${images.length} photo(s) took too long, but other pages were read successfully.`);
  } else if (allRows.length === 0) {
    warnings.push('No test rows were found. Please ensure the photos clearly show the table.');
  }

  const rawText = allRows
    .map((r) => `${r.name}: ${r.result} ${r.unit} ${r.referenceRange ? `(${r.referenceRange})` : ''} ${r.remarks}`.trim())
    .join('\n');

  res.json({
    rows: allRows,
    warnings,
    rawText,
  });
}));

module.exports = router;
