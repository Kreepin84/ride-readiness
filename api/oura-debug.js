// Diagnostic for the Oura connection. Reports exactly what the API returns for
// each endpoint so a silent empty result can be told apart from a scope problem,
// a date-range problem, or an account with genuinely no data.
//
// Deliberately returns no personal content beyond counts, the first available
// date and the field names present — enough to debug, nothing worth leaking.
//
// GET /api/oura-debug

const OURA_BASE = 'https://api.ouraring.com/v2/usercollection';
const TOKEN_URL = 'https://api.ouraring.com/oauth/token';

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sbHeaders(key) {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function probe(path, token, qs) {
  const url = `${OURA_BASE}/${path}${qs ? `?${qs}` : ''}`;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }

    if (!r.ok) {
      return { status: r.status, ok: false, body: text.slice(0, 300) };
    }
    const data = json && Array.isArray(json.data) ? json.data : null;
    if (data === null) {
      // personal_info returns an object rather than a list
      return { status: r.status, ok: true, shape: 'object', keys: json ? Object.keys(json).slice(0, 15) : [] };
    }
    return {
      status: r.status,
      ok: true,
      count: data.length,
      days: data.slice(0, 3).map(d => d.day).filter(Boolean),
      first_item_keys: data[0] ? Object.keys(data[0]).slice(0, 25) : [],
      has_next_token: !!(json && json.next_token)
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e).slice(0, 200) };
  }
}

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const CLIENT_ID = process.env.OURA_CLIENT_ID;
  const CLIENT_SECRET = process.env.OURA_CLIENT_SECRET;

  if (!SUPABASE_URL || !SERVICE_KEY || !CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  try {
    const tr = await fetch(`${SUPABASE_URL}/rest/v1/oura_tokens?id=eq.1&select=*`, {
      headers: sbHeaders(SERVICE_KEY)
    });
    const rows = await tr.json();
    const row = rows && rows[0];
    if (!row || !row.refresh_token) {
      return res.status(401).json({ ok: false, error: 'No token stored. Visit /api/oura-auth.' });
    }

    // Always refresh here, so the probe can never be blamed on a stale token.
    let token = row.access_token;
    let refreshNote = 'used stored access token';
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });
    const rr = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    const tok = await rr.json().catch(() => ({}));
    if (rr.ok && tok.access_token) {
      token = tok.access_token;
      refreshNote = 'refreshed OK';
      // Oura's scope list on the token response is the clearest evidence of
      // what was actually consented to, which is the usual cause of empty data.
      await fetch(`${SUPABASE_URL}/rest/v1/oura_tokens?on_conflict=id`, {
        method: 'POST',
        headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          id: 1,
          access_token: tok.access_token,
          refresh_token: tok.refresh_token || row.refresh_token,
          expires_at: new Date(Date.now() + ((tok.expires_in || 86400) * 1000)).toISOString(),
          updated_at: new Date().toISOString()
        })
      });
    } else {
      refreshNote = `refresh failed: ${JSON.stringify(tok).slice(0, 200)}`;
    }

    const end = new Date(); end.setDate(end.getDate() + 1);
    const start = new Date(); start.setDate(start.getDate() - 30);
    const range = `start_date=${isoDate(start)}&end_date=${isoDate(end)}`;

    const [personal, sleep, dailySleep, readiness] = await Promise.all([
      probe('personal_info', token, ''),
      probe('sleep', token, range),
      probe('daily_sleep', token, range),
      probe('daily_readiness', token, range)
    ]);

    return res.status(200).json({
      ok: true,
      token: {
        note: refreshNote,
        scopes_granted: tok && tok.scope ? tok.scope : '(not reported by Oura)',
        expires_in_s: tok && tok.expires_in ? tok.expires_in : null
      },
      range_queried: range,
      endpoints: { personal_info: personal, sleep, daily_sleep: dailySleep, daily_readiness: readiness }
    });
  } catch (e) {
    console.error('oura-debug failed', e);
    return res.status(500).json({ ok: false, error: String(e.message || e).slice(0, 300) });
  }
}
