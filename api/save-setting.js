// Server-side only — SUPABASE_SERVICE_ROLE_KEY is a Vercel env var, never sent to the browser.
// This replaces the old client-side upsert that used the public anon key with an open write policy.

const ALLOWED_KEYS = [
  'torqueEff', 'ftp', 'vo2max', 'weight', 'rosterAnchor', 'programStart',
  'hrExcellent', 'hrPoor', 'weeklyLoadTarget', 'weeklyHoursTarget', 'ftpTestDate', 'ftpTestIntervalWeeks',
  'lastUpdated'
];

// Basic in-memory rate limit: max 20 requests per IP per 60s.
// Resets on cold start, but catches rapid bursts within a warm instance \u2014
// which is exactly the pattern that caused a prior traffic spike to eat legitimate saves.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const requestLog = globalThis.__saveSettingRequestLog || (globalThis.__saveSettingRequestLog = new Map());

function isRateLimited(ip){
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests, slow down and try again in a minute.' });
  }

  const { key, value } = req.body || {};

  if (!key || !ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Invalid or missing key' });
  }
  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'Missing value' });
  }
  // Basic sanity bounds so a bad request can't write garbage into numeric fields
  if (key !== 'rosterAnchor' && key !== 'programStart' && key !== 'ftpTestDate' && key !== 'lastUpdated') {
    const num = Number(value);
    if (Number.isNaN(num) || Math.abs(num) > 1000000) {
      return res.status(400).json({ error: 'Value out of range' });
    }
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_settings?on_conflict=key`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ key, value: String(value), updated_at: new Date().toISOString() })
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: t });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Upstream request failed' });
  }
}
