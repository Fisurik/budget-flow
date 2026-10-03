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

let currentUser = null;
let editingId = null;
let pendingExpenses = [];
let authMode = 'login';
let limitsCloudAvailable = true;
const state = {
  transactions: [],
  scope: localStorage.getItem('budgetFlowScope') || 'personal',
  historyScope: 'all',
  historySearch: '',
  selectedMonth: monthKey(new Date()),
  limits: Object.fromEntries(CATEGORY_DEFS.map(c => [c.id, c.limit]))
};

const els = Object.fromEntries([
  'authScreen','appShell','authForm','authEmail','authPassword','togglePasswordBtn','passwordHint','authSubmitBtn','authMessage','logoutBtn','userEmail','syncStatus','syncBadge','refreshBtn',
  'remainingTotal','spentTotal','budgetTotal','statBudget','statSpent','statLeft','expenseInput','addBtn','repeatLastBtn','lastExpenseHint','categoryList','insights','transactions','historySearch','editDialog','editAmount','editCategory','editDescription',
  'saveExpenseBtn','dialogTitle','deleteExpenseBtn','parsedPreview','monthLabel','prevMonthBtn','nextMonthBtn','todayMonthBtn','historyFilter','editLimitDialog',
  'limitCategoryName','limitAmount','saveLimitBtn','resetLimitBtn'
].map(id => [id, document.querySelector('#'+id)]));

function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function selectedMonthDate() { const [y,m] = state.selectedMonth.split('-').map(Number); return new Date(y,m-1,1); }
function monthBoundsFromKey(key) { const [y,m]=key.split('-').map(Number); const start=`${y}-${String(m).padStart(2,'0')}-01`; const next=new Date(y,m,1); return [start, isoDate(next)]; }
function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function money(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n || 0); }
function money2(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n || 0); }
function getCategory(id) { return CATEGORY_DEFS.find(c => c.id === id); }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }
function categoryLimit(id) { return Number(state.limits[id] ?? getCategory(id)?.limit ?? 0); }

function setSyncStatus(text, kind='ok') {
  els.syncStatus.textContent = text;
  els.syncBadge.textContent = kind === 'syncing' ? 'Syncing' : kind === 'error' ? 'Error' : 'Cloud';
  els.syncBadge.classList.toggle('syncing', kind==='syncing');
  els.syncBadge.classList.toggle('error', kind==='error');
}
function showAuthMessage(message, isError=false) { els.authMessage.hidden=false; els.authMessage.textContent=message; els.authMessage.classList.toggle('error',isError); }
function showParsedMessage(message) { els.parsedPreview.textContent=message; els.parsedPreview.hidden=false; clearTimeout(showParsedMessage.timer); showParsedMessage.timer=setTimeout(()=>els.parsedPreview.hidden=true,2600); }

function classify(text, scope) {
  const t=text.toLowerCase(); const candidates=CATEGORY_DEFS.filter(c=>c.scope===scope || (scope==='personal'&&c.id==='other'));
  let best=null,bestScore=0;
  for(const c of candidates){const score=c.keywords.reduce((a,k)=>a+(t.includes(k.toLowerCase())?Math.max(1,k.length):0),0); if(score>bestScore){best=c;bestScore=score;}}
  return (best || (scope==='business'?getCategory('business_other'):getCategory('other'))).id;
}
function parseSingleExpense(text, scope) {
  const matches=[...text.matchAll(/(?:\$\s*)?(\d+(?:[.,]\d{1,2})?)/g)]; if(!matches.length)return null;
  const m=matches[matches.length-1], amount=Number(m[1].replace(',','.')); if(!Number.isFinite(amount)||amount<=0)return null;
  const description=`${text.slice(0,m.index)} ${text.slice((m.index||0)+m[0].length)}`.replace(/\s{2,}/g,' ').trim()||'Expense';
  return {amount,description,categoryId:classify(text,scope),scope,spentAt:isoDate(new Date())};
}
function parseExpenses(text){const rough=text.split(/[;\n]+|,(?=\s*[^,]*\d)/).map(s=>s.trim()).filter(Boolean); const parsed=rough.map(p=>parseSingleExpense(p,state.scope)).filter(Boolean); if(parsed.length)return parsed; const one=parseSingleExpense(text,state.scope); return one?[one]:[];}
function fromCloudRow(row){return{id:row.id,amount:Number(row.amount),description:row.description||row.merchant||'Expense',categoryId:row.category,scope:row.budget_type==='business'?'business':'personal',createdAt:row.created_at,spentAt:row.spent_at};}
function toCloudPayload(expense){return{amount:expense.amount,description:expense.description||'Expense',category:expense.categoryId,budget_type:expense.scope==='business'?'business':'family',spent_at:expense.spentAt||isoDate(new Date())};}

