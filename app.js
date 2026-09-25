const SUPABASE_URL = 'https://fwjzfcwajsqprexmjzdn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_eTw3r0r4Y7vTu450WtOcqA_egSDsUrq';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const CATEGORY_DEFS = [
  { id:'rent', name:'Rent', icon:'🏠', limit:2178, scope:'personal', keywords:['rent','аренда','квартира','home'] },
  { id:'electric', name:'Electricity', icon:'⚡️', limit:184.8, scope:'personal', keywords:['union power','electric','electricity','свет','электричество'] },
  { id:'phone', name:'Phone', icon:'📱', limit:173.8, scope:'personal', keywords:['att','at&t','phone','телефон'] },
  { id:'internet', name:'Internet', icon:'🌐', limit:55, scope:'personal', keywords:['spectrum','internet','интернет'] },
  { id:'gas_home', name:'Home Gas', icon:'🔥', limit:39.6, scope:'personal', keywords:['piedmont','natural gas','home gas','газ дом'] },
  { id:'groceries', name:'Groceries', icon:'🛒', limit:770, scope:'personal', keywords:['publix','walmart','aldi','lidl','costco','grocery','groceries','продукты','еда домой'] },
  { id:'eating_out', name:'Eating Out', icon:'🍔', limit:286, scope:'personal', keywords:['restaurant','cafe','coffee','starbucks','chick','chick-fil-a','mcdonald','wendy','burger','pizza','ресторан','кафе','фастфуд'] },
  { id:'fuel', name:'Gas / Fuel', icon:'⛽️', limit:231, scope:'personal', keywords:['bp','shell','exxon','circle k','fuel','gas','бенз','бензин','заправка'] },
  { id:'insurance', name:'Insurance', icon:'🚗', limit:234.7, scope:'personal', keywords:['progressive','insurance','страховка'] },
  { id:'subscriptions', name:'Subscriptions', icon:'🎧', limit:110, scope:'personal', keywords:['apple','steam','boosty','fitness','subscription','подписка','gym'] },
  { id:'debt', name:'Debt / Affirm', icon:'💳', limit:74.8, scope:'personal', keywords:['affirm','debt','рассрочка','долг'] },
  { id:'business_materials', name:'Business Materials', icon:'🧰', limit:0, scope:'business', keywords:['home depot','lowes','lowe’s','lowe','sherwin','paint','material','materials','материал','краска'] },
  { id:'business_other', name:'Business Other', icon:'🧾', limit:0, scope:'business', keywords:['business','work','job','работа'] },
  { id:'other', name:'Other', icon:'📦', limit:330, scope:'personal', keywords:[] },
];

let state = { transactions: [], scope: localStorage.getItem('budgetFlowScope') || 'personal' };
let currentUser = null;
let pendingExpenses = [];
let editingId = null;
let authMode = 'login';

const els = {
  authScreen: document.querySelector('#authScreen'), appShell: document.querySelector('#appShell'), authForm: document.querySelector('#authForm'),
  authEmail: document.querySelector('#authEmail'), authPassword: document.querySelector('#authPassword'), authSubmitBtn: document.querySelector('#authSubmitBtn'), authMessage: document.querySelector('#authMessage'),
  logoutBtn: document.querySelector('#logoutBtn'), userEmail: document.querySelector('#userEmail'), syncStatus: document.querySelector('#syncStatus'), syncBadge: document.querySelector('#syncBadge'), refreshBtn: document.querySelector('#refreshBtn'),
  remainingTotal: document.querySelector('#remainingTotal'), spentTotal: document.querySelector('#spentTotal'), budgetTotal: document.querySelector('#budgetTotal'),
  expenseInput: document.querySelector('#expenseInput'), addBtn: document.querySelector('#addBtn'), categoryList: document.querySelector('#categoryList'), transactions: document.querySelector('#transactions'),
  editDialog: document.querySelector('#editDialog'), editAmount: document.querySelector('#editAmount'), editCategory: document.querySelector('#editCategory'), editDescription: document.querySelector('#editDescription'),
  saveExpenseBtn: document.querySelector('#saveExpenseBtn'), dialogTitle: document.querySelector('#dialogTitle'), deleteExpenseBtn: document.querySelector('#deleteExpenseBtn'), parsedPreview: document.querySelector('#parsedPreview'), monthLabel: document.querySelector('#monthLabel'),
};

function currentMonthKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function monthBounds() { const d=new Date(); const y=d.getFullYear(), m=d.getMonth(); const start=new Date(y,m,1); const end=new Date(y,m+1,1); return [isoDate(start), isoDate(end)]; }
function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function money(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n); }
function money2(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n); }
function getCategory(id) { return CATEGORY_DEFS.find(c => c.id === id); }
function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }

function setSyncStatus(text, kind='ok') {
  els.syncStatus.textContent = text;
  els.syncBadge.textContent = kind === 'syncing' ? 'Syncing' : kind === 'error' ? 'Error' : 'Cloud';
  els.syncBadge.classList.toggle('syncing', kind==='syncing');
  els.syncBadge.classList.toggle('error', kind==='error');
}

function showAuthMessage(message, isError=false) {
  els.authMessage.hidden = false;
  els.authMessage.textContent = message;
  els.authMessage.classList.toggle('error', isError);
}

function classify(text, scope) {
  const t = text.toLowerCase();
  const candidates = CATEGORY_DEFS.filter(c => c.scope === scope || (scope==='personal' && c.id==='other'));
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const score = c.keywords.reduce((acc,k) => acc + (t.includes(k.toLowerCase()) ? Math.max(1,k.length) : 0),0);
    if (score > bestScore) { best = c; bestScore = score; }
  }
  if (!best) best = scope === 'business' ? getCategory('business_other') : getCategory('other');
  return best.id;
}

