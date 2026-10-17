// Harness de medição de layout do Agenda Lagares (frente F2 da missão layout-17promax).
//
// Contrato (usado pela especificação, pelos implementadores e pelo verificador):
//   perfis                                  -> { iphone17promax, iphone13 }
//   abrirApp(browser, perfil, {sementes})   -> { context, page } com o app aberto e a área segura emulada
//   medir(page, perfil, vista)              -> JSON com as métricas de layout
//   capturar(page, caminhoPng)              -> grava a captura do viewport em caminhoPng e a página
//                                              inteira em <pasta>/pagina-inteira/<nome>.png
// Extras (não fazem parte do contrato, só ajudam a reproduzir as vistas):
//   VISTAS, irPara(page, vista), sementesPadrao(), medirAreaSegura(page)
//
// Uso típico:
//   const { chromium } = require('/opt/node-tools/node_modules/playwright');
//   const h = require('.../harness/medir.cjs');
//   const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
//   const { context, page } = await h.abrirApp(browser, h.perfis.iphone17promax);
//   await h.irPara(page, 'mes'); console.log(await h.medir(page, h.perfis.iphone17promax, 'mes'));
//
// Emulação da área segura: primeiro o CDP Emulation.setSafeAreaInsetsOverride (funciona no
// Chromium 141 / chromium-1194). Se o CDP falhar ou o valor medido não bater, o harness refaz o
// contexto trocando env(safe-area-inset-*) por px nas respostas HTML/CSS/JS do servidor local.
// O método usado fica em page.__areaSegura = { metodo, medido }.
'use strict';

const path = require('path');
const fs = require('fs');

const BASE = 'http://127.0.0.1:8765/';
const STUB = `window.SupabaseAgenda={getConfig:()=>({}),getUser:()=>({id:'718266ce-ac47-4ab9-ac39-4fde8344c9d7'}),getAccessToken:async()=>'t',pullAll(){},syncNow(){},pushAll(){},pushDirty(){},openDialog(){}};`;

// Perfis provisórios (a frente F1 pode corrigir os números; a C1 atualiza aqui).
const perfis = {
  iphone17promax: { nome: 'iphone17promax', width: 440, height: 956, dpr: 3, insets: { top: 62, bottom: 34, left: 0, right: 0 } },
  iphone13: { nome: 'iphone13', width: 390, height: 844, dpr: 3, insets: { top: 47, bottom: 34, left: 0, right: 0 } },
};

const VISTAS = ['mes', 'dia', 'lista', 'atrasadas', 'sequencia', 'menu', 'nova-tarefa', 'jarvis', 'voz'];

