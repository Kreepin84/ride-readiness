export default async function handler(req, res) {
  try {
    const r = await fetch('https://ride-sync-one.vercel.app/api/sync');
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, status: r.status, body });
    }
    return res.status(200).json({ ok: true, ...body });
  } catch (e) {
    console.error('trigger-sync proxy failed', e);
    return res.status(502).json({ ok: false, error: 'Could not reach the sync job.' });
  }
}