async function loadLimits(){
  state.limits = Object.fromEntries(CATEGORY_DEFS.map(c => [c.id,c.limit]));
  const local=JSON.parse(localStorage.getItem('budgetFlowLimits')||'{}'); Object.assign(state.limits,local);
  if(!currentUser) return;
  const {data,error}=await sb.from('budget_limits').select('category,amount');
  if(error){limitsCloudAvailable=false; console.warn('budget_limits unavailable',error.message); return;}
  limitsCloudAvailable=true; for(const row of data||[]) state.limits[row.category]=Number(row.amount);
}

async function loadTransactions(){
  if(!currentUser)return; setSyncStatus('Загружаю…','syncing');
  const [start,end]=monthBoundsFromKey(state.selectedMonth);
  const {data,error}=await sb.from('expenses').select('*').gte('spent_at',start).lt('spent_at',end).order('spent_at',{ascending:false}).order('created_at',{ascending:false});
  if(error){console.error(error);setSyncStatus('Ошибка синхронизации','error');return;}
  state.transactions=(data||[]).map(fromCloudRow); setSyncStatus('Синхронизировано'); render();
}

async function migrateLocalExpensesOnce(){
  if(!currentUser)return; const marker=`budgetFlowMigrated:${currentUser.id}`; if(localStorage.getItem(marker))return;
  const old=JSON.parse(localStorage.getItem('budgetFlowState')||'null'); const txs=old?.transactions||[]; if(!txs.length){localStorage.setItem(marker,'1');return;}
  setSyncStatus('Переношу старые траты…','syncing');
  const rows=txs.map(t=>({...toCloudPayload({amount:Number(t.amount),description:t.description,categoryId:t.categoryId,scope:t.scope,spentAt:(t.createdAt||'').slice(0,10)||isoDate(new Date())}),created_at:t.createdAt||new Date().toISOString()}));
  const {error}=await sb.from('expenses').insert(rows); if(error){console.error(error);setSyncStatus('Не удалось перенести локальные траты','error');return;}
  localStorage.setItem(marker,'1'); showParsedMessage(`Перенесено локальных расходов: ${rows.length}`);
}

async function addExpenseFromInput(){
  pendingExpenses=parseExpenses(els.expenseInput.value.trim());
  if(!pendingExpenses.length){els.expenseInput.setCustomValidity('Добавь сумму, например: Publix 54');els.expenseInput.reportValidity();setTimeout(()=>els.expenseInput.setCustomValidity(''),1200);return;}
  if(pendingExpenses.length===1){editingId=null;openEditDialog(pendingExpenses[0],false);return;}
  setSyncStatus('Сохраняю…','syncing'); const {error}=await sb.from('expenses').insert(pendingExpenses.map(toCloudPayload));
  if(error){console.error(error);setSyncStatus('Ошибка сохранения','error');return;}
  els.expenseInput.value=''; showParsedMessage(`Добавлено расходов: ${pendingExpenses.length}`); pendingExpenses=[]; await loadTransactions();
}

function openEditDialog(expense,isEditing){
  const categories=CATEGORY_DEFS.filter(c=>c.scope===expense.scope||(expense.scope==='personal'&&c.id==='other'));
  els.editCategory.innerHTML=categories.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  els.editAmount.value=expense.amount; els.editCategory.value=expense.categoryId; els.editDescription.value=expense.description||'';
  els.dialogTitle.textContent=isEditing?'Редактировать расход':'Проверить расход'; els.deleteExpenseBtn.hidden=!isEditing; els.editDialog.showModal();
}