// ~40 tarefas em datas próximas de hoje, com textos curtos e longos, tags variadas,
// atrasadas, concluídas e com horário. Datas relativas ao dia em que o teste roda.
function sementesPadrao() {
  const pad = n => String(n).padStart(2, '0');
  const d0 = new Date(); d0.setHours(12, 0, 0, 0);
  const dia = k => { const d = new Date(d0); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const L = [
    // [deslocamento em dias, texto, horário, tag, concluída]
    [-6, 'Pagar boleto do condomínio', '09:00', 'financeiro', false],
    [-5, 'Revisar o relatório mensal de transformadores queimados da regional norte e enviar para a coordenação com as observações do almoxarifado', '10:30', 'trabalho', false],
    [-4, 'Academia', '06:00', 'saude', true],
    [-3, 'Ligar para o dentista e remarcar a consulta de limpeza que ficou pendente desde o mês passado', '', 'saude', false],
    [-3, 'Comprar ração', '', 'casa', true],
    [-2, 'Enviar planilha de horas extras', '17:00', 'trabalho', false],
    [-2, 'Estudar capítulo 4 de cálculo', '20:00', 'faculdade', false],
    [-1, 'Renovar seguro do carro antes do vencimento e comparar pelo menos três cotações diferentes', '', 'financeiro', false],
    [-1, 'Lavar roupa', '', 'casa', true],
    [0, 'Reunião de alinhamento semanal com a equipe de manutenção da rede de distribuição', '08:30', 'trabalho', false],
    [0, 'Academia — treino de pernas', '06:30', 'saude', true],
    [0, 'Mercado', '18:30', 'casa', false],
    [0, 'Responder e-mails pendentes', '11:00', 'trabalho', false],
    [0, 'Pagar fatura do cartão Inter', '', 'financeiro', false],
    [0, 'Ler 20 páginas', '22:00', 'pessoal', false],
    [1, 'Entregar trabalho de estatística', '23:59', 'faculdade', false],
    [1, 'Buscar receita no consultório do Dr. Valmocir e passar na farmácia para retirar os medicamentos do mês', '14:00', 'saude', false],
    [1, 'Corte de cabelo', '16:00', 'pessoal', false],
    [2, 'Vistoria de religadores no alimentador PLM-03', '07:30', 'trabalho', false],
    [2, 'Trocar lâmpada da varanda', '', 'casa', false],
    [3, 'Aniversário da mãe — comprar presente e encomendar o bolo na padaria da esquina com antecedência', '', 'pessoal', false],
    [3, 'Prova de física', '19:00', 'faculdade', false],
    [4, 'Declarar gastos do mês na planilha', '', 'financeiro', false],
    [5, 'Churrasco com amigos', '12:00', 'pessoal', false],
    [5, 'Limpar a caixa d’água', '', 'casa', false],
    [6, 'Auditoria de elos fusíveis na subestação centro, conferindo o dimensionamento pela NDU-002', '09:00', 'trabalho', false],
    [7, 'Pagar IPVA', '', 'financeiro', false],
    [8, 'Consulta oftalmologista', '15:30', 'saude', false],
    [9, 'Planejar viagem de férias', '', 'pessoal', false],
    [10, 'Seminário de redes elétricas inteligentes', '19:30', 'faculdade', false],
    [11, 'Manutenção preventiva do ar-condicionado do quarto e da sala', '', 'casa', false],
    [12, 'Reunião com o gerente regional', '10:00', 'trabalho', false],
    [13, 'Revisar investimentos', '', 'financeiro', false],
    [14, 'Trocar óleo do carro', '08:00', 'outros', false],
    [16, 'Entrega do TCC — versão preliminar com todos os capítulos revisados pelo orientador', '23:00', 'faculdade', false],
    [18, 'Dentista', '09:30', 'saude', false],
    [20, 'Renovar CNH', '', 'outros', false],
    [22, 'Pintar o portão', '', 'casa', false],
    [25, 'Fechamento do mês', '17:00', 'trabalho', false],
    [28, 'Cinema', '20:30', 'pessoal', false],
  ];
  return L.map(([k, text, time, tag, done], i) => ({ id: 'layout-' + i, text, date: dia(k), time, tag, reminder: -1, done }));
}

const PROBE_CSS = '.__layout_probe{padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}';
const PROBE_URL = '/__layout-probe-area-segura.css';
const trocarEnv = (txt, ins) => txt.replace(/env\(\s*safe-area-inset-(top|bottom|left|right)\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/g, (_, k) => ins[k] + 'px');

// Mede o env(safe-area-inset-*) que a página enxerga. No método 'route' a regra de prova vem do
// servidor pela mesma rota que reescreve o CSS do app (prova que a troca de texto funciona).
async function medirAreaSegura(page) {
  const viaRota = !!(page.__areaSegura && page.__areaSegura.metodo === 'route');
  return page.evaluate(async ({ viaRota, PROBE_CSS, PROBE_URL }) => {
    let css = PROBE_CSS;
    if (viaRota) css = await (await fetch(PROBE_URL, { cache: 'no-store' })).text();
    const st = document.createElement('style'); st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
    const p = document.createElement('div'); p.className = '__layout_probe';
    p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none';
    (document.body || document.documentElement).appendChild(p);
    const s = getComputedStyle(p);
    const r = { top: parseFloat(s.paddingTop), right: parseFloat(s.paddingRight), bottom: parseFloat(s.paddingBottom), left: parseFloat(s.paddingLeft) };
    p.remove(); st.remove();
    return r;
  }, { viaRota, PROBE_CSS, PROBE_URL });
}

const bate = (m, ins) => ['top', 'bottom', 'left', 'right'].every(k => Math.abs((m[k] || 0) - ins[k]) < 0.5);

async function novoContexto(browser, perfil, sementes, metodo) {
  const context = await browser.newContext({
    viewport: { width: perfil.width, height: perfil.height },
    screen: { width: perfil.width, height: perfil.height },
    deviceScaleFactor: perfil.dpr, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', locale: 'pt-BR', timezoneId: 'America/Araguaina',
  });
  await context.addInitScript(seeds => {
    try {
      if (sessionStorage.getItem('__layout_seed')) return;
      sessionStorage.setItem('__layout_seed', '1');
      localStorage.setItem('sb-uabpevnjfcwidbjscowq-auth-token', '{"access_token":"x","refresh_token":"y"}');
      localStorage.setItem('jarvis_voice_on', '0');
      if (seeds) localStorage.setItem('agenda_lagares_v3', JSON.stringify(seeds));
    } catch (_) {}
  }, sementes);
  if (metodo === 'route') {
    // Fallback: troca env(safe-area-inset-*) por px no que vem do servidor local.
    // Registrado ANTES do stub para que o stub tenha precedência (Playwright roda a rota mais recente primeiro).
    const ins = perfil.insets;
    await context.route(u => u.origin === 'http://127.0.0.1:8765', async route => {
      const url = route.request().url();
      if (new URL(url).pathname === PROBE_URL) return route.fulfill({ contentType: 'text/css', body: trocarEnv(PROBE_CSS, ins) });
      let resp;
      try { resp = await route.fetch(); } catch (_) { return route.abort(); }
      const ct = resp.headers()['content-type'] || '';
      if (/text\/html|text\/css|javascript/.test(ct) || /\.js(\?|$)/.test(url)) {
        const body = trocarEnv(await resp.text(), ins);
        return route.fulfill({ response: resp, body });
      }
      return route.fulfill({ response: resp });
    });
  }
  await context.route('**/supabase-shared-storage.js*', r => r.fulfill({ contentType: 'application/javascript', body: STUB }));
  await context.route('https://uabpevnjfcwidbjscowq.supabase.co/**', r => r.abort());
  const page = await context.newPage();
  page.__erros = [];
  page.on('pageerror', e => page.__erros.push(String(e)));
  return { context, page };
}

// opts: { sementes, caminho = '' (página relativa à BASE), base = BASE, metodo: 'auto'|'cdp'|'route'|'nenhum' (controle) }
async function abrirApp(browser, perfil, opts = {}) {
  const sementes = opts.sementes === undefined ? sementesPadrao() : opts.sementes;
  const caminho = opts.caminho || '';
  const base = opts.base || BASE;
  const pedido = opts.metodo || 'auto';
  let ctx, areaSegura = null;
  if (pedido === 'nenhum') { // controle: sem emulação nenhuma (env() = 0 no Chromium de desktop)
    ctx = await novoContexto(browser, perfil, sementes, 'nenhum');
    areaSegura = { metodo: 'nenhum' };
  } else if (pedido !== 'route') {
    ctx = await novoContexto(browser, perfil, sementes, 'cdp');
    try {
      const cdp = await ctx.context.newCDPSession(ctx.page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { ...perfil.insets } });
      ctx.page.__cdp = cdp;
      areaSegura = { metodo: 'cdp' };
    } catch (e) {
      areaSegura = null;
      if (pedido === 'cdp') throw new Error('CDP Emulation.setSafeAreaInsetsOverride falhou: ' + e.message);
    }
  }
  if (!areaSegura) {
    if (ctx) await ctx.context.close();
    ctx = await novoContexto(browser, perfil, sementes, 'route');
    areaSegura = { metodo: 'route' };
  }
  const { context, page } = ctx;
  page.__areaSegura = areaSegura;
  page.__perfil = perfil;
  await page.goto(base + caminho, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const ehApp = caminho === '' || /^(\.\/)?(index\.html)?(\?.*)?$/.test(caminho);
  if (ehApp) {
    await page.waitForFunction(() => window.AgendaAPI, null, { timeout: 20000 });
    await page.waitForSelector('#viewContent > *', { timeout: 10000 }).catch(() => {});
  } else {
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  }
  await page.waitForTimeout(ehApp ? 900 : 1200);
  areaSegura.medido = await medirAreaSegura(page);
  areaSegura.confere = bate(areaSegura.medido, perfil.insets);
  if (!areaSegura.confere && areaSegura.metodo === 'cdp' && pedido === 'auto') {
    // O CDP aceitou a chamada mas o env() não mudou: refaz com a troca de texto.
    await context.close();
    return abrirApp(browser, perfil, { ...opts, metodo: 'route' });
  }
  return { context, page };
}

async function clicar(page, sel) {
  await page.waitForSelector(sel, { state: 'attached', timeout: 8000 });
  try { await page.click(sel, { timeout: 2500 }); }
  catch (_) { await page.$eval(sel, el => el.click()); }
}

// Coloca o app numa das vistas do contrato, partindo de qualquer estado.
async function irPara(page, vista) {
  if (!VISTAS.includes(vista)) throw new Error('vista desconhecida: ' + vista);
  await page.evaluate(() => {
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (_) {} });
    const jp = document.getElementById('jarvis-panel');
    if (jp && jp.classList.contains('open')) document.getElementById('jarvis-close')?.click();
    const qm = document.getElementById('quickMenu');
    if (qm && qm.classList.contains('is-open')) document.getElementById('moreMenuBtn')?.click();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  });
  await page.waitForTimeout(250);
  const base = { mes: 'month', dia: 'day', lista: 'list', atrasadas: 'list', sequencia: 'sequencia' }[vista] || 'month';
  await clicar(page, `[data-view="${base}"]`);
  await clicar(page, `[data-filter="${vista === 'atrasadas' ? 'late' : 'all'}"]`);
  await page.waitForTimeout(450);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (vista === 'menu') { await clicar(page, '#moreMenuBtn'); await page.waitForSelector('#quickMenu.is-open', { timeout: 4000 }); }
  if (vista === 'nova-tarefa') { await clicar(page, '#openDialog'); await page.waitForSelector('#taskDialog[open]', { timeout: 4000 }); }
  if (vista === 'jarvis' || vista === 'voz') { await clicar(page, '#jarvis-btn'); await page.waitForSelector('#jarvis-panel.open', { timeout: 4000 }); }
  if (vista === 'voz') { await page.waitForTimeout(300); await clicar(page, '#jarvis-key'); await page.waitForSelector('#voz-dialog[open]', { timeout: 6000 }); }
  await page.waitForTimeout(600); // transições de .18s a .3s
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
}

