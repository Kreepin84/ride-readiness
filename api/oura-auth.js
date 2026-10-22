// One-time OAuth setup for Oura.
//
// Oura deprecated personal access tokens in December 2025, so the only way in is
// the authorization-code flow. This route handles both halves of it:
//
//   GET /api/oura-auth          -> redirects to Oura's consent screen
//   GET /api/oura-auth?code=... -> Oura redirects back here; exchanges the code
//                                  and stores the token pair in Supabase
//
// After this runs once, sync-oura.js keeps itself alive off the stored refresh
// token and you never need to touch this again.
//
// Env vars: OURA_CLIENT_ID, OURA_CLIENT_SECRET, SUPABASE_URL,
//           SUPABASE_SERVICE_ROLE_KEY, optional OURA_REDIRECT_URI

const AUTHORIZE_URL = 'https://cloud.ouraring.com/oauth/authorize';
const TOKEN_URL = 'https://api.ouraring.com/oauth/token';
const SCOPES = 'daily heartrate workout personal session';

function redirectUri(req) {
  if (process.env.OURA_REDIRECT_URI) return process.env.OURA_REDIRECT_URI;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}/api/oura-auth`;
}

export default async function handler(req, res) {
  const CLIENT_ID = process.env.OURA_CLIENT_ID;
  const CLIENT_SECRET = process.env.OURA_CLIENT_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing = [];
  if (!CLIENT_ID) missing.push('OURA_CLIENT_ID');
  if (!CLIENT_SECRET) missing.push('OURA_CLIENT_SECRET');
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SERVICE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    return res.status(500).json({ ok: false, error: `Server not configured; missing: ${missing.join(', ')}` });
  }

  const uri = redirectUri(req);
  const code = req.query && req.query.code;
  const oauthError = req.query && req.query.error;

  if (oauthError) {
    return res.status(400).send(`<h2>Oura returned an error</h2><p>${String(oauthError).slice(0, 200)}</p>`);
  }

  // First leg: bounce the user to Oura's consent screen.
  if (!code) {
    const url = `${AUTHORIZE_URL}?response_type=code`
      + `&client_id=${encodeURIComponent(CLIENT_ID)}`
      + `&redirect_uri=${encodeURIComponent(uri)}`
      + `&scope=${encodeURIComponent(SCOPES)}`
      + `&state=rr`;
    res.writeHead(302, { Location: url });
    return res.end();
  }

  // Second leg: swap the code for a token pair and store it.
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: uri,
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
      console.error('Oura token exchange failed', tok);
      return res.status(502).send(`<h2>Token exchange failed</h2><pre>${JSON.stringify(tok).slice(0, 400)}</pre>`);
    }

    const expiresAt = new Date(Date.now() + ((tok.expires_in || 86400) * 1000)).toISOString();

    const up = await fetch(`${SUPABASE_URL}/rest/v1/oura_tokens?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: 1,
        access_token: tok.access_token,
        refresh_token: tok.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
    });

    if (!up.ok) {
      const t = await up.text();
      console.error('Storing Oura tokens failed', t);
      return res.status(502).send(`<h2>Could not store the token</h2><pre>${t.slice(0, 400)}</pre>`);
    }

    return res.status(200).send(
      `<body style="font-family:system-ui;padding:40px;max-width:520px">
         <h2>Oura connected</h2>
         <p>Token stored. The nightly sync will pick it up from here — you shouldn't need this page again.</p>
         <p>To backfill history now, open <code>/api/sync-oura?days=180</code>.</p>
       </body>`
    );
  } catch (e) {
    console.error('Oura auth failed', e);
    return res.status(500).send('<h2>Something went wrong</h2><p>Check the function logs in Vercel.</p>');
  }
}
