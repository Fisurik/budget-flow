const { json, requireUser, plaid } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const data = await plaid('/link/token/create', {
      user: { client_user_id: user.id },
      client_name: 'Budget Flow',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      transactions: { days_requested: 30 },
    });
    return json(res, 200, { link_token: data.link_token, expiration: data.expiration });
  } catch (err) {
    console.error(err);
    return json(res, err.status || 500, { error: err.message, details: err.details || null });
  }
};
