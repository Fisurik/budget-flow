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

let state = JSON.parse(localStorage.getItem('budgetFlowState') || 'null') || {
  monthKey: currentMonthKey(),
  transactions: [],
  scope: 'personal'
};
if (state.monthKey !== currentMonthKey()) state = { monthKey: currentMonthKey(), transactions: [], scope:'personal' };

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
};

let pendingExpense = null;

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function money(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n); }
function money2(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n); }
function persist() { localStorage.setItem('budgetFlowState', JSON.stringify(state)); }
function getCategory(id) { return CATEGORY_DEFS.find(c => c.id === id); }

function classify(text, scope) {
  const t = text.toLowerCase();
  const candidates = CATEGORY_DEFS.filter(c => c.scope === scope || (scope==='personal' && c.id==='other'));
  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = c.keywords.reduce((acc,k) => acc + (t.includes(k.toLowerCase()) ? Math.max(1,k.length) : 0),0);
    if (score > bestScore) { best = c; bestScore = score; }
  }
  if (!best) best = scope === 'business' ? getCategory('business_other') : getCategory('other');
  return best.id;
}

function parseExpense(text) {
  const matches = [...text.matchAll(/(?:\$\s*)?(\d+(?:[.,]\d{1,2})?)/g)];
  if (!matches.length) return null;
  const amount = Number(matches[matches.length-1][1].replace(',','.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const description = text.replace(matches[matches.length-1][0], '').replace(/\s{2,}/g,' ').trim() || 'Expense';
  return { amount, description, categoryId: classify(text, state.scope), scope: state.scope };
}

function addExpenseFromInput() {
  const raw = els.expenseInput.value.trim();
  const parsed = parseExpense(raw);
  if (!parsed) {
    els.expenseInput.focus();
    els.expenseInput.setCustomValidity('Добавь сумму, например: Publix 54');
    els.expenseInput.reportValidity();
    setTimeout(()=>els.expenseInput.setCustomValidity(''), 1200);
    return;
  }
  pendingExpense = parsed;
  openEditDialog(parsed);
}

function openEditDialog(expense) {
  const categories = CATEGORY_DEFS.filter(c => c.scope === expense.scope || (expense.scope==='personal' && c.id==='other'));
  els.editCategory.innerHTML = categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  els.editAmount.value = expense.amount;
  els.editDescription.value = expense.description;
  els.editCategory.value = expense.categoryId;
  els.editDialog.showModal();
}

els.saveExpenseBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (!pendingExpense) return;
  const amount = Number(els.editAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  state.transactions.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    amount,
    description: els.editDescription.value.trim() || 'Expense',
    categoryId: els.editCategory.value,
    scope: pendingExpense.scope,
    createdAt: new Date().toISOString()
  });
  persist();
  els.expenseInput.value = '';
  pendingExpense = null;
  els.editDialog.close();
  render();
});

function render() {
  document.querySelectorAll('.scope-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.scope === state.scope));

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

  const txs = state.transactions.slice(0,20);
  els.transactions.innerHTML = txs.length ? txs.map(t => {
    const c = getCategory(t.categoryId);
    const when = new Date(t.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    return `<div class="transaction">
      <div><div class="transaction-title">${c?.icon || '•'} ${escapeHtml(t.description)}</div><div class="transaction-sub">${c?.name || 'Other'} · ${t.scope==='business'?'Business':'Family'} · ${when}</div></div>
      <div class="transaction-amount">-${money2(t.amount)}</div>
    </div>`;
  }).join('') : '<div class="empty">Пока нет расходов. Добавь первый сверху.</div>';
}

function escapeHtml(s) { return s.replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }

els.addBtn.addEventListener('click', addExpenseFromInput);
els.expenseInput.addEventListener('keydown', e => { if (e.key==='Enter') addExpenseFromInput(); });
document.querySelectorAll('.scope-btn').forEach(btn => btn.addEventListener('click', () => { state.scope=btn.dataset.scope; persist(); render(); }));
document.querySelector('#clearTransactionsBtn').addEventListener('click', () => { if (confirm('Удалить все записанные расходы за этот месяц?')) { state.transactions=[]; persist(); render(); } });
document.querySelector('#resetBtn').addEventListener('click', () => { if (confirm('Сбросить бюджет этого месяца?')) { state={monthKey:currentMonthKey(),transactions:[],scope:'personal'}; persist(); render(); } });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
render();
