const { json, requireUser, getPlaidItems, plaid, webhookUrlFromReq } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const items = await getPlaidItems(user.id);
    if (!items.length) return json(res, 200, { ok: true, connected: false, requested: 0 });

    const webhook = webhookUrlFromReq(req);
    const results = [];
    for (const item of items) {
      if (webhook) {
        try {
          await plaid('/item/webhook/update', { access_token: item.access_token, webhook });
        } catch (err) {
          console.warn('Webhook update failed:', err.message);
        }
      }
      const started = Date.now();
      try {
        const out = await plaid('/transactions/refresh', { access_token: item.access_token });
        results.push({ item_id: item.item_id, ok: true, request_id: out.request_id || null, elapsed_ms: Date.now() - started });
      } catch (err) {
        results.push({ item_id: item.item_id, ok: false, error: err.message, details: err.details || null });
      }
    }

    const failed = results.filter(x => !x.ok);
    if (failed.length === results.length) {
      const first = failed[0];
      return json(res, 400, { error: first.error || 'Plaid refresh failed', details: first.details || null, results });
    }
    return json(res, 200, { ok: true, connected: true, requested: results.filter(x => x.ok).length, results });
  } catch (err) {
    console.error(err);
    return json(res, err.status || 500, { error: err.message, details: err.details || null });
  }
};
