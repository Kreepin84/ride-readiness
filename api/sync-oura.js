// Pulls sleep, HRV and readiness from the Oura v2 API into daily_log.
//
// Replaces the Tasker -> Health Connect -> Supabase pipeline, which depended on
// the phone being awake and the app not being killed, and which silently stopped
// producing rows when the Galaxy Ring went back. This runs server-side on a
// schedule instead, so there is nothing on the phone to fail.
//
// Auth: OAuth. Oura deprecated personal access tokens in December 2025, so the
// token pair lives in the oura_tokens table and is refreshed here as needed.
// Run /api/oura-auth once to seed it.
//
// Env vars (Vercel):
//   OURA_CLIENT_ID, OURA_CLIENT_SECRET
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   SYNC_SECRET                - optional; if set, callers must supply it
//
// GET /api/sync-oura            -> last 7 days
// GET /api/sync-oura?days=180   -> backfill (Oura keeps full history)

const OURA_BASE = 'https://api.ouraring.com/v2/usercollection';
const TOKEN_URL = 'https://api.ouraring.com/oauth/token';
const MAX_DAYS = 400;
const REFRESH_IF_EXPIRING_WITHIN_MS = 24 * 60 * 60 * 1000;

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sbHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
}

async function loadTokens(SUPABASE_URL, SERVICE_KEY) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/oura_tokens?id=eq.1&select=*`, {
    headers: sbHeaders(SERVICE_KEY)
  });
  if (!r.ok) throw new Error(`Could not read oura_tokens: ${await r.text()}`);
  const rows = await r.json();
  return rows && rows[0] ? rows[0] : null;
}

async function saveTokens(SUPABASE_URL, SERVICE_KEY, tok) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/oura_tokens?on_conflict=id`, {
    method: 'POST',
    headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: 1, ...tok, updated_at: new Date().toISOString() })
  });
  if (!r.ok) throw new Error(`Could not store oura_tokens: ${await r.text()}`);
}

// Oura rotates the refresh token on every refresh and the old one dies
// immediately, so the new pair is written back before it's used for anything.
async function getAccessToken(SUPABASE_URL, SERVICE_KEY, CLIENT_ID, CLIENT_SECRET) {
  const row = await loadTokens(SUPABASE_URL, SERVICE_KEY);
  if (!row || !row.refresh_token) {
    const err = new Error('No Oura token stored. Visit /api/oura-auth once to connect.');
    err.status = 401;
    throw err;
  }

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (row.access_token && expiresAt - Date.now() > REFRESH_IF_EXPIRING_WITHIN_MS) {
    return row.access_token;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  });
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const tok = await r.json().catch(() => ({}));
  if (!r.ok || !tok.access_token) {
    const err = new Error(`Oura refresh failed: ${JSON.stringify(tok).slice(0, 200)}. Re-run /api/oura-auth.`);
    err.status = 401;
    throw err;
  }

  await saveTokens(SUPABASE_URL, SERVICE_KEY, {
    access_token: tok.access_token,
    // Oura may omit the refresh token on some responses; keep the old one if so.
    refresh_token: tok.refresh_token || row.refresh_token,
    expires_at: new Date(Date.now() + ((tok.expires_in || 86400) * 1000)).toISOString()
  });

  return tok.access_token;
}

