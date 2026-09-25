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

const emptyState = () => ({ monthKey: currentMonthKey(), transactions: [], scope: 'personal' });
let state = JSON.parse(localStorage.getItem('budgetFlowState') || 'null') || emptyState();
if (state.monthKey !== currentMonthKey()) state = emptyState();

const els = {
  remainingTotal: document.querySelector('#remainingTotal'),
  spentTotal: document.querySelector('#spentTotal'),
  budgetTotal: document.querySelector('#budgetTotal'),
  expenseInput: document.querySelector('#expenseInput'),
  addBtn: document.querySelector('#addBtn'),
  categoryList: document.querySelector('#categoryList'),
  transactions: document.querySelector('#transactions'),
  editDialog: document.querySelector('#editDialog'),
  editAmount: document.querySelector('#editAmount'),
  editCategory: document.querySelector('#editCategory'),
  editDescription: document.querySelector('#editDescription'),
  saveExpenseBtn: document.querySelector('#saveExpenseBtn'),
  dialogTitle: document.querySelector('#dialogTitle'),
  deleteExpenseBtn: document.querySelector('#deleteExpenseBtn'),
  parsedPreview: document.querySelector('#parsedPreview'),
  monthLabel: document.querySelector('#monthLabel'),
};

let pendingExpenses = [];
let editingId = null;

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function money(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n); }
function money2(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n); }
function persist() { localStorage.setItem('budgetFlowState', JSON.stringify(state)); }
function getCategory(id) { return CATEGORY_DEFS.find(c => c.id === id); }
function uuid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }

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
  // Split on commas/semicolons/new lines only when each piece looks like it contains a number.
  const rough = text.split(/[;\n]+|,(?=\s*[^,]*\d)/).map(s=>s.trim()).filter(Boolean);
  const parsed = rough.map(part => parseSingleExpense(part, state.scope)).filter(Boolean);
  if (parsed.length) return parsed;
  const one = parseSingleExpense(text, state.scope);
  return one ? [one] : [];
}

function addExpenseFromInput() {
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
    const now = new Date().toISOString();
    pendingExpenses.reverse().forEach(expense => state.transactions.unshift({ id:uuid(), ...expense, createdAt:now }));
    persist();
    els.expenseInput.value = '';
    showParsedMessage(`Добавлено расходов: ${pendingExpenses.length}`);
    pendingExpenses = [];
    render();
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

els.saveExpenseBtn.addEventListener('click', (e) => {
  e.preventDefault();
  const amount = Number(els.editAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (editingId) {
    const tx = state.transactions.find(t => t.id === editingId);
    if (tx) {
      tx.amount = amount;
      tx.description = els.editDescription.value.trim() || 'Expense';
      tx.categoryId = els.editCategory.value;
    }
  } else if (pendingExpenses[0]) {
    const expense = pendingExpenses[0];
    state.transactions.unshift({
      id: uuid(), amount,
      description: els.editDescription.value.trim() || 'Expense',
      categoryId: els.editCategory.value,
      scope: expense.scope,
      createdAt: new Date().toISOString()
    });
  }
  persist();
  els.expenseInput.value = '';
  pendingExpenses = [];
  editingId = null;
  els.editDialog.close();
  render();
});

els.deleteExpenseBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (!editingId) return;
  if (confirm('Удалить этот расход?')) {
    state.transactions = state.transactions.filter(t => t.id !== editingId);
    persist();
    editingId = null;
    els.editDialog.close();
    render();
  }
});

function render() {
  document.querySelectorAll('.scope-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.scope === state.scope));
  els.monthLabel.textContent = new Date().toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).toUpperCase();

  const personalCategories = CATEGORY_DEFS.filter(c => c.scope === 'personal');
  const budgetTotal = personalCategories.reduce((s,c) => s + c.limit, 0);
  const personalSpent = state.transactions.filter(t=>t.scope==='personal').reduce((s,t)=>s+t.amount,0);
  const remaining = budgetTotal - personalSpent;
  els.remainingTotal.textContent = money(remaining);
  els.spentTotal.textContent = `Потрачено ${money(personalSpent)}`;
  els.budgetTotal.textContent = `Бюджет ${money(budgetTotal)}`;

  const visibleCategories = CATEGORY_DEFS.filter(c => c.scope === state.scope);
  els.categoryList.innerHTML = visibleCategories.map(c => {
    const spent = state.transactions.filter(t=>t.categoryId===c.id).reduce((s,t)=>s+t.amount,0);
    const remaining = c.limit > 0 ? c.limit - spent : null;
    const pct = c.limit > 0 ? Math.min(100, (spent/c.limit)*100) : 0;
    const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : '';
    return `<article class="category-card">
      <div class="category-head">
        <div><div class="category-name">${c.icon} ${c.name}</div><div class="category-meta">Потрачено ${money2(spent)}${c.limit>0 ? ` из ${money2(c.limit)}` : ''}</div></div>
        <div class="category-remaining">${c.limit>0 ? `${money2(remaining)} left` : money2(spent)}</div>
      </div>
      ${c.limit>0 ? `<div class="progress"><div class="${cls}" style="width:${pct}%"></div></div>` : ''}
    </article>`;
  }).join('');

  const txs = state.transactions;
  els.transactions.innerHTML = txs.length ? txs.map(t => {
    const c = getCategory(t.categoryId);
    const when = new Date(t.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    return `<button class="transaction" data-id="${t.id}" aria-label="Редактировать расход ${escapeHtml(t.description)}">
      <div><div class="transaction-title">${c?.icon || '•'} ${escapeHtml(t.description)}</div><div class="transaction-sub">${c?.name || 'Other'} · ${t.scope==='business'?'Business':'Family'} · ${when}</div></div>
      <div class="transaction-right"><div class="transaction-amount">-${money2(t.amount)}</div><div class="edit-hint">Edit</div></div>
    </button>`;
  }).join('') : '<div class="empty">Пока нет расходов. Добавь первый сверху.</div>';

  els.transactions.querySelectorAll('.transaction').forEach(btn => btn.addEventListener('click', () => {
    const tx = state.transactions.find(t => t.id === btn.dataset.id);
    if (!tx) return;
    editingId = tx.id;
    pendingExpenses = [];
    openEditDialog(tx, true);
  }));
}

function showParsedMessage(message) {
  els.parsedPreview.textContent = message;
  els.parsedPreview.hidden = false;
  clearTimeout(showParsedMessage.timer);
  showParsedMessage.timer = setTimeout(()=>{ els.parsedPreview.hidden = true; },2200);
}

function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }

els.addBtn.addEventListener('click', addExpenseFromInput);
els.expenseInput.addEventListener('keydown', e => { if (e.key==='Enter') addExpenseFromInput(); });
document.querySelectorAll('.scope-btn').forEach(btn => btn.addEventListener('click', () => { state.scope=btn.dataset.scope; persist(); render(); }));
document.querySelector('#clearTransactionsBtn').addEventListener('click', () => { if (confirm('Удалить все записанные расходы за этот месяц?')) { state.transactions=[]; persist(); render(); } });
document.querySelector('#resetBtn').addEventListener('click', () => { if (confirm('Сбросить бюджет этого месяца?')) { state=emptyState(); persist(); render(); } });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
render();
