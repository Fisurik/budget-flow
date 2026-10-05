const { json, getPlaidItemByItemId, syncOneItem } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const expected = process.env.PLAID_WEBHOOK_SECRET || '';
    if (expected && String(req.query?.secret || '') !== expected) {
      return json(res, 401, { error: 'Invalid webhook secret' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const itemId = body.item_id;
    if (!itemId) return json(res, 200, { ok: true, ignored: true });

    // Only react to transaction changes. Other Plaid webhooks are acknowledged and ignored.
    if (body.webhook_type !== 'TRANSACTIONS') return json(res, 200, { ok: true, ignored: true });
    const interesting = new Set(['SYNC_UPDATES_AVAILABLE', 'DEFAULT_UPDATE', 'INITIAL_UPDATE', 'HISTORICAL_UPDATE', 'TRANSACTIONS_REMOVED']);
    if (!interesting.has(body.webhook_code)) return json(res, 200, { ok: true, ignored: true });

    const item = await getPlaidItemByItemId(itemId);
    if (!item) return json(res, 200, { ok: true, ignored: true });
    const sync = await syncOneItem(item.user_id, item);
    return json(res, 200, { ok: true, synced: true, ...sync });
  } catch (err) {
    console.error('Plaid webhook:', err);
    // Return 200 so Plaid does not aggressively retry a malformed/obsolete event.
    return json(res, 200, { ok: false, error: err.message });
  }
};
