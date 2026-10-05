const { json, requireUser, getPlaidItems, plaid } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const items = await getPlaidItems(user.id);
    const enriched = [];
    for (const x of items) {
      let lastSuccessfulUpdate = null;
      let webhook = null;
      let itemError = null;
      try {
        const info = await plaid('/item/get', { access_token: x.access_token });
        lastSuccessfulUpdate = info?.status?.transactions?.last_successful_update || null;
        webhook = info?.item?.webhook || null;
        itemError = info?.item?.error || null;
      } catch (err) {
        console.warn('Plaid item/get:', err.message);
      }
      enriched.push({
        item_id: x.item_id,
        institution_id: x.institution_id,
        institution_name: x.institution_name,
        updated_at: x.updated_at,
        last_successful_update: lastSuccessfulUpdate,
        webhook_configured: Boolean(webhook),
        item_error: itemError,
      });
    }
    return json(res, 200, { connected: enriched.length > 0, items: enriched });
  } catch (err) {
    console.error(err);
    return json(res, err.status || 500, { error: err.message, details: err.details || null });
  }
};