async function medir(page, perfil, vista) {
  const area = await medirAreaSegura(page);
  const dados = await page.evaluate(({ perfil }) => {
    window.scrollTo(0, 0);
    const W = window.innerWidth, H = window.innerHeight, ins = perfil.insets;
    const IGN = /^(active|on|pulse|open|is-open|sel|selected|current|today|outside|rec|spin|done|overdue|seq-current|seq-done|seq-active|is-swiped|show)$/;
    const parte = el => {
      const tag = el.tagName.toLowerCase();
      let s = tag;
      const cls = [...el.classList].filter(c => !IGN.test(c));
      if (cls.length) s += '.' + cls.map(c => CSS.escape(c)).join('.');
      for (const at of ['data-view', 'data-filter', 'data-action', 'data-reschedule-preset', 'data-p']) {
        const v = el.getAttribute(at);
        if (v != null) s += `[${at}="${at === 'data-p' ? v.slice(0, 18) + '…' : v}"]`;
      }
      if (s === tag) {
        const t = el.getAttribute('type'); if (t && tag === 'input') s += `[type="${t}"]`;
        const al = el.getAttribute('aria-label') || el.getAttribute('title');
        if (al) s += `[aria-label="${al.slice(0, 32)}"]`;
        else if (tag === 'a' && el.getAttribute('href')) s += `[href="${el.getAttribute('href')}"]`;
      }
      return s;
    };
    // ids com dígitos (ex.: list-date-2026-10-17) mudam com a data: não servem de prefixo estável
    const idEstavel = id => id && !/\d/.test(id);
    const seletor = el => {
      if (el.id) return '#' + el.id;
      const base = parte(el);
      const pai = el.parentElement;
      // sem classe nem atributo: inclui o pai para o seletor dizer alguma coisa
      const meio = (base === el.tagName.toLowerCase() && pai && pai !== document.body && !idEstavel(pai.id)) ? parte(pai) + ' > ' : '';
      let a = pai;
      while (a && a !== document.body && a !== document.documentElement) {
        if (idEstavel(a.id)) return '#' + a.id + ' ' + meio + base;
        a = a.parentElement;
      }
      return meio + base;
    };
    const texto = el => (el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const modal = document.querySelector('dialog:modal');
    const visivelBasico = el => {
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return false;
      }
      return true;
    };
    const visivel = el => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      if (el.closest('[inert]')) return false;
      if (modal && !modal.contains(el)) return false; // atrás de um diálogo modal: inerte
      const cs = getComputedStyle(el);
      if (cs.pointerEvents === 'none') return false;
      if (el.tagName === 'INPUT' && el.type === 'hidden') return false;
      const ehCampo = /^(INPUT|SELECT)$/.test(el.tagName); // campo invisível sobre um rótulo continua tocável
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const s = n === el ? cs : getComputedStyle(n);
        if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
        if (!(ehCampo && n === el) && parseFloat(s.opacity) < 0.05) return false;
      }
      return true;
    };
    // retângulo visível depois do recorte pelos ancestrais com overflow
    const recorte = el => {
      const r = el.getBoundingClientRect();
      let L = r.left, T = r.top, R = r.right, B = r.bottom;
      for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
          const p = n.getBoundingClientRect();
          if (s.overflowX !== 'visible') { L = Math.max(L, p.left); R = Math.min(R, p.right); }
          if (s.overflowY !== 'visible') { T = Math.max(T, p.top); B = Math.min(B, p.bottom); }
        }
        if (s.position === 'fixed') break;
      }
      return { L, T, R, B };
    };
    const fixo = el => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return true; if (n.tagName === 'DIALOG' && n.open) return true; } return false; };
    const r1 = v => Math.round(v * 10) / 10;

    const todos = [...document.querySelectorAll('button, a, input, [role=button], select, textarea')].filter(visivel);
    const sobIlha = [], sobInd = [], peq = new Map();
    for (const el of todos) {
      const c = recorte(el);
      const naTela = c.R > c.L + 0.5 && c.B > c.T + 0.5 && c.R > 0 && c.L < W && c.B > 0 && c.T < H;
      if (naTela && c.T < ins.top - 0.5) sobIlha.push({ seletor: seletor(el), top: r1(c.T), bottom: r1(c.B), texto: texto(el), fixo: fixo(el) });
      if (naTela && c.B > H - ins.bottom + 0.5) sobInd.push({ seletor: seletor(el), top: r1(c.T), bottom: r1(c.B), texto: texto(el), fixo: fixo(el) });
      const r = el.getBoundingClientRect();
      if (r.width < 44 - 0.01 || r.height < 44 - 0.01) {
        const s = seletor(el), k = s + '|' + r1(r.width) + '|' + r1(r.height);
        if (peq.has(k)) peq.get(k).n++;
        else peq.set(k, { seletor: s, w: r1(r.width), h: r1(r.height), n: 1, texto: texto(el) });
      }
    }
    // elementos que passam da largura do viewport (fora de contêineres com rolagem/recorte horizontal)
    const transb = [];
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || (r.right <= W + 0.5 && r.left >= -0.5)) continue;
      const c = recorte(el);
      if (c.R <= W + 0.5 && c.L >= -0.5) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      transb.push({ seletor: seletor(el), left: r1(r.left), right: r1(r.right), w: r1(r.width) });
    }
    transb.sort((a, b) => b.right - a.right);
    const largo = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const app = [...document.querySelectorAll('.app, main, #app, .wrap, .container, .page, .shell')].find(largo)
      || [...document.body.children].filter(e => largo(e) && !/^(SCRIPT|STYLE|DIALOG)$/.test(e.tagName) && getComputedStyle(e).position !== 'fixed')
        .sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0] || null;
    const appR = app && app.getBoundingClientRect(), appS = app && getComputedStyle(app);
    const cel = [...document.querySelectorAll('.calendar-day')].find(e => e.getBoundingClientRect().width > 0);
    const celR = cel && cel.getBoundingClientRect();
    let sobre = null;
    const ov = modal || document.querySelector('#jarvis-panel.open') || document.querySelector('.quick-menu.is-open') || document.querySelector('dialog[open]');
    if (ov) {
      const r = ov.getBoundingClientRect();
      sobre = { seletor: seletor(ov), left: r1(r.left), right: r1(r.right), top: r1(r.top), bottom: r1(r.bottom), w: r1(r.width), h: r1(r.height),
        dentroDaAreaSegura: r.top >= ins.top - 0.5 && r.bottom <= H - ins.bottom + 0.5 && r.left >= ins.left - 0.5 && r.right <= W - ins.right + 0.5 };
    }
    const cab = [...document.querySelectorAll('.topbar, header, .head, .tr-head, h1')].find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
    const cabR = cab && cab.getBoundingClientRect();
    // topo do conteúdo do cabeçalho (texto ou controle), que é o que não pode ficar sob a ilha;
    // a caixa do cabeçalho pode começar em 0 se o padding-top já reserva a área segura.
    let cabConteudoTop = null;
    if (cab) {
      const tops = [];
      const tw = document.createTreeWalker(cab, NodeFilter.SHOW_TEXT);
      for (let t = tw.nextNode(); t; t = tw.nextNode()) {
        if (!t.textContent.trim() || !visivelBasico(t.parentElement)) continue;
        const rg = document.createRange(); rg.selectNodeContents(t);
        for (const rr of rg.getClientRects()) if (rr.width > 0 && rr.height > 0) tops.push(rr.top);
      }
      for (const e of cab.querySelectorAll('button, a, input, select, textarea, svg, img')) {
        if (!visivelBasico(e)) continue; const rr = e.getBoundingClientRect(); if (rr.width > 0 && rr.height > 0) tops.push(rr.top);
      }
      if (tops.length) cabConteudoTop = r1(Math.min(...tops));
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      viewportW: W, viewportH: H,
      scrollWidthBody: document.body.scrollWidth,
      interativosSobIlha: sobIlha,
      interativosSobIndicador: sobInd,
      alvosPequenos: [...peq.values()],
      larguraConteudo: appR ? r1(appR.width) : null,
      larguraConteudoInterna: appR ? r1(appR.width - parseFloat(appS.paddingLeft) - parseFloat(appS.paddingRight)) : null,
      seletorConteudo: app ? seletor(app) : null,
      paddingTopConteudo: appS ? parseFloat(appS.paddingTop) : null,
      celulaCalendario: celR ? r1(celR.width) : null,
      celulaCalendarioAltura: celR ? r1(celR.height) : null,
      cabecalho: cabR ? { seletor: seletor(cab), top: r1(cabR.top), bottom: r1(cabR.bottom), conteudoTop: cabConteudoTop,
        sobIlha: cabConteudoTop != null ? cabConteudoTop < ins.top - 0.5 : cabR.top < ins.top - 0.5 } : null,
      flutuantes: todos.filter(e => getComputedStyle(e).position === 'fixed' || (e.parentElement && getComputedStyle(e.parentElement).position === 'fixed'))
        .map(e => { const r = e.getBoundingClientRect(); return { seletor: seletor(e), left: r1(r.left), right: r1(r.right), top: r1(r.top), bottom: r1(r.bottom), w: r1(r.width), h: r1(r.height) }; }),
      sobreposicao: sobre,
      transbordando: transb.slice(0, 12),
      totalInterativosVisiveis: todos.length,
    };
  }, { perfil });
  return {
    vista, perfil: perfil.nome, url: page.url().replace(/^https?:\/\/[^/]+/, ''),
    metodoAreaSegura: page.__areaSegura ? page.__areaSegura.metodo : null,
    insetMedido: area,
    ...dados,
  };
}

