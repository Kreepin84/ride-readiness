// Server-side only — SUPABASE_SERVICE_ROLE_KEY is a Vercel env var, never sent to the browser.
// This replaces the open public write policy that let anyone with the anon key edit ride_ratings directly.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ride_id, user_score, note, auto_score } = req.body || {};

  const rideId = Number(ride_id);
  if (!Number.isInteger(rideId) || rideId <= 0) {
    return res.status(400).json({ error: 'Invalid ride_id' });
  }
  if (user_score !== null && user_score !== undefined) {
    const score = Number(user_score);
    if (Number.isNaN(score) || score < 0 || score > 10) {
      return res.status(400).json({ error: 'user_score must be between 0 and 10' });
    }
  }
  const cleanNote = note ? String(note).slice(0, 500) : null;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const payload = {
    ride_id: rideId,
    user_score: user_score ?? null,
    note: cleanNote,
    updated_at: new Date().toISOString()
  };
  if (auto_score !== undefined && auto_score !== null) payload.auto_score = auto_score;

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/ride_ratings?on_conflict=ride_id`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
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
