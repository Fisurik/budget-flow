const { json, requireUser, getPlaidItems } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const items = await getPlaidItems(user.id);
    return json(res, 200, {
      connected: items.length > 0,
      items: items.map(x => ({ item_id: x.item_id, institution_id: x.institution_id, institution_name: x.institution_name, updated_at: x.updated_at })),
    });
  } catch (err) {
    console.error(err);
    return json(res, err.status || 500, { error: err.message, details: err.details || null });
  }
};
