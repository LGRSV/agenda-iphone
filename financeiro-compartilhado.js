(() => {
  'use strict';
  const MODULE_URL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY='agenda_supabase_config_v1';
  const JOAO='718266ce-ac47-4ab9-ac39-4fde8344c9d7';
  const ANA='3f5bc48d-1c0d-4bc1-9437-0f62814d2f6b';
  const SNAPSHOT_ID='__shared_finance_snapshot_v2__';
  const SNAPSHOT_PREFIX='__FINANCE_SNAPSHOT_V1__';
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')??fallback}catch(_){return fallback}};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number=value=>{const parsed=Number(String(value??'').replace(',','.'));return Number.isFinite(parsed)?parsed:0};
  const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value||0));
  const centMoney=value=>money(Number(value||0)/100);
  let cursor=new Date(), snapshot=null;

  const kind=(task,note)=>note.movimento||(/cobrar|sal[aá]rio|receber/i.test(task.text||'')?'entrada':number(note.valor)>0?'entrada':'sem valor');
  function renderMonth(){
    if(!snapshot)return;
    const key=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`;
    const tasks=(snapshot.tasks||[]).map(task=>({...task,n:(snapshot.notes||{})[task.id]||{}}))
      .filter(task=>String(task.date||'').startsWith(key)).sort((a,b)=>`${b.date}${b.time||''}`.localeCompare(`${a.date}${a.time||''}`));
    document.querySelector('#monthName').textContent=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(cursor);
    document.querySelector('#launches').innerHTML=tasks.length?tasks.map(task=>{
      const movement=kind(task,task.n),value=number(task.n.valor),date=String(task.date||'').split('-').reverse().join('/');
      return `<article class="row"><div><div class="title">${esc(task.text)}</div><div class="meta">${date}${task.time?` ${esc(task.time)}`:''} · ${movement==='entrada'?'Entrada':'Saída'}${task.n.forma?` · ${esc(task.n.forma)}`:''}</div></div><strong class="value ${movement}">${movement==='entrada'?'+':'−'} ${money(value)}</strong></article>`;
    }).join(''):'<div class="empty">Nenhum lançamento neste mês.</div>';
  }
  function render(){
    const a=snapshot.accounts||{}, inv=snapshot.investments||{}, prev=inv.energisaPrev||{}, summary=snapshot.summary||{};
    const refats=Array.isArray(snapshot.refaturamentos)?snapshot.refaturamentos:[];
    const total=number(a.mp)+number(a.nb);
    document.querySelector('#content').className='';
    document.querySelector('#content').innerHTML=`
      <section class="cards">
        <article class="card inter"><span>Fatura Inter atual</span><b>${esc(summary.currentInvoice||'Consulte os lançamentos abaixo')}</b><small class="muted">${esc(summary.currentInvoiceDetail||'')}</small></article>
        <article class="card mp"><span>Mercado Pago</span><b>${money(a.mp)}</b><small class="muted">Atualizado em ${esc(String(a.updMp||a.upd||'—').split('-').reverse().join('/'))}</small></article>
        <article class="card nb"><span>Nubank</span><b>${money(a.nb)}</b><small class="muted">Atualizado em ${esc(String(a.updNb||a.upd||'—').split('-').reverse().join('/'))}</small></article>
        <article class="card"><span>Saldo em contas</span><b>${money(total)}</b><small class="muted">Mercado Pago + Nubank</small></article>
        <article class="card prev"><span>EnergisaPrev</span><b>${money(prev.saldo)}</b><small class="muted">Contribuição mensal ${money(prev.aporteMensal||number(prev.aporteUsuario)+number(prev.aportePatrocinadora))}</small></article>
      </section>
      <h2>LANÇAMENTOS FINANCEIROS</h2>
      <nav class="month"><button id="prevMonth" type="button">‹</button><strong id="monthName"></strong><button id="nextMonth" type="button">›</button></nav>
      <section class="list" id="launches"></section>
      <h2 id="sharedRefats">REFATURAMENTO</h2>
      <section class="refats">${refats.length?refats.slice().sort((x,y)=>String(y.date).localeCompare(String(x.date))).map(op=>`
        <article class="refat"><div class="refat-head"><strong>${esc(op.description)}</strong><span class="badge">${op.status==='total'?'Estorno total':op.status==='parcial'?'Estorno parcial':'Realizada'}</span></div><div class="meta">${esc(String(op.date||'').split('-').reverse().join('/'))} · venda ${centMoney(op.grossCents)} · taxa ${centMoney(op.feeCents)}</div><div class="refat-grid"><span>Impacto fatura Inter</span><b>${centMoney(op.interCents)}</b><span>Impacto Mercado Pago</span><b>${centMoney(op.mpCents)}</b><span>Taxa devolvida</span><b>${centMoney(op.refundedFeeCents)}</b></div></article>`).join(''):'<div class="empty">Nenhuma operação de refaturamento.</div>'}</section>
      <p class="muted" style="text-align:center;margin-top:18px">Atualizado em ${snapshot.generatedAt?new Date(snapshot.generatedAt).toLocaleString('pt-BR'):'—'}</p>`;
    document.querySelector('#prevMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);renderMonth()};
    document.querySelector('#nextMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);renderMonth()};
    renderMonth();
  }
  async function boot(){
    const config=read(CONFIG_KEY,{});
    if(String(config.workspaceOwnerId||'')!==ANA){location.replace('./financeiro.html');return}
    const {createClient}=await import(MODULE_URL);
    const sb=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const {data:userData}=await sb.auth.getUser();
    if(!userData?.user){location.replace('./?locked=1');return}
    const {data,error}=await sb.from('agenda_documents').select('payload,updated_at').eq('user_id',JOAO).eq('document_key','tasks').maybeSingle();
    if(error)throw error;
    const task=(Array.isArray(data?.payload)?data.payload:[]).find(item=>item?.id===SNAPSHOT_ID);
    const encoded=String(task?.text||'');
    snapshot=task?.financeSnapshot || (encoded.startsWith(SNAPSHOT_PREFIX)?JSON.parse(encoded.slice(SNAPSHOT_PREFIX.length)):null);
    if(!snapshot)throw new Error('O painel financeiro ainda não foi compartilhado pelo aparelho principal.');
    render();
  }
  boot().catch(error=>{document.querySelector('#content').innerHTML=`<div class="empty">${esc(error?.message||error)}</div>`});
})();
