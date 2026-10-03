const { json, requireUser, plaid, savePlaidItem, syncOneItem } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.public_token) return json(res, 400, { error: 'Missing public_token' });

    const exchange = await plaid('/item/public_token/exchange', { public_token: body.public_token });
    const saved = await savePlaidItem({
      user_id: user.id,
      item_id: exchange.item_id,
      access_token: exchange.access_token,
      institution_id: body.institution_id || null,
      institution_name: body.institution_name || null,
      cursor: null,
      updated_at: new Date().toISOString(),
    });
    let sync = { added: 0, modified: 0, removed: 0, pages: 0 };
    try { if (saved) sync = await syncOneItem(user.id, saved); } catch (syncErr) { console.warn('Initial Plaid sync:', syncErr.message); }
    return json(res, 200, { ok: true, item_id: exchange.item_id, sync });
  } catch (err) {
    console.error(err);
    return json(res, err.status || 500, { error: err.message, details: err.details || null });
  }
};
