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

// A day's sleep has to total at least this long to count as a night. Without a
// floor, a day whose only record is a short nap gets stored as that night's
// recovery data — a 12-minute record once produced HRV 8 and a resting HR of 91,
// which then reads as a catastrophic night rather than as no night.
const MIN_MAIN_SLEEP_S = 3 * 3600;

// A fragment has to be at least this long to join an aggregate. Below this a
// period is a doze rather than a sleep block, and its HRV is noise that would
// drag the weighted average around.
const MIN_FRAGMENT_S = 45 * 60;

function dur(p) {
  return p && p.total_sleep_duration != null ? p.total_sleep_duration : 0;
}

// Combines a day's sleep fragments into one synthetic period.
//
// Durations and stage times add up. HRV is averaged weighted by how long each
// fragment ran, so a 3-hour block counts for more than a 1-hour one. Resting HR
// takes the lowest value seen across the day, which is what the field means —
// it is the overnight low, not an average of lows. Average HR is
// duration-weighted like HRV. Efficiency is recomputed over the combined
// fragments rather than averaged, since averaging percentages over unequal
// spans is wrong.
function combineFragments(day, periods) {
  const total = periods.reduce((n, p) => n + dur(p), 0);

  const weighted = (field) => {
    let sum = 0, weight = 0;
    for (const p of periods) {
      const v = p[field];
      if (v == null) continue;
      sum += v * dur(p);
      weight += dur(p);
    }
    return weight > 0 ? sum / weight : null;
  };

  const stage = (field) => {
    let sum = 0, seen = false;
    for (const p of periods) {
      if (p[field] == null) continue;
      sum += p[field];
      seen = true;
    }
    return seen ? sum : null;
  };

  const lows = periods.map(p => p.lowest_heart_rate).filter(v => v != null);

  // efficiency is a percentage of time in bed spent asleep; rebuild it from the
  // underlying durations where they are available.
  let efficiency = null;
  const inBed = periods.reduce((n, p) => n + (p.time_in_bed || 0), 0);
  if (inBed > 0) efficiency = Math.round(total / inBed * 100);
  else {
    const w = weighted('efficiency');
    efficiency = w == null ? null : Math.round(w);
  }

  return {
    day,
    type: 'combined_fragments',
    fragment_count: periods.length,
    total_sleep_duration: total,
    average_hrv: weighted('average_hrv'),
    average_heart_rate: weighted('average_heart_rate'),
    lowest_heart_rate: lows.length ? Math.min(...lows) : null,
    efficiency,
    deep_sleep_duration: stage('deep_sleep_duration'),
    rem_sleep_duration: stage('rem_sleep_duration')
  };
}