async function saveDialogExpense(e){
  e.preventDefault(); const amount=Number(els.editAmount.value); if(!Number.isFinite(amount)||amount<=0)return;
  const cat=getCategory(els.editCategory.value); const scope=cat?.scope==='business'?'business':'personal';
  const payload=toCloudPayload({amount,description:els.editDescription.value.trim()||'Expense',categoryId:els.editCategory.value,scope,spentAt:editingId?state.transactions.find(t=>t.id===editingId)?.spentAt:isoDate(new Date())});
  setSyncStatus('Сохраняю…','syncing'); let error;
  if(editingId)({error}=await sb.from('expenses').update(payload).eq('id',editingId)); else ({error}=await sb.from('expenses').insert(payload));
  if(error){console.error(error);setSyncStatus('Ошибка сохранения','error');return;}
  els.expenseInput.value=''; editingId=null; els.editDialog.close(); await loadTransactions();
}
async function deleteExpense(e){e.preventDefault();if(!editingId||!confirm('Удалить этот расход?'))return;setSyncStatus('Удаляю…','syncing');const {error}=await sb.from('expenses').delete().eq('id',editingId);if(error){setSyncStatus('Ошибка удаления','error');return;}editingId=null;els.editDialog.close();await loadTransactions();}

function shiftMonth(delta){const d=selectedMonthDate();d.setMonth(d.getMonth()+delta);state.selectedMonth=monthKey(d);loadTransactions();}
function setThisMonth(){state.selectedMonth=monthKey(new Date());loadTransactions();}

function openLimitDialog(categoryId){const c=getCategory(categoryId); if(!c)return; els.limitCategoryName.textContent=`${c.icon} ${c.name}`; els.limitAmount.value=categoryLimit(categoryId); els.editLimitDialog.dataset.categoryId=categoryId; els.editLimitDialog.showModal();}
async function saveLimit(e){
  e.preventDefault(); const id=els.editLimitDialog.dataset.categoryId, amount=Number(els.limitAmount.value); if(!id||!Number.isFinite(amount)||amount<0)return;
  state.limits[id]=amount; localStorage.setItem('budgetFlowLimits',JSON.stringify(state.limits));
  if(limitsCloudAvailable){setSyncStatus('Сохраняю лимит…','syncing'); const {error}=await sb.from('budget_limits').upsert({category:id,amount},{onConflict:'user_id,category'}); if(error){console.error(error);limitsCloudAvailable=false;showParsedMessage('Лимит сохранён только на этом устройстве');}}
  els.editLimitDialog.close(); setSyncStatus('Синхронизировано'); render();
}
async function resetLimit(e){
  e.preventDefault(); const id=els.editLimitDialog.dataset.categoryId,c=getCategory(id); if(!c)return; state.limits[id]=c.limit; localStorage.setItem('budgetFlowLimits',JSON.stringify(state.limits));
  if(limitsCloudAvailable) await sb.from('budget_limits').upsert({category:id,amount:c.limit},{onConflict:'user_id,category'});
  els.limitAmount.value=c.limit; els.editLimitDialog.close(); render();
}

function lastExpenseForScope(){
  return state.transactions
    .filter(t=>t.scope===state.scope)
    .slice()
    .sort((a,b)=>String(b.createdAt||b.spentAt).localeCompare(String(a.createdAt||a.spentAt)))[0] || null;
}

async function repeatLastExpense(){
  const last=lastExpenseForScope(); if(!last)return;
  const payload=toCloudPayload({amount:last.amount,description:last.description,categoryId:last.categoryId,scope:last.scope,spentAt:isoDate(new Date())});
  setSyncStatus('Сохраняю…','syncing');
  const {error}=await sb.from('expenses').insert(payload);
  if(error){console.error(error);setSyncStatus('Ошибка сохранения','error');return;}
  showParsedMessage(`Повторено: ${last.description} · ${money2(last.amount)}`); await loadTransactions();
}

