// Pulls sleep, HRV and readiness from the Oura v2 API into daily_log.
//
// Replaces the Tasker -> Health Connect -> Supabase pipeline, which depended on
// the phone being awake and the app not being killed, and which silently stopped
// producing rows when the Galaxy Ring went back. This runs server-side on a
// schedule instead, so there is nothing on the phone to fail.
//
// Env vars (Vercel):
//   OURA_ACCESS_TOKEN          - personal access token from cloud.ouraring.com
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  - server-side only, never sent to the browser
//   SYNC_SECRET                - optional; if set, callers must supply it
//
// GET /api/sync-oura            -> last 7 days
// GET /api/sync-oura?days=180   -> backfill (Oura keeps full history, so one
//                                  call can populate the whole dashboard)

const OURA_BASE = 'https://api.ouraring.com/v2/usercollection';
const MAX_DAYS = 400;

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function ouraGet(path, token, startDate, endDate) {
  const url = `${OURA_BASE}/${path}?start_date=${startDate}&end_date=${endDate}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    const err = new Error(`Oura ${path} returned ${r.status}: ${body.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  const json = await r.json();
  return Array.isArray(json.data) ? json.data : [];
}

// Oura reports several sleep periods per night (naps included). Only the main
// sleep period carries meaningful HRV and resting HR, so naps are discarded and,
// if two long sleeps share a day, the longer one wins.
function pickMainSleep(periods) {
  const byDay = new Map();
  for (const p of periods) {
    if (p.type && p.type !== 'long_sleep' && p.type !== 'sleep') continue;
    const day = p.day;
    const existing = byDay.get(day);
    if (!existing || (p.total_sleep_duration || 0) > (existing.total_sleep_duration || 0)) {
      byDay.set(day, p);
    }
  }
  return byDay;
}

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const OURA_TOKEN = process.env.OURA_ACCESS_TOKEN;
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
  if (!OURA_TOKEN) missing.push('OURA_ACCESS_TOKEN');
  if (missing.length) {
    return res.status(500).json({ ok: false, error: `Server not configured; missing: ${missing.join(', ')}` });
  }

  const requested = parseInt((req.query && req.query.days) || '7', 10);
  const days = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_DAYS) : 7;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = isoDate(start);
  const endDate = isoDate(end);

  try {
    // Three endpoints, because no single one carries everything:
    //   sleep           -> duration, stages, HRV, resting HR, efficiency
    //   daily_sleep     -> Oura's sleep score
    //   daily_readiness -> readiness score and temperature deviation
    const [sleepPeriods, dailySleep, dailyReadiness] = await Promise.all([
      ouraGet('sleep', OURA_TOKEN, startDate, endDate),
      ouraGet('daily_sleep', OURA_TOKEN, startDate, endDate),
      ouraGet('daily_readiness', OURA_TOKEN, startDate, endDate)
    ]);

    const mainSleep = pickMainSleep(sleepPeriods);
    const sleepScoreByDay = new Map(dailySleep.map(d => [d.day, d.score]));
    const readinessByDay = new Map(dailyReadiness.map(d => [d.day, d]));

    const allDays = new Set([
      ...mainSleep.keys(),
      ...sleepScoreByDay.keys(),
      ...readinessByDay.keys()
    ]);

    const rows = [];
    for (const day of allDays) {
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
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(rows)
    });

    if (!up.ok) {
      const t = await up.text();
      console.error('Supabase upsert failed', t);
      return res.status(502).json({ ok: false, error: t.slice(0, 300) });
    }

    const latest = rows[rows.length - 1];
    return res.status(200).json({
      ok: true,
      synced: rows.length,
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
    return res.status(status).json({
      ok: false,
      error: status === 401
        ? 'Oura rejected the token. Check OURA_ACCESS_TOKEN in Vercel.'
        : String(e.message || e).slice(0, 300)
    });
  }
}