// Oura reports several sleep periods per night — naps and short rests included —
// and only the main one carries meaningful HRV and resting HR. Prefer an
// explicit long_sleep; otherwise take the longest period that clears the floor.
//
// When no single period clears it, fall back to combining the day's fragments.
// That case is the norm on nightshift: a day's sleep split into two or three
// blocks of 2-3 hours each is five or six hours of real recorded data, and
// taking the single-period rule literally threw all of it away. Five of the
// first six Oura days stored nothing for exactly this reason, and a day with no
// recovery data falls back to the readiness cap of 70, which reads as a
// mediocre night rather than as a missing one.
//
// The floor still applies to the combined total, so a day whose only records
// are genuine naps continues to store nothing.
function pickMainSleep(periods) {
  const candidates = new Map();
  for (const p of periods) {
    if (!p.day) continue;
    if (!candidates.has(p.day)) candidates.set(p.day, []);
    candidates.get(p.day).push(p);
  }

  const byDay = new Map();
  for (const [day, dayPeriods] of candidates) {
    let best = null;
    for (const p of dayPeriods) {
      if (dur(p) < MIN_MAIN_SLEEP_S) continue;
      if (!best) { best = p; continue; }

      const pIsLong = p.type === 'long_sleep';
      const bIsLong = best.type === 'long_sleep';
      if (pIsLong && !bIsLong) { best = p; continue; }
      if (!pIsLong && bIsLong) continue;
      if (dur(p) > dur(best)) best = p;
    }

    if (best) { byDay.set(day, best); continue; }

    const fragments = dayPeriods.filter(p => dur(p) >= MIN_FRAGMENT_S);
    if (fragments.length < 2) continue;
    const total = fragments.reduce((n, p) => n + dur(p), 0);
    if (total < MIN_MAIN_SLEEP_S) continue;

    byDay.set(day, combineFragments(day, fragments));
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

    const allDays = new Set([
      ...mainSleep.keys(),
      ...sleepScoreByDay.keys(),
      ...readinessByDay.keys()
    ]);

    // No filtering against "today" here. This function runs on Vercel in UTC,
    // and Sydney is 10-11 hours ahead, so for most of the local day the server's
    // date is still yesterday. An earlier version discarded any day after the
    // server's today to drop the padded end date, which silently threw away last
    // night's record — the only one that mattered. Oura only returns days it has
    // data for, so the padding never produces a spurious row and no filter is
    // needed.
    const rows = [];
    for (const day of allDays) {
      const s = mainSleep.get(day);
      const r = readinessByDay.get(day);
      const contributors = (r && r.contributors) || {};

      // A day with no usable sleep period and no scores carries nothing. Writing
      // it anyway creates a row that looks like a reading but holds only nulls,
      // and the dashboard then treats it as the latest night.
      if (!s && !sleepScoreByDay.has(day) && !(r && r.score != null)) continue;

      // Only fields we actually have are sent. The upsert merges on log_date, so
      // a key present with a null value overwrites whatever is already stored —
      // which meant a re-sync over a day Oura no longer returns a main sleep for
      // wiped a row that had synced correctly days earlier. Omitting the key
      // instead leaves the stored value alone, so a re-sync can only ever add.
      // The trade-off is that a value Oura later retracts is never cleared;
      // that is the right way round for a record of nights already slept.
      const row = {
        log_date: day,
        source: 'oura',
        updated_at: new Date().toISOString()
      };
      const put = (key, value) => { if (value != null) row[key] = value; };

      // total_sleep_duration is seconds of actual sleep, excluding awake time.
      put('sleep_duration_ms', s && s.total_sleep_duration != null ? s.total_sleep_duration * 1000 : null);
      put('avg_heart_rate', s && s.average_heart_rate != null ? s.average_heart_rate : null);
      put('resting_hr', s && s.lowest_heart_rate != null ? s.lowest_heart_rate : null);
      put('hrv_ms', s && s.average_hrv != null ? s.average_hrv : null);
      put('sleep_efficiency', s && s.efficiency != null ? s.efficiency : null);
      put('deep_sleep_ms', s && s.deep_sleep_duration != null ? s.deep_sleep_duration * 1000 : null);
      put('rem_sleep_ms', s && s.rem_sleep_duration != null ? s.rem_sleep_duration * 1000 : null);
      put('sleep_score', sleepScoreByDay.has(day) ? sleepScoreByDay.get(day) : null);
      put('readiness_score', r && r.score != null ? r.score : null);
      put('temp_deviation_c', r && r.temperature_deviation != null ? r.temperature_deviation : null);
      put('spo2_pct', contributors.spo2 != null ? contributors.spo2 : null);

      rows.push(row);
    }

    if (!rows.length) {
      return res.status(200).json({
        ok: true, synced: 0,
        note: 'Oura returned no data for this range. A new ring usually needs a night or two before it reports.'
      });
    }

    rows.sort((a, b) => a.log_date.localeCompare(b.log_date));

    // PostgREST requires every object in one bulk insert to carry the same keys,
    // and rows now differ in shape — a day with a main sleep has the sleep
    // columns, a scores-only day does not. Group by key signature and send one
    // request per shape. In practice that is two requests at most, well inside
    // the rate limit that a request-per-day loop would trip.
    const groups = new Map();
    for (const row of rows) {
      const sig = Object.keys(row).sort().join(',');
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(row);
    }

    for (const group of groups.values()) {
      const up = await fetch(`${SUPABASE_URL}/rest/v1/daily_log?on_conflict=log_date`, {
        method: 'POST',
        headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(group)
      });

      if (!up.ok) {
        const t = await up.text();
        console.error('Supabase upsert failed', t);
        return res.status(502).json({ ok: false, error: t.slice(0, 300) });
      }
    }

    const latest = rows[rows.length - 1];
    const withHrv = rows.filter(r => r.hrv_ms != null).length;

    // Which days were rebuilt from fragments rather than a single period. On a
    // nightshift block this is most of them, and it is the first thing to look
    // at when a night's numbers read oddly.
    const combined = [...mainSleep.entries()]
      .filter(([, s]) => s.type === 'combined_fragments')
      .map(([day, s]) => ({ day, fragments: s.fragment_count }));

    return res.status(200).json({
      ok: true,
      synced: rows.length,
      with_hrv: withHrv,
      combined_from_fragments: combined,
      range: { from: startDate, to: endDate },
      latest: {
        date: latest.log_date,
        sleep_hrs: latest.sleep_duration_ms ? +(latest.sleep_duration_ms / 3600000).toFixed(1) : null,
        hrv_ms: latest.hrv_ms != null ? latest.hrv_ms : null,
        resting_hr: latest.resting_hr != null ? latest.resting_hr : null,
        readiness_score: latest.readiness_score != null ? latest.readiness_score : null
      }
    });
  } catch (e) {
    console.error('Oura sync failed', e);
    const status = e.status === 401 || e.status === 403 ? 401 : 502;
    return res.status(status).json({ ok: false, error: String(e.message || e).slice(0, 300) });
  }
}