function parseSingleExpense(text, scope) {
  const matches = [...text.matchAll(/(?:\$\s*)?(\d+(?:[.,]\d{1,2})?)/g)];
  if (!matches.length) return null;
  const m = matches[matches.length - 1];
  const amount = Number(m[1].replace(',','.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const description = `${text.slice(0,m.index)} ${text.slice((m.index || 0)+m[0].length)}`.replace(/\s{2,}/g,' ').trim() || 'Expense';
  return { amount, description, categoryId: classify(text, scope), scope };
}

function parseExpenses(text) {
  const rough = text.split(/[;\n]+|,(?=\s*[^,]*\d)/).map(s=>s.trim()).filter(Boolean);
  const parsed = rough.map(part => parseSingleExpense(part, state.scope)).filter(Boolean);
  if (parsed.length) return parsed;
  const one = parseSingleExpense(text, state.scope);
  return one ? [one] : [];
}

function fromCloudRow(row) {
  return {
    id: row.id,
    amount: Number(row.amount),
    description: row.description || row.merchant || 'Expense',
    categoryId: row.category,
    scope: row.budget_type === 'business' ? 'business' : 'personal',
    createdAt: row.created_at,
    spentAt: row.spent_at,
  };
}

function toCloudPayload(expense) {
  return {
    amount: expense.amount,
    description: expense.description || 'Expense',
    category: expense.categoryId,
    budget_type: expense.scope === 'business' ? 'business' : 'family',
    spent_at: expense.spentAt || isoDate(new Date()),
  };
}

async function loadTransactions() {
  if (!currentUser) return;
  setSyncStatus('Загружаю…','syncing');
  const [start,end] = monthBounds();
  const { data, error } = await sb.from('expenses')
    .select('*')
    .gte('spent_at', start)
    .lt('spent_at', end)
    .order('created_at',{ascending:false});
  if (error) { console.error(error); setSyncStatus('Ошибка синхронизации','error'); return; }
  state.transactions = (data || []).map(fromCloudRow);
  setSyncStatus('Синхронизировано');
  render();
}

async function migrateLocalExpensesOnce() {
  if (!currentUser) return;
  const marker = `budgetFlowMigrated:${currentUser.id}`;
  if (localStorage.getItem(marker)) return;
  const old = JSON.parse(localStorage.getItem('budgetFlowState') || 'null');
  const txs = old?.transactions || [];
  if (!txs.length) { localStorage.setItem(marker,'1'); return; }
  setSyncStatus('Переношу старые траты…','syncing');
  const rows = txs.map(t => ({
    ...toCloudPayload({ amount:Number(t.amount), description:t.description, categoryId:t.categoryId, scope:t.scope, spentAt:(t.createdAt || '').slice(0,10) || isoDate(new Date()) }),
    created_at: t.createdAt || new Date().toISOString(),
  }));
  const { error } = await sb.from('expenses').insert(rows);
  if (error) { console.error(error); setSyncStatus('Не удалось перенести локальные траты','error'); return; }
  localStorage.setItem(marker,'1');
  await loadTransactions();
  showParsedMessage(`Перенесено локальных расходов: ${rows.length}`);
}

async function addExpenseFromInput() {
  const raw = els.expenseInput.value.trim();
  pendingExpenses = parseExpenses(raw);
  if (!pendingExpenses.length) {
    els.expenseInput.focus();
    els.expenseInput.setCustomValidity('Добавь сумму, например: Publix 54');
    els.expenseInput.reportValidity();
    setTimeout(()=>els.expenseInput.setCustomValidity(''), 1200);
    return;
  }
  if (pendingExpenses.length === 1) {
    editingId = null;
    openEditDialog(pendingExpenses[0], false);
  } else {
    setSyncStatus('Сохраняю…','syncing');
    const rows = pendingExpenses.map(toCloudPayload);
    const { error } = await sb.from('expenses').insert(rows);
    if (error) { console.error(error); setSyncStatus('Ошибка сохранения','error'); return; }
    els.expenseInput.value = '';
    showParsedMessage(`Добавлено расходов: ${pendingExpenses.length}`);
    pendingExpenses = [];
    await loadTransactions();
  }
}

function openEditDialog(expense, isEditing) {
  const categories = CATEGORY_DEFS.filter(c => c.scope === expense.scope || (expense.scope==='personal' && c.id==='other'));
  els.editCategory.innerHTML = categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  els.editAmount.value = expense.amount;
  els.editDescription.value = expense.description;
  els.editCategory.value = expense.categoryId;
  els.dialogTitle.textContent = isEditing ? 'Изменить расход' : 'Проверить расход';
  els.deleteExpenseBtn.hidden = !isEditing;
  els.editDialog.showModal();
}

async function saveDialogExpense(e) {
  e.preventDefault();
  const amount = Number(els.editAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  setSyncStatus('Сохраняю…','syncing');
  if (editingId) {
    const tx = state.transactions.find(t => t.id === editingId);
    if (!tx) return;
    const payload = { amount, description:els.editDescription.value.trim() || 'Expense', category:els.editCategory.value };
    const { error } = await sb.from('expenses').update(payload).eq('id', editingId);
    if (error) { console.error(error); setSyncStatus('Ошибка сохранения','error'); return; }
  } else if (pendingExpenses[0]) {
    const expense = pendingExpenses[0];
    const payload = toCloudPayload({ ...expense, amount, description:els.editDescription.value.trim() || 'Expense', categoryId:els.editCategory.value });
    const { error } = await sb.from('expenses').insert(payload);
    if (error) { console.error(error); setSyncStatus('Ошибка сохранения','error'); return; }
  }
  els.expenseInput.value = '';
  pendingExpenses = [];
  editingId = null;
  els.editDialog.close();
  await loadTransactions();
}

async function deleteExpense(e) {
  e.preventDefault();
  if (!editingId || !confirm('Удалить этот расход?')) return;
  setSyncStatus('Удаляю…','syncing');
  const { error } = await sb.from('expenses').delete().eq('id',editingId);
  if (error) { console.error(error); setSyncStatus('Ошибка удаления','error'); return; }
  editingId = null;
  els.editDialog.close();
  await loadTransactions();
}

function render() {
  document.querySelectorAll('.scope-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.scope === state.scope));
  els.monthLabel.textContent = new Date().toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).toUpperCase();
  const personalCategories = CATEGORY_DEFS.filter(c => c.scope === 'personal');
  const budgetTotal = personalCategories.reduce((s,c) => s + c.limit, 0);
  const personalSpent = state.transactions.filter(t=>t.scope==='personal').reduce((s,t)=>s+t.amount,0);
  els.remainingTotal.textContent = money(budgetTotal - personalSpent);
  els.spentTotal.textContent = `Потрачено ${money(personalSpent)}`;
  els.budgetTotal.textContent = `Бюджет ${money(budgetTotal)}`;

  const visibleCategories = CATEGORY_DEFS.filter(c => c.scope === state.scope);
  els.categoryList.innerHTML = visibleCategories.map(c => {
    const spent = state.transactions.filter(t=>t.categoryId===c.id).reduce((s,t)=>s+t.amount,0);
    const remaining = c.limit > 0 ? c.limit - spent : null;
    const pct = c.limit > 0 ? Math.min(100, (spent/c.limit)*100) : 0;
    const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : '';
    return `<article class="category-card"><div class="category-head"><div><div class="category-name">${c.icon} ${c.name}</div><div class="category-meta">Потрачено ${money2(spent)}${c.limit>0 ? ` из ${money2(c.limit)}` : ''}</div></div><div class="category-remaining">${c.limit>0 ? `${money2(remaining)} left` : money2(spent)}</div></div>${c.limit>0 ? `<div class="progress"><div class="${cls}" style="width:${pct}%"></div></div>` : ''}</article>`;
  }).join('');

  const txs = state.transactions;
  els.transactions.innerHTML = txs.length ? txs.map(t => {
    const c = getCategory(t.categoryId);
    const when = new Date(t.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    return `<button class="transaction" data-id="${t.id}" aria-label="Редактировать расход ${escapeHtml(t.description)}"><div><div class="transaction-title">${c?.icon || '•'} ${escapeHtml(t.description)}</div><div class="transaction-sub">${c?.name || 'Other'} · ${t.scope==='business'?'Business':'Family'} · ${when}</div></div><div class="transaction-right"><div class="transaction-amount">-${money2(t.amount)}</div><div class="edit-hint">Edit</div></div></button>`;
  }).join('') : '<div class="empty">Пока нет расходов. Добавь первый сверху.</div>';

  els.transactions.querySelectorAll('.transaction').forEach(btn => btn.addEventListener('click', () => {
    const tx = state.transactions.find(t => t.id === btn.dataset.id);
    if (!tx) return;
    editingId = tx.id; pendingExpenses = []; openEditDialog(tx, true);
  }));
}

function showParsedMessage(message) {
  els.parsedPreview.textContent = message;
  els.parsedPreview.hidden = false;
  clearTimeout(showParsedMessage.timer);
  showParsedMessage.timer = setTimeout(()=>{ els.parsedPreview.hidden = true; },2400);
}

async function showApp(session) {
  currentUser = session?.user || null;
  if (!currentUser) {
    els.authScreen.hidden = false; els.appShell.hidden = true; return;
  }
  els.authScreen.hidden = true; els.appShell.hidden = false;
  els.userEmail.textContent = currentUser.email || '';
  await migrateLocalExpensesOnce();
  await loadTransactions();
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  els.authSubmitBtn.disabled = true;
  els.authMessage.hidden = true;
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  let result;
  if (authMode === 'signup') result = await sb.auth.signUp({ email, password });
  else result = await sb.auth.signInWithPassword({ email, password });
  els.authSubmitBtn.disabled = false;
  if (result.error) return showAuthMessage(result.error.message, true);
  if (authMode === 'signup' && !result.data.session) {
    showAuthMessage('Аккаунт создан. Проверь email и подтвердить адрес, потом вернись и войди.');
  }
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach(b=>b.classList.toggle('active', b.dataset.authMode===mode));
  els.authSubmitBtn.textContent = mode === 'signup' ? 'Создать аккаунт' : 'Войти';
  els.authMessage.hidden = true;
}

document.querySelectorAll('.auth-tab').forEach(btn=>btn.addEventListener('click',()=>setAuthMode(btn.dataset.authMode)));
els.authForm.addEventListener('submit', handleAuthSubmit);
els.logoutBtn.addEventListener('click', async()=>{ await sb.auth.signOut(); });
els.addBtn.addEventListener('click', addExpenseFromInput);
els.expenseInput.addEventListener('keydown', e => { if (e.key==='Enter') addExpenseFromInput(); });
els.saveExpenseBtn.addEventListener('click', saveDialogExpense);
els.deleteExpenseBtn.addEventListener('click', deleteExpense);
els.refreshBtn.addEventListener('click', loadTransactions);
document.querySelectorAll('.scope-btn').forEach(btn => btn.addEventListener('click', () => { state.scope=btn.dataset.scope; localStorage.setItem('budgetFlowScope',state.scope); render(); }));

sb.auth.onAuthStateChange((_event, session)=>{ showApp(session); });
(async()=>{ const { data } = await sb.auth.getSession(); await showApp(data.session); })();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
