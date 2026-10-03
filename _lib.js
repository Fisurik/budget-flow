const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fwjzfcwajsqprexmjzdn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_eTw3r0r4Y7vTu450WtOcqA_egSDsUrq';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function getBearer(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function requireUser(req) {
  const token = getBearer(req);
  if (!token) throw Object.assign(new Error('Missing user session'), { status: 401 });
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!r.ok) throw Object.assign(new Error('Invalid or expired session'), { status: 401 });
  return r.json();
}

function requireServerSecret() {
  if (!SUPABASE_SECRET_KEY) {
    throw Object.assign(new Error('SUPABASE_SECRET_KEY is not configured in Vercel'), { status: 500 });
  }
}

async function adminFetch(path, options = {}) {
  requireServerSecret();
  const headers = {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers });
  const text = await r.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!r.ok) {
    const message = data?.message || data?.hint || data?.details || `Supabase error ${r.status}`;
    throw Object.assign(new Error(message), { status: 500, details: data });
  }
  return data;
}

function plaidBase() {
  const env = (process.env.PLAID_ENV || 'production').toLowerCase();
  if (env === 'production') return 'https://production.plaid.com';
  if (env === 'sandbox') return 'https://sandbox.plaid.com';
  throw Object.assign(new Error('PLAID_ENV must be production or sandbox'), { status: 500 });
}

async function plaid(path, body) {
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    throw Object.assign(new Error('Plaid credentials are not configured'), { status: 500 });
  }
  const r = await fetch(`${plaidBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      ...body,
    }),
  });
  const data = await r.json();
  if (!r.ok || data.error_code) {
    const message = data.error_message || data.error_code || `Plaid error ${r.status}`;
    throw Object.assign(new Error(message), { status: 400, details: data });
  }
  return data;
}

function suggestionForTransaction(tx) {
  const merchant = String(tx.merchant_name || tx.name || '').toLowerCase();
  const primary = String(tx.personal_finance_category?.primary || '').toUpperCase();
  const detailed = String(tx.personal_finance_category?.detailed || '').toUpperCase();

  if (/thumbtack|angi|homeadvisor/.test(merchant)) return ['business_leads', 'business'];
  if (/home depot|lowe'?s|lowes|sherwin|84 lumber/.test(merchant)) return ['business_materials', 'business'];
  if (/harbor freight|dewalt|milwaukee|makita/.test(merchant)) return ['business_tools', 'business'];
  if (/david martiros|zelle.*david|aik|haik/.test(merchant)) return ['business_subcontractors', 'business'];
  if (/shopify|quickbooks|google workspace|microsoft 365/.test(merchant)) return ['business_subscriptions', 'business'];
  if (/publix|aldi|lidl|food lion|harris teeter|grocery/.test(merchant) || primary === 'FOOD_AND_DRINK' && detailed.includes('GROCER')) return ['groceries', 'family'];
  if (/chick|mcdonald|wendy|starbucks|restaurant|cafe|coffee|pizza/.test(merchant) || primary === 'FOOD_AND_DRINK') return ['eating_out', 'family'];
  if (/progressive|geico|state farm/.test(merchant) || primary === 'GENERAL_SERVICES' && detailed.includes('INSURANCE')) return ['insurance', 'family'];
  if (/spectrum/.test(merchant)) return ['internet', 'family'];
  if (/at&t|att /.test(merchant)) return ['phone', 'family'];
  if (/piedmont natural gas/.test(merchant)) return ['gas_home', 'family'];
  if (/union power|duke energy/.test(merchant)) return ['electric', 'family'];
  if (/affirm/.test(merchant) || primary === 'LOAN_PAYMENTS') return ['debt', 'family'];
  if (/apple|steam|boosty|fitness connection/.test(merchant)) return ['subscriptions', 'family'];
  if (/shell|exxon|bp |circle k|chevron|sunoco|marathon/.test(merchant) || primary === 'TRANSPORTATION' && detailed.includes('GAS')) return ['fuel', 'family'];
  return ['other', 'family'];
}

async function getPlaidItems(userId) {
  const qs = new URLSearchParams({
    user_id: `eq.${userId}`,
    select: 'id,user_id,item_id,access_token,cursor,institution_id,institution_name,created_at,updated_at',
    order: 'created_at.asc',
  });
  return (await adminFetch(`plaid_items?${qs.toString()}`, { method: 'GET' })) || [];
}

async function savePlaidItem(row) {
  const qs = new URLSearchParams({ on_conflict: 'user_id,item_id' });
  const data = await adminFetch(`plaid_items?${qs.toString()}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });
  return data?.[0] || null;
}