function renderInsights(){
  const personal=state.transactions.filter(t=>t.scope==='personal');
  const spentBy=new Map();
  for(const t of personal) spentBy.set(t.categoryId,(spentBy.get(t.categoryId)||0)+t.amount);
  const limited=CATEGORY_DEFS.filter(c=>c.scope==='personal'&&categoryLimit(c.id)>0).map(c=>({c,spent:spentBy.get(c.id)||0,limit:categoryLimit(c.id)}));
  const over=limited.filter(x=>x.spent>x.limit).sort((a,b)=>(b.spent-b.limit)-(a.spent-a.limit));
  const near=limited.filter(x=>x.spent<=x.limit&&x.spent/x.limit>=.8).sort((a,b)=>(b.spent/b.limit)-(a.spent/a.limit));
  const ranked=[...limited].filter(x=>x.spent>0).sort((a,b)=>b.spent-a.spent).slice(0,5);
  const max=ranked[0]?.spent||1;
  let status='good', title='Бюджет под контролем', copy='Ни одна категория с лимитом не достигла 80%.';
  if(over.length){status='danger'; title=`Превышен${over.length>1?'ы':''} ${over.length} лимит${over.length>1?'а':''}`; copy=over.slice(0,3).map(x=>`${x.c.icon} ${x.c.name}: +${money2(x.spent-x.limit)}`).join(' · ');}
  else if(near.length){status='warn'; title=`${near.length} категори${near.length===1?'я близка':'и близки'} к лимиту`; copy=near.slice(0,3).map(x=>`${x.c.icon} ${x.c.name}: ${Math.round(x.spent/x.limit*100)}%`).join(' · ');}
  const ranking=ranked.length?`<div class="insight-card"><div class="insight-row"><div class="insight-title">Топ расходов</div><span class="muted">Family</span></div><div class="rank-list">${ranked.map(x=>`<div class="rank-item"><div class="rank-name">${x.c.icon} ${x.c.name}</div><strong>${money2(x.spent)}</strong><div class="rank-bar"><span style="width:${Math.max(4,Math.round(x.spent/max*100))}%"></span></div></div>`).join('')}</div></div>`:`<div class="insight-card"><div class="insight-title">Топ расходов</div><div class="insight-copy">Появится после первых расходов в этом месяце.</div></div>`;
  els.insights.innerHTML=`<div class="insight-card ${status}"><div class="insight-title">${title}</div><div class="insight-copy">${copy}</div></div>${ranking}`;
}

function renderHistory(){
  const filter=state.historyScope;
  const q=state.historySearch.trim().toLowerCase();
  const txs=state.transactions.filter(t=>(filter==='all'||t.scope===filter) && (!q || t.description.toLowerCase().includes(q) || (getCategory(t.categoryId)?.name||'').toLowerCase().includes(q)));
  if(!txs.length){els.transactions.innerHTML=`<div class="empty"><div class="empty-icon">🧾</div><div class="empty-title">${q?'Ничего не найдено':'В этом месяце пока нет расходов'}</div><div>${q?'Попробуй другой запрос.':'Добавь первую трату выше — она появится здесь.'}</div></div>`;return;}
  const groups=new Map();
  for(const t of txs){const key=t.spentAt||String(t.createdAt).slice(0,10); if(!groups.has(key))groups.set(key,[]); groups.get(key).push(t);}
  const html=[...groups.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([date,items])=>{
    const d=new Date(date+'T12:00:00'); const title=d.toLocaleDateString('ru-RU',{weekday:'long',month:'long',day:'numeric'}); const total=items.reduce((s,t)=>s+t.amount,0);
    const rows=items.map(t=>{const c=getCategory(t.categoryId);return `<button class="transaction" data-id="${t.id}"><div><div class="transaction-title">${c?.icon||'•'} ${escapeHtml(t.description)}</div><div class="transaction-sub">${c?.name||'Other'} · ${t.scope==='business'?'Business':'Family'}</div></div><div class="transaction-right"><div class="transaction-amount">-${money2(t.amount)}</div><div class="edit-hint">Edit</div></div></button>`;}).join('');
    return `<div class="history-day"><div class="history-day-head"><span>${escapeHtml(title)}</span><strong>${money2(total)}</strong></div>${rows}</div>`;
  }).join('');
  els.transactions.innerHTML=html;
  els.transactions.querySelectorAll('.transaction').forEach(btn=>btn.addEventListener('click',()=>{const tx=state.transactions.find(t=>t.id===btn.dataset.id);if(!tx)return;editingId=tx.id;pendingExpenses=[];openEditDialog(tx,true);}));
}

