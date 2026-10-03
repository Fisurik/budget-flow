const { json, requireUser, getPlaidItems, syncOneItem } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const items = await getPlaidItems(user.id);
    if (!items.length) return json(res, 200, { ok: true, connected: false, items: 0, added: 0, modified: 0, removed: 0 });
    const total = { added: 0, modified: 0, removed: 0 };
    for (const item of items) {
      const r = await syncOneItem(user.id, item);
      total.added += r.added;
      total.modified += r.modified;
      total.removed += r.removed;
    }
    return json(res, 200, { ok: true, connected: true, items: items.length, ...total });
  } catch (err) {
    console.error(err);
    return json(res, err.status || 500, { error: err.message, details: err.details || null });
  }
};