// Grava o viewport em caminhoPng (com as faixas da área segura marcadas em vermelho translúcido)
// e a página inteira, sem marcação, em <pasta>/pagina-inteira/<nome>.png.
async function capturar(page, caminhoPng, opts = {}) {
  const marcar = opts.marcarAreaSegura !== false;
  fs.mkdirSync(path.dirname(caminhoPng), { recursive: true });
  const dirInteira = path.join(path.dirname(caminhoPng), 'pagina-inteira');
  fs.mkdirSync(dirInteira, { recursive: true });
  const inteira = path.join(dirInteira, path.basename(caminhoPng));
  try {
    await page.screenshot({ path: inteira, fullPage: true, animations: 'disabled' });
  } catch (e) {
    const h = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), Math.floor(16000 / (page.__perfil ? page.__perfil.dpr : 3)));
    await page.screenshot({ path: inteira, clip: { x: 0, y: 0, width: page.viewportSize().width, height: h }, animations: 'disabled' });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  if (marcar) {
    const ins = await medirAreaSegura(page);
    await page.evaluate(ins => {
      const mk = css => { const d = document.createElement('div'); d.className = '__layout_marca'; d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;left:0;right:0;' + css; document.documentElement.appendChild(d); return d; };
      if (ins.top) mk(`top:0;height:${ins.top}px;background:rgba(255,40,40,.22);border-bottom:1px dashed rgba(255,60,60,.95)`);
      if (ins.bottom) mk(`bottom:0;height:${ins.bottom}px;background:rgba(255,40,40,.22);border-top:1px dashed rgba(255,60,60,.95)`);
    }, ins);
  }
  await page.screenshot({ path: caminhoPng, fullPage: false, animations: 'disabled' });
  if (marcar) await page.evaluate(() => document.querySelectorAll('.__layout_marca').forEach(e => e.remove()));
  return { viewport: caminhoPng, paginaInteira: inteira };
}

module.exports = { perfis, abrirApp, medir, capturar, VISTAS, irPara, sementesPadrao, medirAreaSegura };
