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
  { id:'business_materials', name:'Materials', icon:'🧰', limit:0, scope:'business', keywords:['home depot','lowes','lowe’s','lowe','sherwin','paint','material','materials','материал','краска','drywall','lumber','tile'] },
  { id:'business_tools', name:'Tools & Equipment', icon:'🛠️', limit:0, scope:'business', keywords:['tool','tools','equipment','harbor freight','dewalt','milwaukee','makita','инструмент'] },
  { id:'business_fuel', name:'Business Fuel', icon:'⛽️', limit:0, scope:'business', keywords:['bp','shell','exxon','circle k','fuel','gas','бенз','бензин','заправка'] },
  { id:'business_subcontractors', name:'Subcontractors / Labor', icon:'👷', limit:0, scope:'business', keywords:['subcontractor','labor','helper','crew','worker','zelle to david','david martiros','aik','haik','работник','помощник'] },
  { id:'business_leads', name:'Leads & Advertising', icon:'📣', limit:0, scope:'business', keywords:['thumbtack','angi','homeadvisor','advertising','ad ','ads','lead','leads','реклама','лид'] },
  { id:'business_subscriptions', name:'Business Subscriptions', icon:'💻', limit:0, scope:'business', keywords:['shopify','software','subscription','google workspace','microsoft','quickbooks','подписка бизнес'] },
  { id:'business_fees', name:'Fees & Insurance', icon:'🧾', limit:0, scope:'business', keywords:['fee','fees','insurance','license','permit','bank fee','комиссия','страховка бизнес'] },
  { id:'business_other', name:'Other Business', icon:'📦', limit:0, scope:'business', keywords:['business','work','job','работа'] },
  { id:'other', name:'Other', icon:'📦', limit:330, scope:'personal', keywords:[] },
];

let currentUser = null;
let editingId = null;
let pendingExpenses = [];
let authMode = 'login';
let limitsCloudAvailable = true;
let bankQueueAvailable = true;
const state = {
  transactions: [],
  scope: localStorage.getItem('budgetFlowScope') || 'personal',
  historyScope: 'all',
  historySearch: '',
  selectedMonth: monthKey(new Date()),
  reviewTransactions: [],
  reviewDismissed: false,
  bankConnected: false,
  bankInstitutions: [],
  limits: Object.fromEntries(CATEGORY_DEFS.map(c => [c.id, c.limit]))
};