function render(){
  document.querySelectorAll('.scope-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.scope===state.scope));
  document.querySelectorAll('.history-filter-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.historyScope===state.historyScope));
  const monthDate=selectedMonthDate(); els.monthLabel.textContent=monthDate.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).toUpperCase();
  const personalCategories=CATEGORY_DEFS.filter(c=>c.scope==='personal'); const budgetTotal=personalCategories.reduce((s,c)=>s+categoryLimit(c.id),0); const personalSpent=state.transactions.filter(t=>t.scope==='personal').reduce((s,t)=>s+t.amount,0);
  const left=budgetTotal-personalSpent; els.remainingTotal.textContent=money(left); els.spentTotal.textContent=`Потрачено ${money(personalSpent)}`; els.budgetTotal.textContent=`Бюджет ${money(budgetTotal)}`; els.statBudget.textContent=money(budgetTotal); els.statSpent.textContent=money(personalSpent); els.statLeft.textContent=money(left); els.statLeft.classList.toggle('negative',left<0);
  const visible=CATEGORY_DEFS.filter(c=>c.scope===state.scope);
  els.categoryList.innerHTML=visible.map(c=>{const limit=categoryLimit(c.id),spent=state.transactions.filter(t=>t.categoryId===c.id).reduce((s,t)=>s+t.amount,0),remaining=limit>0?limit-spent:null,rawPct=limit>0?(spent/limit)*100:0,pct=Math.min(100,rawPct),cls=rawPct>=100?'danger':rawPct>=80?'warn':'',cardCls=rawPct>=100?'over-budget':rawPct>=80?'near-limit':'',note=rawPct>=100?`<div class="limit-note danger">Превышение ${money2(spent-limit)}</div>`:rawPct>=80?`<div class="limit-note warn">Осталось ${money2(remaining)}</div>`:'';return `<article class="category-card ${cardCls}"><div class="category-head"><div><div class="category-name">${c.icon} ${c.name}</div><div class="category-meta">Потрачено ${money2(spent)}${limit>0?` из ${money2(limit)}`:''}</div>${note}</div><div class="category-actions"><div class="category-remaining">${limit>0?`${money2(remaining)} left`:money2(spent)}</div><button class="mini-btn edit-limit-btn" data-category="${c.id}">Лимит</button></div></div>${limit>0?`<div class="progress"><div class="${cls}" style="width:${pct}%"></div></div>`:''}</article>`;}).join('');
  els.categoryList.querySelectorAll('.edit-limit-btn').forEach(b=>b.addEventListener('click',()=>openLimitDialog(b.dataset.category)));
  const last=lastExpenseForScope(); els.repeatLastBtn.disabled=!last; els.lastExpenseHint.textContent=last?`${last.description} · ${money2(last.amount)}`:'Пока нечего повторять';
  renderInsights(); renderHistory();
}

function setSignedInView(isSignedIn){
  els.authScreen.hidden = isSignedIn;
  els.appShell.hidden = !isSignedIn;
  els.authScreen.classList.toggle('is-hidden', isSignedIn);
  els.appShell.classList.toggle('is-hidden', !isSignedIn);
}

async function showApp(session){
  currentUser=session?.user||null;
  if(!currentUser){
    state.transactions=[];
    setSignedInView(false);
    setAuthMode('login');
    els.authPassword.value='';
    els.authPassword.type='password';
    els.togglePasswordBtn.textContent='👁';
    els.userEmail.textContent='';
    return;
  }
  // Hide the login/registration card immediately. Cloud loading continues behind the app UI.
  setSignedInView(true);
  els.authMessage.hidden=true;
  els.authPassword.value='';
  els.userEmail.textContent=currentUser.email||'';
  await migrateLocalExpensesOnce();
  await loadLimits();
  await loadTransactions();
}
function containsCyrillic(value){return /[\u0400-\u04FF\u0500-\u052F]/.test(value);}
function updatePasswordGuard(){const has=containsCyrillic(els.authPassword.value);els.passwordHint.classList.toggle('warning',has);if(authMode==='signup'&&has){els.authPassword.setCustomValidity('Кириллица в пароле запрещена. Переключи клавиатуру на English.');}else{els.authPassword.setCustomValidity('');}if(has&&authMode==='login'){els.passwordHint.textContent='В пароле есть кириллица. Для старого аккаунта вход разрешён, но новый пароль лучше сделать латиницей.';}else{els.passwordHint.textContent='При регистрации используйте только латинские буквы, цифры и символы.';}}
async function handleAuthSubmit(e){e.preventDefault();const email=els.authEmail.value.trim(),password=els.authPassword.value;if(authMode==='signup'&&containsCyrillic(password)){els.authPassword.setCustomValidity('Кириллица в пароле запрещена. Переключи клавиатуру на English.');els.authPassword.reportValidity();showAuthMessage('В новом пароле нельзя использовать кириллицу. Переключи клавиатуру на English.',true);return;}els.authSubmitBtn.disabled=true;els.authMessage.hidden=true;let result=authMode==='signup'?await sb.auth.signUp({email,password}):await sb.auth.signInWithPassword({email,password});els.authSubmitBtn.disabled=false;if(result.error)return showAuthMessage(result.error.message,true);if(authMode==='signup'&&!result.data.session)showAuthMessage('Аккаунт создан. Проверь email, подтверди адрес и затем войди.');}
function setAuthMode(mode){authMode=mode;document.querySelectorAll('.auth-tab').forEach(b=>b.classList.toggle('active',b.dataset.authMode===mode));els.authSubmitBtn.textContent=mode==='signup'?'Создать аккаунт':'Войти';els.authPassword.autocomplete=mode==='signup'?'new-password':'current-password';els.authMessage.hidden=true;updatePasswordGuard();}

document.querySelectorAll('.auth-tab').forEach(btn=>btn.addEventListener('click',()=>setAuthMode(btn.dataset.authMode)));
els.togglePasswordBtn.addEventListener('click',()=>{const reveal=els.authPassword.type==='password';els.authPassword.type=reveal?'text':'password';els.togglePasswordBtn.textContent=reveal?'🙈':'👁';els.togglePasswordBtn.setAttribute('aria-label',reveal?'Скрыть пароль':'Показать пароль');els.togglePasswordBtn.title=reveal?'Скрыть пароль':'Показать пароль';els.authPassword.focus();});
els.authPassword.addEventListener('input',updatePasswordGuard);
els.authForm.addEventListener('submit',handleAuthSubmit); els.logoutBtn.addEventListener('click',async()=>{els.logoutBtn.disabled=true;await sb.auth.signOut();els.logoutBtn.disabled=false;await showApp(null);});
els.addBtn.addEventListener('click',addExpenseFromInput); els.expenseInput.addEventListener('keydown',e=>{if(e.key==='Enter')addExpenseFromInput();}); els.repeatLastBtn.addEventListener('click',repeatLastExpense);
els.saveExpenseBtn.addEventListener('click',saveDialogExpense); els.deleteExpenseBtn.addEventListener('click',deleteExpense); els.refreshBtn.addEventListener('click',async()=>{await loadLimits();await loadTransactions();});
document.querySelectorAll('.scope-btn').forEach(btn=>btn.addEventListener('click',()=>{state.scope=btn.dataset.scope;localStorage.setItem('budgetFlowScope',state.scope);render();}));
document.querySelectorAll('.history-filter-btn').forEach(btn=>btn.addEventListener('click',()=>{state.historyScope=btn.dataset.historyScope;render();})); els.historySearch.addEventListener('input',()=>{state.historySearch=els.historySearch.value;renderHistory();});
els.prevMonthBtn.addEventListener('click',()=>shiftMonth(-1)); els.nextMonthBtn.addEventListener('click',()=>shiftMonth(1)); els.todayMonthBtn.addEventListener('click',setThisMonth);
els.saveLimitBtn.addEventListener('click',saveLimit); els.resetLimitBtn.addEventListener('click',resetLimit);

sb.auth.onAuthStateChange((_event,session)=>showApp(session));
(async()=>{const {data}=await sb.auth.getSession();await showApp(data.session);})();
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
