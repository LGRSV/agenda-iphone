/* Compartilhamento financeiro João → Ana em modo de visualização.
   A política do banco permite ao casal ler o documento de tarefas do parceiro;
   por isso o resumo financeiro fica encapsulado em um registro oculto desse
   documento, sem abrir escrita ou expor credenciais. */
(() => {
  'use strict';
  const JOAO = '718266ce-ac47-4ab9-ac39-4fde8344c9d7';
  const ANA = '3f5bc48d-1c0d-4bc1-9437-0f62814d2f6b';
  const SNAPSHOT_ID = '__shared_finance_snapshot_v2__';
  const SNAPSHOT_PREFIX = '__FINANCE_SNAPSHOT_V1__';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const TASKS_KEY = 'agenda_lagares_v3';
  const NOTES_KEY = 'agenda_notas_v1';
  const ACCOUNTS_KEY = 'agenda_contas_v1';
  const INVESTMENTS_KEY = 'agenda_investimentos_v1';
  const REFACTOR_KEY = 'agenda_refaturamentos_v1';
  const read = (key,fallback) => { try { return JSON.parse(localStorage.getItem(key)||'') ?? fallback; } catch (_) { return fallback; } };
  const cfg = read(CONFIG_KEY,{});
  const owner = String(cfg.workspaceOwnerId||'');

  installShortcut();
  if (owner === ANA) {
    location.replace('./financeiro-compartilhado.html');
    return;
  }
  if (owner !== JOAO) return;

  function installShortcut() {
    const wallet=document.querySelector('.head .wallet');
    if(!wallet||document.querySelector('.refat-shortcut'))return;
    const style=document.createElement('style');
    style.textContent='.head>div{min-width:0;flex:1}.refat-shortcut{border-color:#6ec9ff!important;color:#6ec9ff!important;font-size:20px!important;font-weight:900!important;box-shadow:inset 0 0 0 1px rgba(110,201,255,.12)}';
    document.head.appendChild(style);
    const link=document.createElement('a');
    link.className='nav refat-shortcut'; link.href='./refaturamento.html'; link.setAttribute('aria-label','Refaturamento'); link.textContent='S';
    wallet.insertAdjacentElement('afterend',link);
  }

  const stableHash = value => {
    const text=JSON.stringify(value); let hash=2166136261;
    for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(16);
  };
  const decodeSnapshot = task => {
    if (task?.financeSnapshot) return task.financeSnapshot;
    const text=String(task?.text||'');
    if(!text.startsWith(SNAPSHOT_PREFIX))return null;
    try{return JSON.parse(text.slice(SNAPSHOT_PREFIX.length))}catch(_){return null}
  };

  function publishSnapshot() {
    const tasks=read(TASKS_KEY,[]), notes=read(NOTES_KEY,{});
    const existing=tasks.find(task=>task?.id===SNAPSHOT_ID);
    const previous=decodeSnapshot(existing)||{};
    const previousSummary=previous.summary||{};
    const financialTasks=tasks.filter(task=>task&&task.id!==SNAPSHOT_ID&&task.tag==='financeiro');
    const financialNotes={};
    financialTasks.forEach(task=>{if(notes[task.id])financialNotes[task.id]=notes[task.id];});
    const summary={
      currentInvoice:document.querySelector('#cartao .ct-val')?.textContent||previousSummary.currentInvoice||'',
      currentInvoiceDetail:document.querySelector('#cartao .ct-sub')?.textContent||previousSummary.currentInvoiceDetail||'',
      month:document.querySelector('#mn')?.textContent||previousSummary.month||'',
      income:document.querySelector('#in')?.textContent||previousSummary.income||'',
      expenses:document.querySelector('#out')?.textContent||previousSummary.expenses||'',
      projectedBalance:document.querySelector('#saldo')?.textContent||previousSummary.projectedBalance||''
    };
    const source={
      tasks:financialTasks, notes:financialNotes, accounts:read(ACCOUNTS_KEY,{}),
      investments:read(INVESTMENTS_KEY,{}), refaturamentos:read(REFACTOR_KEY,[]), summary
    };
    const sourceHash=stableHash(source);
    if(decodeSnapshot(existing)?.sourceHash===sourceHash)return;
    const financeSnapshot={...source,sourceHash,generatedAt:new Date().toISOString(),ownerUserId:JOAO,viewerUserId:ANA};
    const snapshot={
      id:SNAPSHOT_ID,text:SNAPSHOT_PREFIX+JSON.stringify(financeSnapshot),date:'1900-01-01',time:'',
      tag:'outros',done:true,flag:'',reminder:-1,syncRev:Date.now()
    };
    const next=tasks.filter(task=>task?.id!==SNAPSHOT_ID); next.push(snapshot);
    localStorage.setItem(TASKS_KEY,JSON.stringify(next));
  }

  function schedule(){clearTimeout(schedule.timer);schedule.timer=setTimeout(publishSnapshot,1800);}
  schedule();
  window.addEventListener('agenda:remote-sync',event=>{if(['all','tasks','notes','settings','accounts','investments','refaturamentos'].includes(event.detail?.documentKey))schedule();});
  window.addEventListener('storage',event=>{if([TASKS_KEY,NOTES_KEY,ACCOUNTS_KEY,INVESTMENTS_KEY,REFACTOR_KEY].includes(event.key))schedule();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  setInterval(schedule,60000);
})();