const els = Object.fromEntries([
  'authScreen','appShell','authForm','authEmail','authPassword','togglePasswordBtn','passwordHint','authSubmitBtn','authMessage','logoutBtn','userEmail','syncStatus','syncBadge','refreshBtn',
  'remainingTotal','spentTotal','budgetTotal','statBudget','statSpent','statLeft','expenseInput','addBtn','repeatLastBtn','lastExpenseHint','categoryList','insights','transactions','historySearch','editDialog','editAmount','editCategory','editDescription',
  'saveExpenseBtn','dialogTitle','deleteExpenseBtn','parsedPreview','monthLabel','prevMonthBtn','nextMonthBtn','todayMonthBtn','historyFilter','editLimitDialog',
  'limitCategoryName','limitAmount','saveLimitBtn','resetLimitBtn','importCsvBtn','connectBankBtn','syncBankBtn','bankCsvInput','reviewSection','dashboardContent','reviewCount','reviewImportBtn','approveAllBtn','reviewNotice','reviewList','openDashboardBtn'
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


function bankSuggestion(text) {
  const t=String(text||'').toLowerCase();
  let best=getCategory('other'), bestScore=0;
  for(const c of CATEGORY_DEFS){
    const score=c.keywords.reduce((a,k)=>a+(t.includes(k.toLowerCase())?Math.max(1,k.length):0),0);
    if(score>bestScore){best=c;bestScore=score;}
  }
  return {categoryId:best.id, scope:best.scope==='business'?'business':'personal'};
}
function cleanHeader(value){return String(value||'').trim().toLowerCase().replace(/[._-]+/g,' ').replace(/\s+/g,' ');}
function findColumn(headers, names){const norm=headers.map(h=>cleanHeader(h));for(const name of names){const n=cleanHeader(name);const i=norm.findIndex(h=>h===n||h.includes(n));if(i>=0)return headers[i];}return null;}
function parseMoneyValue(value){
  if(value===null||value===undefined||value==='')return NaN;
  let s=String(value).trim(); const paren=/^\(.*\)$/.test(s); s=s.replace(/[$,\s]/g,'').replace(/[()]/g,'');
  const n=Number(s); return Number.isFinite(n)?(paren?-Math.abs(n):n):NaN;
}
function parseBankDate(value){
  const s=String(value||'').trim(); if(!s)return null;
  let m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/); if(m){let y=m[3];if(y.length===2)y=`20${y}`;return `${y}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;}
  const d=new Date(s); return Number.isNaN(d.getTime())?null:isoDate(d);
}
function stableExternalId(parts){
  const input=parts.join('|').toLowerCase(); let h=2166136261;
  for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619);}
  return `csv_${(h>>>0).toString(16)}_${input.length}`;
}
function normalizeCsvRows(rows, fields){
  const headers=fields||Object.keys(rows[0]||{});
  const dateCol=findColumn(headers,['date','posted date','transaction date','дата']);
  const descCol=findColumn(headers,['description','merchant','name','payee','details','memo','описание','продавец']);
  const idCol=findColumn(headers,['transaction id','transaction_id','id','reference','reference number']);
  const debitCol=findColumn(headers,['debit','withdrawal','withdrawals','debits']);
  const creditCol=findColumn(headers,['credit','deposit','credits']);
  const amountCol=findColumn(headers,['amount','transaction amount','сумма']);
  if(!dateCol||(!amountCol&&!debitCol)) throw new Error('Не нашёл колонки Date и Amount/Debit. Экспортируй CSV с датой, описанием и суммой.');
  const amountValues=rows.map(r=>amountCol?parseMoneyValue(r[amountCol]):NaN).filter(Number.isFinite);
  const hasNegative=amountValues.some(n=>n<0);
  const output=[]; let skippedCredits=0, skippedInvalid=0;
  for(const row of rows){
    const date=parseBankDate(row[dateCol]); const description=String(row[descCol]||'Bank transaction').trim()||'Bank transaction';
    let amount=NaN, isOutflow=true;
    if(debitCol){ amount=Math.abs(parseMoneyValue(row[debitCol])); if(!Number.isFinite(amount)||amount<=0){ const credit=creditCol?parseMoneyValue(row[creditCol]):NaN; if(Number.isFinite(credit)&&credit!==0)skippedCredits++; else skippedInvalid++; continue; } }
    else { const raw=parseMoneyValue(row[amountCol]); if(!Number.isFinite(raw)||raw===0){skippedInvalid++;continue;} if(hasNegative){isOutflow=raw<0;amount=Math.abs(raw);} else {amount=Math.abs(raw);} if(!isOutflow){skippedCredits++;continue;} }
    if(!date||!Number.isFinite(amount)||amount<=0){skippedInvalid++;continue;}
    const suggestion=bankSuggestion(description); const sourceId=String(row[idCol]||'').trim();
    output.push({external_id:sourceId||stableExternalId([date,description,amount.toFixed(2)]),merchant:description,description,amount:Number(amount.toFixed(2)),transaction_date:date,suggested_category:suggestion.categoryId,suggested_budget_type:suggestion.scope==='business'?'business':'family',status:'pending',raw_data:row});
  }
  return {rows:output,skippedCredits,skippedInvalid};
}
function showReviewNotice(message,kind='ok'){
  els.reviewNotice.hidden=false; els.reviewNotice.textContent=message; els.reviewNotice.classList.toggle('error',kind==='error'); els.reviewNotice.classList.toggle('success',kind==='ok');
}
function updatePrimaryView(forceReview=false){
  const hasPending=state.reviewTransactions.length>0;
  const showReview=bankQueueAvailable&&hasPending&&(forceReview||!state.reviewDismissed);
  els.reviewSection.hidden=!showReview; els.dashboardContent.hidden=showReview;
  if(showReview) window.scrollTo({top:0,behavior:'smooth'});
}
async function loadReviewTransactions({forceReview=false}={}){
  if(!currentUser)return;
  const {data,error}=await sb.from('bank_transactions').select('*').eq('status','pending').order('transaction_date',{ascending:false}).order('created_at',{ascending:false});
  if(error){bankQueueAvailable=false;state.reviewTransactions=[];console.warn('bank_transactions unavailable',error.message);els.importCsvBtn.disabled=true;els.importCsvBtn.title='Сначала запусти bank_transactions.sql в Supabase';updatePrimaryView();return;}
  bankQueueAvailable=true; els.importCsvBtn.disabled=false; state.reviewTransactions=(data||[]).map(r=>({...r,amount:Number(r.amount)})); renderReview(); updatePrimaryView(forceReview);
}
function categoriesForReviewScope(scope){return CATEGORY_DEFS.filter(c=>c.scope===(scope==='business'?'business':'personal'));}
function defaultCategoryForReviewScope(scope){return scope==='business'?'business_other':'other';}
function reviewCategoryOptions(selected,scope){
  const categories=categoriesForReviewScope(scope);
  const valid=categories.some(c=>c.id===selected)?selected:defaultCategoryForReviewScope(scope);
  return categories.map(c=>`<option value="${c.id}" ${c.id===valid?'selected':''}>${c.icon} ${c.name}</option>`).join('');
}
function renderReview(){
  const rows=state.reviewTransactions; els.reviewCount.textContent=rows.length; els.approveAllBtn.disabled=!rows.length;
  if(!rows.length){els.reviewList.innerHTML='<div class="empty"><div class="empty-icon">✅</div><div class="empty-title">Очередь разобрана</div><div>Новых банковских операций нет.</div></div>';return;}
  els.reviewList.innerHTML=rows.map(r=>{
    const scope=r.suggested_budget_type==='business'?'business':'family';
    const requestedCat=r.suggested_category||defaultCategoryForReviewScope(scope);
    const validCat=categoriesForReviewScope(scope).some(c=>c.id===requestedCat)?requestedCat:defaultCategoryForReviewScope(scope);
    if(validCat!==r.suggested_category) r.suggested_category=validCat;
    return `<article class="review-card" data-review-id="${r.id}"><div class="review-card-head"><div><div class="review-merchant">${escapeHtml(r.description||r.merchant||'Bank transaction')}</div><div class="review-date">${escapeHtml(r.transaction_date)}</div></div><strong class="review-amount">-${money2(r.amount)}</strong></div><div class="review-fields"><label>Категория<select class="review-category">${reviewCategoryOptions(validCat,scope)}</select></label><label>Тип<select class="review-scope"><option value="family" ${scope==='family'?'selected':''}>Family</option><option value="business" ${scope==='business'?'selected':''}>Business</option></select></label></div><label class="review-description-label">Описание<input class="review-description" value="${escapeHtml(r.description||r.merchant||'')}" /></label><div class="review-card-actions"><button class="ghost-btn ignore-review-btn" type="button">Ignore</button><button class="primary-btn approve-review-btn" type="button">Approve</button></div></article>`;
  }).join('');
  els.reviewList.querySelectorAll('.review-card').forEach(card=>{
    const id=card.dataset.reviewId; const row=state.reviewTransactions.find(x=>x.id===id); if(!row)return;
    const category=card.querySelector('.review-category'),scope=card.querySelector('.review-scope'),description=card.querySelector('.review-description');
    category.addEventListener('change',async()=>{
      row.suggested_category=category.value;
      const c=getCategory(category.value);
      if(c){row.suggested_budget_type=c.scope==='business'?'business':'family';scope.value=row.suggested_budget_type;}
      await saveReviewSuggestion(row);
    });
    scope.addEventListener('change',async()=>{
      row.suggested_budget_type=scope.value;
      const expectedScope=scope.value==='business'?'business':'personal';
      const current=getCategory(row.suggested_category);
      if(!current||current.scope!==expectedScope) row.suggested_category=defaultCategoryForReviewScope(scope.value);
      category.innerHTML=reviewCategoryOptions(row.suggested_category,scope.value);
      category.value=row.suggested_category;
      await saveReviewSuggestion(row);
    });
    description.addEventListener('change',async()=>{row.description=description.value.trim()||row.merchant||'Bank transaction';await saveReviewSuggestion(row);});
    card.querySelector('.approve-review-btn').addEventListener('click',()=>approveReviewTransaction(id));
    card.querySelector('.ignore-review-btn').addEventListener('click',()=>ignoreReviewTransaction(id));
  });
}
async function saveReviewSuggestion(row){
  const {error}=await sb.from('bank_transactions').update({description:row.description,suggested_category:row.suggested_category,suggested_budget_type:row.suggested_budget_type}).eq('id',row.id);
  if(error)showReviewNotice('Не удалось сохранить выбор: '+error.message,'error');
}
async function approveReviewTransaction(id){
  const row=state.reviewTransactions.find(x=>x.id===id);if(!row)return;
  const payload={...toCloudPayload({amount:row.amount,description:row.description||row.merchant,categoryId:row.suggested_category||'other',scope:row.suggested_budget_type==='business'?'business':'personal',spentAt:row.transaction_date}),source_bank_transaction_id:row.id};
  setSyncStatus('Подтверждаю…','syncing');
  const {error}=await sb.from('expenses').upsert(payload,{onConflict:'source_bank_transaction_id'});if(error){setSyncStatus('Ошибка','error');showReviewNotice(error.message,'error');return;}
  const done=await sb.from('bank_transactions').update({status:'approved',reviewed_at:new Date().toISOString()}).eq('id',id);if(done.error){setSyncStatus('Ошибка','error');showReviewNotice(done.error.message,'error');return;}
  state.reviewTransactions=state.reviewTransactions.filter(x=>x.id!==id);renderReview();updatePrimaryView();setSyncStatus('Синхронизировано');await loadTransactions();
}
async function ignoreReviewTransaction(id){
  const {error}=await sb.from('bank_transactions').update({status:'ignored',reviewed_at:new Date().toISOString()}).eq('id',id);if(error){showReviewNotice(error.message,'error');return;}
  state.reviewTransactions=state.reviewTransactions.filter(x=>x.id!==id);renderReview();updatePrimaryView();
}
async function approveAllReview(){
  if(!state.reviewTransactions.length)return;
  const rows=state.reviewTransactions.map(r=>({...toCloudPayload({amount:r.amount,description:r.description||r.merchant,categoryId:r.suggested_category||'other',scope:r.suggested_budget_type==='business'?'business':'personal',spentAt:r.transaction_date}),source_bank_transaction_id:r.id}));
  els.approveAllBtn.disabled=true;setSyncStatus('Подтверждаю все…','syncing');
  const {error}=await sb.from('expenses').upsert(rows,{onConflict:'source_bank_transaction_id'});if(error){els.approveAllBtn.disabled=false;setSyncStatus('Ошибка','error');showReviewNotice(error.message,'error');return;}
  const ids=state.reviewTransactions.map(r=>r.id);const done=await sb.from('bank_transactions').update({status:'approved',reviewed_at:new Date().toISOString()}).in('id',ids);if(done.error){els.approveAllBtn.disabled=false;showReviewNotice(done.error.message,'error');return;}
  const count=ids.length;state.reviewTransactions=[];renderReview();state.reviewDismissed=false;updatePrimaryView();setSyncStatus('Синхронизировано');showParsedMessage(`Подтверждено банковских операций: ${count}`);await loadTransactions();
}
async function importBankCsv(file){
  if(!file||!currentUser)return;
  if(!window.Papa){alert('CSV parser не загрузился. Обнови страницу и попробуй снова.');return;}
  setSyncStatus('Читаю CSV…','syncing');
  window.Papa.parse(file,{header:true,skipEmptyLines:true,complete:async(result)=>{
    try{
      const parsed=normalizeCsvRows(result.data||[],result.meta?.fields||[]);if(!parsed.rows.length)throw new Error('Не нашёл расходных операций в CSV.');
      const rows=parsed.rows.map(r=>({...r,user_id:currentUser.id}));
      const {error}=await sb.from('bank_transactions').upsert(rows,{onConflict:'user_id,external_id',ignoreDuplicates:true});if(error)throw error;
      state.reviewDismissed=false;await loadReviewTransactions({forceReview:true});setSyncStatus('Синхронизировано');showReviewNotice(`Импортировано на рассмотрение: ${parsed.rows.length}. Пропущено зачислений: ${parsed.skippedCredits}${parsed.skippedInvalid?`. Не распознано строк: ${parsed.skippedInvalid}`:''}.`,'ok');
    }catch(err){console.error(err);setSyncStatus('Ошибка импорта','error');showReviewNotice(err.message||String(err),'error');}
    finally{els.bankCsvInput.value='';}
  },error:(err)=>{setSyncStatus('Ошибка импорта','error');showReviewNotice(err.message||'Не удалось прочитать CSV','error');els.bankCsvInput.value='';}});
}


async function apiFetch(path, options={}){
  const {data:{session}}=await sb.auth.getSession();
  if(!session?.access_token) throw new Error('Сессия истекла. Войди снова.');
  const headers={'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,...(options.headers||{})};
  const res=await fetch(path,{...options,headers,cache:'no-store'});
  let body={};
  try{body=await res.json();}catch{}
  if(!res.ok) throw new Error(body.error||`Server error ${res.status}`);
  return body;
}
function renderBankStatus(){
  if(!els.connectBankBtn||!els.syncBankBtn)return;
  els.connectBankBtn.textContent=state.bankConnected?'Add Bank':'Connect Bank';
  els.syncBankBtn.disabled=!state.bankConnected;
  const names=state.bankInstitutions.map(x=>x.institution_name).filter(Boolean);
  els.syncBankBtn.title=names.length?`Connected: ${names.join(', ')}`:(state.bankConnected?'Bank connected':'Connect a bank first');
}
async function loadBankStatus(){
  if(!currentUser)return;
  try{
    const data=await apiFetch('/api/plaid-status',{method:'GET'});
    state.bankConnected=Boolean(data.connected);
    state.bankInstitutions=data.items||[];
  }catch(err){
    console.warn('Plaid status unavailable',err.message);
    state.bankConnected=false;state.bankInstitutions=[];
  }
  renderBankStatus();
}
async function connectBank(){
  if(!currentUser)return;
  if(!window.Plaid){showReviewNotice('Plaid Link не загрузился. Обнови страницу.','error');return;}
  els.connectBankBtn.disabled=true;setSyncStatus('Открываю банк…','syncing');
  try{
    const {link_token}=await apiFetch('/api/plaid-link-token',{method:'POST',body:'{}'});
    const handler=window.Plaid.create({
      token:link_token,
      onSuccess:async(public_token,metadata)=>{
        try{
          setSyncStatus('Подключаю банк…','syncing');
          const result=await apiFetch('/api/plaid-exchange',{method:'POST',body:JSON.stringify({public_token,institution_id:metadata?.institution?.institution_id||null,institution_name:metadata?.institution?.name||null})});
          await loadBankStatus();
          state.reviewDismissed=false;
          await loadReviewTransactions({forceReview:true});
          setSyncStatus('Синхронизировано');
          const n=result?.sync?.added||0;
          showReviewNotice(n?`Банк подключён. Новых операций на проверку: ${n}.`:'Банк подключён. Если операции ещё не появились, нажми Sync Bank через несколько секунд.','ok');
        }catch(err){setSyncStatus('Ошибка банка','error');showReviewNotice(err.message,'error');}
        finally{els.connectBankBtn.disabled=false;}
      },
      onExit:(err)=>{els.connectBankBtn.disabled=false;setSyncStatus('Синхронизировано');if(err)showReviewNotice(err.display_message||err.error_message||'Plaid Link закрыт с ошибкой','error');},
    });
    handler.open();
  }catch(err){els.connectBankBtn.disabled=false;setSyncStatus('Ошибка банка','error');showReviewNotice(err.message,'error');}
}
async function syncBank({silent=false}={}){
  if(!currentUser||!state.bankConnected)return;
  els.syncBankBtn.disabled=true;if(!silent)setSyncStatus('Синхронизирую банк…','syncing');
  try{
    const result=await apiFetch('/api/plaid-sync',{method:'POST',body:'{}'});
    state.reviewDismissed=false;
    await loadReviewTransactions({forceReview:(result.added||0)>0});
    if(!silent)showReviewNotice(`Sync готов: новых ${result.added||0}, обновлено ${result.modified||0}, удалено ${result.removed||0}.`,'ok');
    setSyncStatus('Синхронизировано');
  }catch(err){console.error(err);if(!silent){setSyncStatus('Ошибка банка','error');showReviewNotice(err.message,'error');}}
  finally{els.syncBankBtn.disabled=!state.bankConnected;}
}

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
  const activeScope=state.scope;
  const scopedTransactions=state.transactions.filter(t=>t.scope===activeScope);
  const spentBy=new Map();
  for(const t of scopedTransactions) spentBy.set(t.categoryId,(spentBy.get(t.categoryId)||0)+t.amount);
  const limited=CATEGORY_DEFS.filter(c=>c.scope===activeScope&&categoryLimit(c.id)>0).map(c=>({c,spent:spentBy.get(c.id)||0,limit:categoryLimit(c.id)}));
  const over=limited.filter(x=>x.spent>x.limit).sort((a,b)=>(b.spent-b.limit)-(a.spent-a.limit));
  const near=limited.filter(x=>x.spent<=x.limit&&x.spent/x.limit>=.8).sort((a,b)=>(b.spent/b.limit)-(a.spent/a.limit));
  const ranked=[...limited].filter(x=>x.spent>0).sort((a,b)=>b.spent-a.spent).slice(0,5);
  const max=ranked[0]?.spent||1;
  let status='good', title='Бюджет под контролем', copy='Ни одна категория с лимитом не достигла 80%.';
  if(over.length){status='danger'; title=`Превышен${over.length>1?'ы':''} ${over.length} лимит${over.length>1?'а':''}`; copy=over.slice(0,3).map(x=>`${x.c.icon} ${x.c.name}: +${money2(x.spent-x.limit)}`).join(' · ');}
  else if(near.length){status='warn'; title=`${near.length} категори${near.length===1?'я близка':'и близки'} к лимиту`; copy=near.slice(0,3).map(x=>`${x.c.icon} ${x.c.name}: ${Math.round(x.spent/x.limit*100)}%`).join(' · ');}
  const ranking=ranked.length?`<div class="insight-card"><div class="insight-row"><div class="insight-title">Топ расходов</div><span class="muted">${state.scope==='business'?'Business':'Family'}</span></div><div class="rank-list">${ranked.map(x=>`<div class="rank-item"><div class="rank-name">${x.c.icon} ${x.c.name}</div><strong>${money2(x.spent)}</strong><div class="rank-bar"><span style="width:${Math.max(4,Math.round(x.spent/max*100))}%"></span></div></div>`).join('')}</div></div>`:`<div class="insight-card"><div class="insight-title">Топ расходов</div><div class="insight-copy">Появится после первых расходов в этом месяце.</div></div>`;
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
  const activeCategories=CATEGORY_DEFS.filter(c=>c.scope===state.scope); const budgetTotal=activeCategories.reduce((s,c)=>s+categoryLimit(c.id),0); const scopedSpent=state.transactions.filter(t=>t.scope===state.scope).reduce((s,t)=>s+t.amount,0);
  const left=budgetTotal-scopedSpent; els.remainingTotal.textContent=money(left); els.spentTotal.textContent=`Потрачено ${money(scopedSpent)}`; els.budgetTotal.textContent=`Бюджет ${money(budgetTotal)}`; els.statBudget.textContent=money(budgetTotal); els.statSpent.textContent=money(scopedSpent); els.statLeft.textContent=money(left); els.statLeft.classList.toggle('negative',left<0);
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
    state.reviewTransactions=[];
    state.reviewDismissed=false;
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
  state.reviewDismissed=false;
  await migrateLocalExpensesOnce();
  await loadLimits();
  await loadBankStatus();
  if(state.bankConnected) await syncBank({silent:true});
  else await loadReviewTransactions();
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
els.connectBankBtn.addEventListener('click',connectBank);
els.syncBankBtn.addEventListener('click',()=>syncBank());
els.importCsvBtn.addEventListener('click',()=>els.bankCsvInput.click());
els.reviewImportBtn.addEventListener('click',()=>els.bankCsvInput.click());
els.bankCsvInput.addEventListener('change',()=>importBankCsv(els.bankCsvInput.files?.[0]));
els.approveAllBtn.addEventListener('click',approveAllReview);
els.openDashboardBtn.addEventListener('click',()=>{state.reviewDismissed=true;updatePrimaryView();});

sb.auth.onAuthStateChange((_event,session)=>showApp(session));
(async()=>{const {data}=await sb.auth.getSession();await showApp(data.session);})();
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