async function patchPlaidItem(id, patch) {
  const qs = new URLSearchParams({ id: `eq.${id}` });
  await adminFetch(`plaid_items?${qs.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

async function getBankTransactionByExternal(userId, externalId) {
  const qs = new URLSearchParams({
    user_id: `eq.${userId}`,
    external_id: `eq.${externalId}`,
    select: 'id,user_id,external_id,status,raw_data',
    limit: '1',
  });
  const rows = await adminFetch(`bank_transactions?${qs.toString()}`, { method: 'GET' });
  return rows?.[0] || null;
}

async function patchBankTransaction(id, patch) {
  const qs = new URLSearchParams({ id: `eq.${id}` });
  await adminFetch(`bank_transactions?${qs.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

async function reconcileApprovedExpense(bankRow, tx) {
  if (!bankRow || bankRow.status !== 'approved') return;
  const amount = Number(tx.amount);
  if (!(amount > 0)) return;
  const spentAt = tx.authorized_date || tx.date;
  const qs = new URLSearchParams({ source_bank_transaction_id: `eq.${bankRow.id}` });
  await adminFetch(`expenses?${qs.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ amount, spent_at: spentAt }),
  });
}

function bankPatchFromPlaid(tx) {
  return {
    merchant: tx.merchant_name || tx.name || 'Bank transaction',
    description: tx.merchant_name || tx.name || 'Bank transaction',
    amount: Number(tx.amount),
    transaction_date: tx.authorized_date || tx.date,
    raw_data: tx,
  };
}

async function ingestPlaidTransaction(userId, tx, { initial = false, monthStartIso = null } = {}) {
  if (!(Number(tx.amount) > 0)) return 0;
  const txDate = String(tx.authorized_date || tx.date || '');
  if (initial && monthStartIso && txDate < monthStartIso) return 0;

  const externalId = `plaid:${tx.transaction_id}`;
  let row = await getBankTransactionByExternal(userId, externalId);

  // Plaid commonly replaces a pending transaction with a new posted transaction ID.
  // pending_transaction_id lets us keep the same review/expense row instead of creating a duplicate.
  if (!row && tx.pending_transaction_id) {
    const pendingExternalId = `plaid:${tx.pending_transaction_id}`;
    const prior = await getBankTransactionByExternal(userId, pendingExternalId);
    if (prior) {
      await patchBankTransaction(prior.id, { external_id: externalId, ...bankPatchFromPlaid(tx) });
      await reconcileApprovedExpense(prior, tx);
      return 0;
    }
  }

  if (row) {
    await patchBankTransaction(row.id, bankPatchFromPlaid(tx));
    await reconcileApprovedExpense(row, tx);
    return 0;
  }

  const [category, budgetType] = suggestionForTransaction(tx);
  const newRow = {
    user_id: userId,
    external_id: externalId,
    merchant: tx.merchant_name || tx.name || 'Bank transaction',
    description: tx.merchant_name || tx.name || 'Bank transaction',
    amount: Number(tx.amount),
    transaction_date: tx.authorized_date || tx.date,
    suggested_category: category,
    suggested_budget_type: budgetType,
    status: 'pending',
    raw_data: tx,
  };
  const qs = new URLSearchParams({ on_conflict: 'user_id,external_id' });
  await adminFetch(`bank_transactions?${qs.toString()}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(newRow),
  });
  return 1;
}

async function insertAddedTransactions(userId, txs, { initial = false } = {}) {
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);
  const monthStartIso = monthStart.toISOString().slice(0,10);
  let added = 0;
  for (const tx of txs) {
    added += await ingestPlaidTransaction(userId, tx, { initial, monthStartIso });
  }
  return added;
}

async function applyModifiedTransactions(userId, txs) {
  let changed = 0;
  for (const tx of txs) {
    if (!(Number(tx.amount) > 0)) continue;
    const externalId = `plaid:${tx.transaction_id}`;
    let row = await getBankTransactionByExternal(userId, externalId);
    if (!row && tx.pending_transaction_id) {
      row = await getBankTransactionByExternal(userId, `plaid:${tx.pending_transaction_id}`);
      if (row) await patchBankTransaction(row.id, { external_id: externalId, ...bankPatchFromPlaid(tx) });
    } else if (row) {
      await patchBankTransaction(row.id, bankPatchFromPlaid(tx));
    }
    if (row) {
      await reconcileApprovedExpense(row, tx);
      changed += 1;
    }
  }
  return changed;
}

async function applyRemovedTransactions(userId, removed) {
  let removedCount = 0;
  for (const tx of removed) {
    const qs = new URLSearchParams({
      user_id: `eq.${userId}`,
      external_id: `eq.plaid:${tx.transaction_id}`,
      status: 'eq.pending',
    });
    await adminFetch(`bank_transactions?${qs.toString()}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
    removedCount += 1;
  }
  return removedCount;
}

async function syncOneItem(userId, item) {
  let cursor = item.cursor || null;
  const initial = !cursor;
  let addedCount = 0;
  let modifiedCount = 0;
  let removedCount = 0;
  let hasMore = true;
  let pages = 0;

  while (hasMore && pages < 20) {
    const data = await plaid('/transactions/sync', {
      access_token: item.access_token,
      ...(cursor ? { cursor } : {}),
      count: 500,
      options: { include_original_description: true },
    });
    addedCount += await insertAddedTransactions(userId, data.added || [], { initial });
    modifiedCount += await applyModifiedTransactions(userId, data.modified || []);
    removedCount += await applyRemovedTransactions(userId, data.removed || []);
    cursor = data.next_cursor || cursor;
    hasMore = Boolean(data.has_more);
    pages += 1;
  }

  if (cursor && cursor !== item.cursor) await patchPlaidItem(item.id, { cursor });
  return { added: addedCount, modified: modifiedCount, removed: removedCount, pages };
}

module.exports = {
  json,
  requireUser,
  adminFetch,
  plaid,
  getPlaidItems,
  savePlaidItem,
  syncOneItem,
};