// Follows next_token, since a long backfill of per-night sleep records pages.
async function ouraGet(path, token, startDate, endDate) {
  const out = [];
  let next = null;
  do {
    let url = `${OURA_BASE}/${path}?start_date=${startDate}&end_date=${endDate}`;
    if (next) url += `&next_token=${encodeURIComponent(next)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      const err = new Error(`Oura ${path} returned ${r.status}: ${body.slice(0, 200)}`);
      err.status = r.status;
      throw err;
    }
    const json = await r.json();
    if (Array.isArray(json.data)) out.push(...json.data);
    next = json.next_token || null;
  } while (next);
  return out;
}

// Oura reports several sleep periods per night — naps and short rests included —
// and only the main one carries meaningful HRV and resting HR. Prefer an
// explicit long_sleep; otherwise fall back to the longest period, so a nap's
// HRV never gets stored as the night's value.
function pickMainSleep(periods) {
  const byDay = new Map();
  for (const p of periods) {
    const day = p.day;
    if (!day) continue;
    const existing = byDay.get(day);
    if (!existing) { byDay.set(day, p); continue; }

    const pIsLong = p.type === 'long_sleep';
    const eIsLong = existing.type === 'long_sleep';
    if (pIsLong && !eIsLong) { byDay.set(day, p); continue; }
    if (!pIsLong && eIsLong) continue;
    if ((p.total_sleep_duration || 0) > (existing.total_sleep_duration || 0)) byDay.set(day, p);
  }
  return byDay;
}

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const CLIENT_ID = process.env.OURA_CLIENT_ID;
  const CLIENT_SECRET = process.env.OURA_CLIENT_SECRET;
  const SYNC_SECRET = process.env.SYNC_SECRET;

  if (SYNC_SECRET) {
    const supplied = req.headers['x-sync-secret'] || (req.query && req.query.secret);
    if (supplied !== SYNC_SECRET) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  const missing = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SERVICE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!CLIENT_ID) missing.push('OURA_CLIENT_ID');
  if (!CLIENT_SECRET) missing.push('OURA_CLIENT_SECRET');
  if (missing.length) {
    return res.status(500).json({ ok: false, error: `Server not configured; missing: ${missing.join(', ')}` });
  }

  const requested = parseInt((req.query && req.query.days) || '7', 10);
  const days = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_DAYS) : 7;

  const start = new Date();
  start.setDate(start.getDate() - days);

  // end_date on the detailed /sleep endpoint behaves as EXCLUSIVE, so asking for
  // today returns nothing for last night — which is exactly the record carrying
  // HRV and resting HR. Querying a day past today fixes it; rows are keyed by
  // their own `day` field, so the extra day costs nothing.
  const endPadded = new Date();
  endPadded.setDate(endPadded.getDate() + 1);

  const startDate = isoDate(start);
  const endDate = isoDate(endPadded);

  try {
    const token = await getAccessToken(SUPABASE_URL, SERVICE_KEY, CLIENT_ID, CLIENT_SECRET);

    // Three endpoints, because no single one carries everything:
    //   sleep           -> duration, stages, HRV, resting HR, efficiency
    //   daily_sleep     -> Oura's sleep score
    //   daily_readiness -> readiness score and temperature deviation
    const [sleepPeriods, dailySleep, dailyReadiness] = await Promise.all([
      ouraGet('sleep', token, startDate, endDate),
      ouraGet('daily_sleep', token, startDate, endDate),
      ouraGet('daily_readiness', token, startDate, endDate)
    ]);

    const mainSleep = pickMainSleep(sleepPeriods);
    const sleepScoreByDay = new Map(dailySleep.map(d => [d.day, d.score]));
    const readinessByDay = new Map(dailyReadiness.map(d => [d.day, d]));

    const todayKey = isoDate(new Date());
    const allDays = new Set([
      ...mainSleep.keys(),
      ...sleepScoreByDay.keys(),
      ...readinessByDay.keys()
    ]);

    const rows = [];
    for (const day of allDays) {
      if (day > todayKey) continue;   // drop anything from the padded end date
      const s = mainSleep.get(day);
      const r = readinessByDay.get(day);
      const contributors = (r && r.contributors) || {};

      rows.push({
        log_date: day,
        // total_sleep_duration is seconds of actual sleep, excluding awake time.
        sleep_duration_ms: s && s.total_sleep_duration != null ? s.total_sleep_duration * 1000 : null,
        avg_heart_rate: s && s.average_heart_rate != null ? s.average_heart_rate : null,
        resting_hr: s && s.lowest_heart_rate != null ? s.lowest_heart_rate : null,
        hrv_ms: s && s.average_hrv != null ? s.average_hrv : null,
        sleep_efficiency: s && s.efficiency != null ? s.efficiency : null,
        deep_sleep_ms: s && s.deep_sleep_duration != null ? s.deep_sleep_duration * 1000 : null,
        rem_sleep_ms: s && s.rem_sleep_duration != null ? s.rem_sleep_duration * 1000 : null,
        sleep_score: sleepScoreByDay.has(day) ? sleepScoreByDay.get(day) : null,
        readiness_score: r && r.score != null ? r.score : null,
        temp_deviation_c: r && r.temperature_deviation != null ? r.temperature_deviation : null,
        spo2_pct: contributors.spo2 != null ? contributors.spo2 : null,
        source: 'oura',
        updated_at: new Date().toISOString()
      });
    }

    if (!rows.length) {
      return res.status(200).json({
        ok: true, synced: 0,
        note: 'Oura returned no data for this range. A new ring usually needs a night or two before it reports.'
      });
    }

    rows.sort((a, b) => a.log_date.localeCompare(b.log_date));

    const up = await fetch(`${SUPABASE_URL}/rest/v1/daily_log?on_conflict=log_date`, {
      method: 'POST',
      headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(rows)
    });

    if (!up.ok) {
      const t = await up.text();
      console.error('Supabase upsert failed', t);
      return res.status(502).json({ ok: false, error: t.slice(0, 300) });
    }

    const latest = rows[rows.length - 1];
    const withHrv = rows.filter(r => r.hrv_ms != null).length;
    return res.status(200).json({
      ok: true,
      synced: rows.length,
      with_hrv: withHrv,
      range: { from: startDate, to: endDate },
      latest: {
        date: latest.log_date,
        sleep_hrs: latest.sleep_duration_ms ? +(latest.sleep_duration_ms / 3600000).toFixed(1) : null,
        hrv_ms: latest.hrv_ms,
        resting_hr: latest.resting_hr,
        readiness_score: latest.readiness_score
      }
    });
  } catch (e) {
    console.error('Oura sync failed', e);
    const status = e.status === 401 || e.status === 403 ? 401 : 502;
    return res.status(status).json({ ok: false, error: String(e.message || e).slice(0, 300) });
  }
}
