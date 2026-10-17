#!/usr/bin/env node
// Teste independente de layout do Agenda Lagares (frente F5 da missão layout-17promax).
//
// Uso: node layout.cjs [http://127.0.0.1:8765/]
//
// Implementa, com medições próprias (page.evaluate sobre getBoundingClientRect / getComputedStyle /
// elementFromPoint), os critérios numéricos da seção 6 da especificação (S6.1 … S6.10) e os critérios
// 1 a 6 da definição de pronto do plano (P1 … P6). O harness da F2 (harness/medir.cjs) só é usado para
// abrir o app com a área segura emulada, navegar entre as vistas e capturar telas; o medir() dele é
// chamado apenas como conferência cruzada (os números que decidem ok/FALHOU são os daqui).
//
// Saída: uma linha por verificação
//   ok - <id> <descrição> (<medida>)
//   FALHOU - <id> <descrição> (<medida obtida> vs <esperado>)
// Linhas que começam com "# " são só informação. Código de saída: 0 se tudo passou, 1 se algo falhou.
//
// Variáveis opcionais: LAYOUT_CAPTURAS (pasta das capturas), LAYOUT_SUITES (pasta das suítes E2E),
// LAYOUT_JSON (arquivo das medidas brutas; padrão testes/resultado-layout.json).
//
// Rodada 2 (devolução do coordenador, briefings/F5-rodada2.md):
//  - R5: S6.1.<perfil>.<vista>.bruto — todo elemento visível com getBoundingClientRect().right > innerWidth + 0,5
//    ou left < −0,5 reprova, mesmo recortado por html/body/.app/.view-shell. Só ficam de fora os filhos dos
//    contêineres de rolagem horizontal intencional (ROLAGEM_INTENCIONAL, overflow-x auto/scroll), e só se o
//    contêiner couber no viewport. O mesmo predicado roda, como verificação extra, na paisagem e nas auxiliares.
//  - R6: nível B por extensão medida da zona de toque (elementFromPoint no centro horizontal, varredura de 0,25 px
//    a partir do meio do botão, para cima e para baixo, refinada por bisseção): zona ≥ 43,5, e ≥ 6 px de cada lado.
//    Mais: zero pares de zonas sobrepostas entre interativos do mesmo cartão.
//  - S6.8 com as emendas da especificação (marketplace, versões, contrato do nível B e correções R1–R4/P2).
//  - S6.10 com a linha de entrada do Jarvis inteira no painel e o #taskDialog dentro de 20..420.
'use strict';

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const h = require(path.join(__dirname, '..', 'harness', 'medir.cjs'));

const BASE = (() => {
  let b = process.argv[2] || 'http://127.0.0.1:8765/';
  b = b.replace(/index\.html(\?.*)?$/, '');
  if (!b.endsWith('/')) b += '/';
  return b;
})();
const REPO = path.resolve(__dirname, '..', '..', '..');
const SCRATCH = '/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad';
const CAPT = process.env.LAYOUT_CAPTURAS || path.join(SCRATCH, 'layout', 'verificacao');
const SUITES = process.env.LAYOUT_SUITES || path.join(SCRATCH, 'tools');
const SAIDA_JSON = process.env.LAYOUT_JSON || path.join(__dirname, 'resultado-layout.json');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const EPS = 0.01;   // ruído de ponto flutuante nos predicados "≥ 44" / "≥ 28"
const TOL = 0.5;    // tolerância da especificação (seção 6) para igualdades
const ZONA_MIN = 43.5; // rodada 2 (R6): extensão vertical mínima medida da zona de toque do nível B
const LADO_MIN = 6;    // e, de cada lado da caixa, pelo menos os 6 px da sonda original da especificação
// Rodada 2 (R5): contêineres de rolagem horizontal intencional. Os filhos deles podem passar do viewport (rolam
// dentro do contêiner), desde que o próprio contêiner caiba e tenha overflow-x auto/scroll. Lista fechada:
// app: #jarvis-chips (chips do Jarvis) e #filters (filtros, rolam no iPhone 13); financeiro: #saldoAtual e #pager
// (carrosséis); equipamentos-especiais: #filtros e #filtros-cat (faixas de chips).
const ROLAGEM_INTENCIONAL = ['#jarvis-chips', '#filters', '#saldoAtual', '#pager', '#filtros', '#filtros-cat'];

const P17 = h.perfis.iphone17promax;
const P13 = h.perfis.iphone13;
// Perfil de paisagem: objeto literal da especificação, seção 6, item 10.
const PAISAGEM = { nome: 'iphone17promax-paisagem', width: 956, height: 440, dpr: 3, insets: { top: 20, bottom: 20, left: 62, right: 62 } };
const TAG = { iphone17promax: '17pm', iphone13: '13', 'iphone17promax-paisagem': 'paisagem' };

// ---------------------------------------------------------------------------------------------
// Registro de resultados
const resultados = [];
const bruto = { base: BASE, perfis: {}, auxiliares: {}, suites: {}, textos: {} };
function chk(id, desc, ok, medida, esperado) {
  resultados.push({ id, desc, ok: !!ok, medida: String(medida), esperado: String(esperado) });
  console.log(ok ? `ok - ${id} ${desc} (${medida})` : `FALHOU - ${id} ${desc} (${medida} vs ${esperado})`);
}
const nota = s => console.log('# ' + s);
const f1 = v => (v == null || Number.isNaN(v)) ? String(v) : String(Math.round(v * 10) / 10);
const f2 = v => (v == null || !Number.isFinite(v)) ? String(v) : v.toFixed(2);
const perto = (a, b, tol = TOL) => a != null && Math.abs(a - b) <= tol + 1e-9;
const ge = (a, b) => a != null && a >= b - EPS;

// ---------------------------------------------------------------------------------------------
// Funções que rodam dentro da página (serializadas pelo Playwright: tudo precisa estar dentro delas)

// Coleta geral: interativos visíveis (com retângulo bruto e recortado), transbordo horizontal e scrollWidth.
function coletarPagina(arg) {
  const W = innerWidth, H = innerHeight;
  const r1 = v => Math.round(v * 10) / 10;
  const modal = document.querySelector('dialog:modal');
  const nome = el => {
    if (el.id) return '#' + el.id;
    const cls = [...el.classList].filter(c => !/^(active|on|open|is-open|sel|selected|current|today|outside|done|overdue|show|pulse)$/.test(c)).slice(0, 2);
    let s = el.tagName.toLowerCase() + (cls.length ? '.' + cls.join('.') : '');
    if (!cls.length) {
      const t = el.getAttribute('type'); if (t) s += `[type=${t}]`;
      const al = el.getAttribute('aria-label');
      if (al) s += `[aria-label="${al.slice(0, 24)}"]`;
      else if (el.tagName === 'A' && el.getAttribute('href')) s += `[href="${el.getAttribute('href').slice(0, 30)}"]`;
    }
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (a.id && !/\d/.test(a.id)) return '#' + a.id + ' ' + s;
    return s;
  };
  const visivel = el => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (el.closest('[inert]')) return false;
    if (modal && !modal.contains(el)) return false; // atrás de diálogo modal = inerte
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.pointerEvents === 'none') return false;
    if (el.tagName === 'INPUT' && el.type === 'hidden') return false;
    const campo = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName); // campo transparente sobre rótulo continua tocável
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = n === el ? cs : getComputedStyle(n);
      if (s.display === 'none') return false;
      if (!(campo && n === el) && parseFloat(s.opacity) < 0.05) return false;
    }
    return true;
  };
  const fixo = el => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p === 'fixed' || p === 'sticky') return true;
    }
    return false;
  };
  const recorte = el => {
    const r = el.getBoundingClientRect();
    let L = r.left, T = r.top, R = r.right, B = r.bottom;
    if (getComputedStyle(el).position === 'fixed') return { L, T, R, B };
    for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      const p = n.getBoundingClientRect();
      if (s.overflowX !== 'visible') { L = Math.max(L, p.left); R = Math.min(R, p.right); }
      if (s.overflowY !== 'visible') { T = Math.max(T, p.top); B = Math.min(B, p.bottom); }
      if (s.position === 'fixed') break;
    }
    return { L, T, R, B };
  };
  const SEL = 'button, a, input, select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=switch], [role=menuitem]';
  const itens = [];
  for (const el of document.querySelectorAll(SEL)) {
    if (!visivel(el)) continue;
    const r = el.getBoundingClientRect(), c = recorte(el);
    const naTela = c.R > c.L + 0.5 && c.B > c.T + 0.5 && c.R > 0 && c.L < W && c.B > 0 && c.T < H;
    const lab = el.closest('label.field-check');
    itens.push({
      sel: nome(el), w: r1(r.width), h: r1(r.height), L: r1(r.left), T: r1(r.top), R: r1(r.right), B: r1(r.bottom),
      cL: r1(c.L), cT: r1(c.T), cR: r1(c.R), cB: r1(c.B), naTela, fixo: fixo(el),
      nivelB: ['notas-toggle', 'agenda-share', 'tr-open'].find(k => el.classList.contains(k))
        || (el.classList.contains('list-previous') && !el.classList.contains('list-more') ? 'list-previous' : null),
      credito: !!el.closest('#voz-dialog .vz-cred'),
      id: el.id || null,
      labelFieldCheckH: lab ? r1(lab.getBoundingClientRect().height) : null,
    });
  }
  const transb = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.right <= W + 0.5 && r.left >= -0.5) continue;
    if (getComputedStyle(el).visibility !== 'visible') continue;
    const c = recorte(el);
    if (c.R <= c.L || c.B <= c.T) continue; // totalmente recortado
    if (c.R <= W + 0.5 && c.L >= -0.5) continue;
    transb.push(nome(el) + ' ' + r1(r.left) + '..' + r1(r.right));
  }
  // Rodada 2 (R5): transbordo BRUTO. Nenhum recorte é descontado (html/body com overflow-x:clip, .app, .view-shell
  // com overflow:hidden recortam sem gerar scrollWidth). Visível = visibility visible, nenhum ancestral com
  // display:none e opacidade ≥ 0,05 em toda a cadeia. Exceção única: filhos de um contêiner da lista de rolagem
  // horizontal intencional, com overflow-x auto/scroll, desde que o contêiner caiba no viewport.
  const rolagem = (arg && arg.rolagem) || [];
  const cabe = rr => rr.left >= -0.5 && rr.right <= W + 0.5;
  const visivelCss = el => {
    if (getComputedStyle(el).visibility !== 'visible') return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || parseFloat(s.opacity) < 0.05) return false; }
    return true;
  };
  const fora = [], excluidos = {};
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || cabe(r)) continue;
    if (!visivelCss(el)) continue;
    let cont = null, contRuim = null;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = rolagem.find(x => a.matches(x));
      if (!s) continue;
      const cs = getComputedStyle(a), ar = a.getBoundingClientRect();
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && cabe(ar)) cont = s;
      else contRuim = `${s} ${cs.overflowX} ${r1(ar.left)}..${r1(ar.right)}`;
      break;
    }
    if (cont) { excluidos[cont] = (excluidos[cont] || 0) + 1; continue; }
    fora.push(nome(el) + ' ' + r1(r.left) + '..' + r1(r.right) + (contRuim ? ` (contêiner ${contRuim} não vale)` : ''));
  }
  return { W, H, sw: document.documentElement.scrollWidth, scrollY: window.scrollY, itens, transb: transb.slice(0, 8), nTransb: transb.length,
    fora: fora.slice(0, 6), nFora: fora.length, excluidos };
}

// Retângulos de uma lista de seletores (elementos com tamanho > 0 e visibility visible).
function retangulos(sels) {
  const r1 = v => Math.round(v * 10) / 10;
  const out = {};
  for (const s of sels) {
    out[s] = [...document.querySelectorAll(s)].filter(e => {
      const r = e.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none') return false; }
      return getComputedStyle(e).visibility === 'visible';
    }).map(e => { const r = e.getBoundingClientRect(); return { w: r1(r.width), h: r1(r.height), L: r1(r.left), T: r1(r.top), R: r1(r.right), B: r1(r.bottom) }; });
  }
  return out;
}

// Nível B (rodada 2, R6): altura ≥ 28 e EXTENSÃO MEDIDA da zona de toque. Com o botão rolado para o meio da tela,
// elementFromPoint no centro horizontal, partindo do meio do botão para cima e para baixo a cada 0,25 px até o
// primeiro ponto que não devolve o botão (nem descendente); a fronteira é refinada por bisseção (12 passos) entre o
// último acerto e o primeiro erro. zona = fronteira de baixo − fronteira de cima; acima/abaixo = quanto a zona passa
// da caixa (getBoundingClientRect) de cada lado. Critério: zona ≥ zonaMin e acima, abaixo ≥ ladoMin.
function testarNivelB(arg) {
  const sels = arg.sels, zonaMin = arg.zonaMin, ladoMin = arg.ladoMin;
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  const desc = e => e ? (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')) : null;
  const out = {};
  for (const [k, s] of Object.entries(sels)) {
    const els = [...document.querySelectorAll(s)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility === 'visible'; });
    const reg = { n: els.length, hMin: null, hMax: null, zMin: null, zMax: null, acimaMin: null, abaixoMin: null, acertos: 0, centralizados: 0, falhas: [] };
    const mn = (a, b) => a == null ? b : Math.min(a, b), mx = (a, b) => a == null ? b : Math.max(a, b);
    for (const el of els) {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, meio = r.top + r.height / 2;
      const centralizado = Math.abs(meio - innerHeight / 2) <= innerHeight / 4;
      if (centralizado) reg.centralizados++;
      const acerta = y => { const e = document.elementFromPoint(cx, y); return !!e && (e === el || el.contains(e)); };
      const fronteira = dir => {
        let bom = meio, d = 0.25;
        for (; d <= r.height / 2 + 40; d += 0.25) { const y = meio + dir * d; if (acerta(y)) bom = y; else break; }
        let a = bom, b = meio + dir * d;
        for (let i = 0; i < 12; i++) { const m = (a + b) / 2; if (acerta(m)) a = m; else b = m; }
        return { y: a, vizinho: desc(document.elementFromPoint(cx, b)) };
      };
      let zona = 0, acima = -Infinity, abaixo = -Infinity, vizCima = null, vizBaixo = null;
      if (acerta(meio)) {
        const t = fronteira(-1), b = fronteira(+1);
        zona = b.y - t.y; acima = r.top - t.y; abaixo = b.y - r.bottom; vizCima = t.vizinho; vizBaixo = b.vizinho;
      } else vizCima = vizBaixo = desc(document.elementFromPoint(cx, meio));
      reg.hMin = mn(reg.hMin, r1(r.height)); reg.hMax = mx(reg.hMax, r1(r.height));
      reg.zMin = mn(reg.zMin, r2(zona)); reg.zMax = mx(reg.zMax, r2(zona));
      reg.acimaMin = mn(reg.acimaMin, r2(acima)); reg.abaixoMin = mn(reg.abaixoMin, r2(abaixo));
      if (zona >= zonaMin - 1e-6 && acima >= ladoMin - 1e-6 && abaixo >= ladoMin - 1e-6) reg.acertos++;
      else if (reg.falhas.length < 4) reg.falhas.push({ texto: el.textContent.trim().slice(0, 24), h: r1(r.height), zona: r2(zona), acima: r2(acima), abaixo: r2(abaixo), centralizado, vizCima, vizBaixo });
    }
    out[k] = reg;
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  return out;
}

// Rodada 2 (R6): zonas de toque geométricas dos interativos de cada cartão (.task-card) e pares sobrepostos.
// Zona = caixa do elemento unida ao ::before absoluto (que é posicionado contra a caixa de padding: as bordas
// entram na conta). Pares aninhados (um contém o outro) não contam. Sobreposição = interseção > tol nos dois eixos.
function paresZonas(arg) {
  const tol = arg.tol;
  const r1 = v => Math.round(v * 10) / 10;
  const nome = e => e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '');
  const zona = el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el), b = getComputedStyle(el, '::before');
    let L = r.left, T = r.top, R = r.right, B = r.bottom;
    if (b.position === 'absolute' && b.content !== 'none' && cs.position !== 'static') {
      const n = x => (x === 'auto' ? 0 : parseFloat(x));
      const pl = r.left + parseFloat(cs.borderLeftWidth), pt = r.top + parseFloat(cs.borderTopWidth);
      const pr = r.right - parseFloat(cs.borderRightWidth), pb = r.bottom - parseFloat(cs.borderBottomWidth);
      L = Math.min(L, pl + n(b.left)); R = Math.max(R, pr - n(b.right)); T = Math.min(T, pt + n(b.top)); B = Math.max(B, pb - n(b.bottom));
    }
    return { L, T, R, B };
  };
  const cartoes = [...document.querySelectorAll('#viewContent .task-card')].filter(c => c.getBoundingClientRect().height > 0);
  const pares = [], tipos = {};
  let nInter = 0;
  for (const c of cartoes) {
    const els = [...c.querySelectorAll('button, a, input, select, textarea, summary, [role=button]')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility === 'visible'; });
    nInter += els.length;
    for (const e of els) tipos[nome(e)] = (tipos[nome(e)] || 0) + 1;
    const zs = els.map(e => ({ e, z: zona(e) }));
    for (let i = 0; i < zs.length; i++) for (let j = i + 1; j < zs.length; j++) {
      const a = zs[i], b = zs[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const w = Math.min(a.z.R, b.z.R) - Math.max(a.z.L, b.z.L), hh = Math.min(a.z.B, b.z.B) - Math.max(a.z.T, b.z.T);
      if (w > tol && hh > tol) pares.push(`${nome(a.e)} [${r1(a.z.T)}..${r1(a.z.B)}] × ${nome(b.e)} [${r1(b.z.T)}..${r1(b.z.B)}]: ${r1(w)}×${r1(hh)}`);
    }
  }
  return { cartoes: cartoes.length, nInter, tipos, nPares: pares.length, pares: pares.slice(0, 4) };
}

// Estilo do véu (body::before) e comparação com o fundo do body.
function estiloVeu() {
  const b = getComputedStyle(document.body, '::before');
  return { position: b.position, height: b.height, zIndex: b.zIndex, content: b.content, top: b.top, left: b.left, right: b.right,
    bg: b.backgroundColor, bodyBg: getComputedStyle(document.body).backgroundColor };
}

// Página rolada 400 px: o que está sob a faixa da ilha fica coberto pelo véu?
function veuRolado(arg) {
  const ins = arg.ins, W = innerWidth;
  const r1 = v => Math.round(v * 10) / 10;
  window.scrollTo({ top: 400, left: 0, behavior: 'instant' });
  const p = document.elementFromPoint(220, 31);
  const app = document.querySelector('main.app') || document.querySelector('.app');
  const modal = document.querySelector('dialog:modal');
  const visivel = el => {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    if (modal && !modal.contains(el)) return false;
    const cs = getComputedStyle(el); if (cs.visibility !== 'visible' || cs.pointerEvents === 'none') return false;
    if (el.tagName === 'INPUT' && el.type === 'hidden') return false;
    const campo = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = n === el ? cs : getComputedStyle(n); if (s.display === 'none') return false; if (!(campo && n === el) && parseFloat(s.opacity) < 0.05) return false; }
    return true;
  };
  const desc = e => e ? (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')) : null;
  const sob = [];
  for (const el of document.querySelectorAll('button, a, input, select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=switch], [role=menuitem]')) {
    if (!visivel(el)) continue;
    const r = el.getBoundingClientRect();
    if (!(r.top < ins.top && r.bottom > 0 && r.right > 0 && r.left < W)) continue;
    const x = (Math.max(r.left, 0) + Math.min(r.right, W)) / 2, y = (Math.max(r.top, 0) + Math.min(r.bottom, ins.top)) / 2;
    const e = document.elementFromPoint(x, y);
    const coberto = !(e && (e === el || el.contains(e)));
    sob.push({ sel: desc(el), top: r1(r.top), x: r1(x), y: r1(y), noPonto: desc(e), coberto });
  }
  // Mesma população da medição da C1 (extras-auditoria.cjs, "rolado400"): sem filtro de visibilidade.
  const sobC1 = [];
  for (const el of document.querySelectorAll('button, a, input, select, textarea, [role=button]')) {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0 && r.top < ins.top && r.bottom > 0)) continue;
    const x = (Math.max(r.left, 0) + Math.min(r.right, W)) / 2, y = (Math.max(r.top, 0) + Math.min(r.bottom, ins.top)) / 2;
    const e = document.elementFromPoint(x, y);
    sobC1.push({ sel: desc(el), top: r1(r.top), visivel: visivel(el), noPonto: desc(e), coberto: !(e && (e === el || el.contains(e))) });
  }
  const out = { scrollY: window.scrollY, pontoEhBody: p === document.body, pontoDentroDoApp: !!(app && p && app.contains(p)), noPonto: desc(p), sob, sobC1 };
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  return out;
}

// Topo do primeiro conteúdo visível (texto ou controle) da página com rolagem 0, e o cabeçalho.
function topoConteudo() {
  const r1 = v => Math.round(v * 10) / 10;
  const H = innerHeight;
  const desc = e => e ? (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')) : null;
  const ok = el => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility !== 'visible' || parseFloat(s.opacity) < 0.05) return false;
    }
    return true;
  };
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  let min = Infinity, quem = null;
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    if (!t.textContent.trim()) continue;
    const p = t.parentElement;
    if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TITLE)$/.test(p.tagName) || !ok(p)) continue;
    const rg = document.createRange(); rg.selectNodeContents(t);
    for (const rr of rg.getClientRects()) if (rr.width > 1 && rr.height > 1 && rr.bottom > 0 && rr.top < H && rr.top < min) { min = rr.top; quem = desc(p) + ' "' + t.textContent.trim().slice(0, 20) + '"'; }
  }
  for (const e of document.body.querySelectorAll('button, a, input, select, textarea, svg, img')) {
    if (!ok(e)) continue;
    const rr = e.getBoundingClientRect();
    if (rr.width > 1 && rr.height > 1 && rr.bottom > 0 && rr.top < H && rr.top < min) { min = rr.top; quem = desc(e); }
  }
  const cab = [...document.querySelectorAll('header, .topbar, .head, .tr-head, .hd')].find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && ok(e); });
  const cr = cab && cab.getBoundingClientRect();
  return { top: min === Infinity ? null : r1(min), quem, cabecalho: cab ? { sel: desc(cab), top: r1(cr.top), bottom: r1(cr.bottom) } : null };
}

// ---------------------------------------------------------------------------------------------
// Ajudantes do lado Node

async function abrir(browser, perfil, opts = {}) {
  const r = await h.abrirApp(browser, perfil, { base: BASE, ...opts });
  const a = r.page.__areaSegura;
  nota(`${perfil.nome}${opts.caminho ? ' ' + opts.caminho : ''}: área segura ${a.metodo} medida ${JSON.stringify(a.medido)} confere=${a.confere}`);
  return r;
}

async function capturar(page, nomeArq) {
  try { await h.capturar(page, path.join(CAPT, nomeArq + '.png')); }
  catch (e) { nota(`captura ${nomeArq} falhou: ${e.message}`); }
}

// Rodada 2 (R5): linha do transbordo bruto (mesmo recortado), com os contêineres excluídos listados.
const fmtExcl = o => Object.keys(o || {}).length ? Object.entries(o).map(([k, n]) => `${k} (${n} filhos)`).join(', ') : 'nenhum';
function chkBruto(id, onde, c, W) {
  chk(id, `nenhum elemento visível fora do viewport ${onde}, mesmo recortado (exceto rolagem horizontal intencional)`, c.nFora === 0,
    `fora ${c.nFora}${c.nFora ? ' [' + c.fora.join('; ') + (c.nFora > c.fora.length ? ` …+${c.nFora - c.fora.length}` : '') + ']' : ''}; excluídos: ${fmtExcl(c.excluidos)}`,
    `0 elementos com left < −0,5 ou right > ${W} + 0,5`);
}

const sobIlha = (c, ins) => c.itens.filter(x => x.naTela && x.cT < ins.top - 0.5);
const fixosSobIndicador = (c, ins) => c.itens.filter(x => x.naTela && x.fixo && x.cB > c.H - ins.bottom + 0.5);
const folga = (c, ins, x) => Math.round((c.H - ins.bottom - x.cB) * 10) / 10;
const lista = arr => arr.slice(0, 5).map(x => typeof x === 'string' ? x : `${x.sel}[${f1(x.cT)}..${f1(x.cB)}]`).join(', ') + (arr.length > 5 ? ` …+${arr.length - 5}` : '');

// Checa alvos de nível A (w ≥ 44 e h ≥ 44) para cada seletor; n = quantidade esperada (null = "todos", ≥ 1).
function checarAlvosA(prefixo, rects, especs) {
  const falhas = [];
  for (const [sel, n] of especs) {
    const rs = rects[sel] || [];
    const pequenos = rs.filter(r => !(ge(r.w, 44) && ge(r.h, 44)));
    const qtdOk = n == null ? rs.length >= 1 : rs.length === n;
    const tam = rs.length ? `${rs.length}× ${[...new Set(rs.map(r => f1(r.w) + '×' + f1(r.h)))].slice(0, 4).join(' / ')}` : 'ausente';
    const ok = qtdOk && pequenos.length === 0;
    chk(`${prefixo}.${sel.replace(/\s+/g, '')}`, `alvo ${sel} ≥ 44×44`, ok, tam, `${n == null ? '≥1' : n}× w≥44 e h≥44`);
    if (!ok) falhas.push(sel);
  }
  return falhas;
}

// Nível B (rodada 2): h ≥ 28, zona medida ≥ ZONA_MIN e ≥ LADO_MIN de cada lado, em todos os botões.
function chkNivelB(id, rotulo, r) {
  const ok = r.n > 0 && ge(r.hMin, 28) && r.acertos === r.n;
  chk(id, `${rotulo}: h ≥ 28 e zona de toque medida ≥ ${ZONA_MIN} (≥ ${LADO_MIN} px acima e abaixo)`, ok,
    `${r.n} botões, h ${f1(r.hMin)}–${f1(r.hMax)}, zona ${f2(r.zMin)}–${f2(r.zMax)}, menor extensão acima ${f2(r.acimaMin)} / abaixo ${f2(r.abaixoMin)}, ok ${r.acertos}/${r.n}` +
      (r.falhas.length ? ' [falhas: ' + r.falhas.map(x => `"${x.texto}" h${x.h} zona ${f2(x.zona)} (acima ${f2(x.acima)}→${x.vizCima}, abaixo ${f2(x.abaixo)}→${x.vizBaixo})${x.centralizado ? '' : ' não centralizável'}`).join('; ') + ']' : ''),
    `≥1 botão, h ≥ 28, zona ≥ ${ZONA_MIN} e ≥ ${LADO_MIN} de cada lado em todos`);
}

// Pequenos (< 44 em w ou h) permitidos pela especificação, por vista (seção 6, item 3).
function pequenosPermitidos(vista, x) {
  const b = x.nivelB && ge(x.h, 28);
  if (['dia', 'atrasadas', 'sequencia'].includes(vista)) return b && (x.nivelB === 'notas-toggle' || x.nivelB === 'agenda-share');
  if (vista === 'lista') return b;
  if (vista === 'voz') return x.credito;
  if (vista === 'nova-tarefa') return x.id === 'taskLembrete' && x.labelFieldCheckH != null && ge(x.labelFieldCheckH, 44);
  return false; // mes, menu, jarvis: nenhum
}

// ---------------------------------------------------------------------------------------------
// Etapa: app nos perfis de retrato (17 Pro Max e 13)

const ALVOS_POR_VISTA = {
  mes: [['#viewTabs .view-tab', 4], ['#filters .chip', 4], ['#calFullBtn', 1], ['#seqTimerBtn', 1], ['#parceiroBtn', 1], ['#moreMenuBtn', 1],
    ['#openDialog', 1], ['#jarvis-btn', 1], ['#app-update', 1], ['#seqEntryBtn', 1]],
  dia: [['#viewContent .nav-btn', 2], ['#viewContent .check', null], ['#viewContent .task-reschedule', null], ['#viewContent .day-pick-input', 1]],
  lista: [['#clearDone', 1], ['.list-more', 1], ['#viewContent .check', null], ['#viewContent .task-reschedule', null]],
  jarvis: [['#jarvis-mic', 1], ['#jarvis-send', 1], ['.jarvis-hbtn', 3], ['.j-chip', 7], ['#jarvis-locbar', 1], ['#jarvis-input', 1]],
  'nova-tarefa': [['#closeTaskDialog', 1], ['#taskForm .primary', 1], ['#taskForm .field-check', null]],
  voz: [['#voz-dialog .vz-x', 1], ['#voz-dialog .vz-ouvir', null]],
};
const NIVEL_B = { 'notas-toggle': '.notas-toggle', 'agenda-share': '.agenda-share', 'tr-open': '.tr-open', 'list-previous': '.list-previous:not(.list-more)' };
const NIVEL_B_POR_VISTA = { dia: ['notas-toggle', 'agenda-share'], atrasadas: ['notas-toggle', 'agenda-share'], sequencia: ['notas-toggle', 'agenda-share'], lista: ['notas-toggle', 'agenda-share', 'tr-open', 'list-previous'] };
// Valores esperados da seção 6 (17PM, 13)
const ESP4 = {
  larguraConteudo: [440, 390], larguraConteudoInterna: [408, 358], celulaCalendario: [52.6, 46], celulaCalendarioAltura: [91, 78],
  taskDialog: [408, 358], vozDialog: [408, 358], alertsDialog: [408, 358], rescheduleDialog: [400, 358], rescheduleTaskName: [303, 261],
  jarvisPanel: [416, 366], taskMain: [296, 246], calendarTagFont: ['9px', '8px'],
};

async function etapaRetrato(browser, perfil, acum) {
  const t = TAG[perfil.nome], ins = perfil.insets, ix = perfil === P17 ? 0 : 1;
  const reg = acum[perfil.nome] = { vistas: {}, medidas: {}, alvosFalhos: [], p1: [], p2: [], p3falhas: [], erros: [] };
  const { context, page } = await abrir(browser, perfil);
  const esperado4 = k => ESP4[k][ix];
  const m4 = (k, v, desc) => {
    reg.medidas[k] = v;
    const e = esperado4(k);
    const ok = typeof e === 'string' ? v === e : perto(v, e);
    chk(`S6.4.${t}.${k}`, desc, ok, typeof v === 'number' ? f1(v) : String(v), typeof e === 'number' ? `${e} ± ${TOL}` : e);
  };
  for (const vista of h.VISTAS) {
    try {
      await h.irPara(page, vista);
      const c = await page.evaluate(coletarPagina, { ins, rolagem: ROLAGEM_INTENCIONAL });
      let hm = null;
      try { hm = await h.medir(page, perfil, vista); } catch (e) { nota('medir() do harness falhou em ' + vista + ': ' + e.message); }
      reg.vistas[vista] = { sw: c.sw, W: c.W, H: c.H, nTransb: c.nTransb, transb: c.transb, n: c.itens.length };

      // S6.1 — sem rolagem lateral (scrollWidth == viewportW e transbordando vazio)
      chk(`S6.1.${t}.${vista}`, `sem rolagem lateral em ${vista}`, c.sw === perfil.width && c.nTransb === 0,
        `scrollWidth ${c.sw}, transbordando ${c.nTransb}${c.nTransb ? ' [' + c.transb.join('; ') + ']' : ''}${hm ? `; medir(): sw ${hm.scrollWidth}, transb ${hm.transbordando.length}` : ''}`,
        `scrollWidth ${perfil.width}, transbordando 0`);
      chkBruto(`S6.1.${t}.${vista}.bruto`, `em ${vista}`, c, perfil.width);

      // S6.2 — ilha e indicador
      const si = sobIlha(c, ins), fi = fixosSobIndicador(c, ins);
      chk(`S6.2.${t}.${vista}.ilha`, `nenhum interativo sob a ilha (top < ${ins.top}) em ${vista}`, si.length === 0,
        `${si.length}${si.length ? ': ' + lista(si) : ''}; scrollY ${c.scrollY}${hm ? `; medir(): ${hm.interativosSobIlha.length}` : ''}`, '0');
      chk(`S6.2.${t}.${vista}.indicador`, `nenhum interativo fixo sob o indicador (bottom > ${perfil.height - ins.bottom}) em ${vista}`, fi.length === 0,
        `${fi.length}${fi.length ? ': ' + lista(fi) : ''}${hm ? `; medir(): ${hm.interativosSobIndicador.filter(x => x.fixo).length}` : ''}`, '0');
      const fixosNaTela = c.itens.filter(x => x.naTela && x.fixo);
      const apertados = fixosNaTela.filter(x => folga(c, ins, x) < 8);
      chk(`S6.2.${t}.${vista}.folga8`, `nenhum fixo interativo a menos de 8 px da faixa do indicador em ${vista}`, apertados.length === 0,
        apertados.length ? apertados.slice(0, 5).map(x => `${x.sel} folga ${folga(c, ins, x)}`).join(', ') : `${fixosNaTela.length} fixos, menor folga ${fixosNaTela.length ? Math.min(...fixosNaTela.map(x => folga(c, ins, x))) : '—'}`,
        'folga ≥ 8 em todos');
      for (const [id] of [['app-update'], ['jarvis-btn'], ['openDialog'], ['cardioFab']]) {
        const x = c.itens.find(i => i.id === id && i.naTela);
        if (x) (reg.folgas = reg.folgas || {})[id] = [...((reg.folgas || {})[id] || []), { vista, folga: folga(c, ins, x) }];
      }
      reg.p1.push({ vista, sw: c.sw });
      reg.p2.push({ vista, ilha: si.length, ind: fi.length, detalhe: lista(si.concat(fi)) });

      // S6.3 — alvos pequenos: só os permitidos pela especificação
      const peq = c.itens.filter(x => !(ge(x.w, 44) && ge(x.h, 44)));
      const proibidos = peq.filter(x => !pequenosPermitidos(vista, x));
      const resumo = arr => { const m = new Map(); for (const x of arr) { const k = `${x.sel} ${f1(x.w)}×${f1(x.h)}`; m.set(k, (m.get(k) || 0) + 1); } return [...m].slice(0, 6).map(([k, n]) => n > 1 ? `${k} ×${n}` : k).join(', ') + (m.size > 6 ? ` …+${m.size - 6}` : ''); };
      let hmProib = null;
      if (hm) hmProib = hm.alvosPequenos.filter(a => {
        if (['dia', 'atrasadas', 'sequencia'].includes(vista)) return !(/\.(notas-toggle|agenda-share)/.test(a.seletor) && a.h >= 28 - EPS);
        if (vista === 'lista') return !(/\.(notas-toggle|agenda-share|tr-open|list-previous)/.test(a.seletor) && !/list-more/.test(a.seletor) && a.h >= 28 - EPS);
        if (vista === 'voz') return !/a\[href=/.test(a.seletor);
        if (vista === 'nova-tarefa') return a.seletor !== '#taskLembrete';
        return true;
      });
      chk(`S6.3.${t}.${vista}.pequenos`, `alvos < 44 em ${vista} só os permitidos pela especificação`, proibidos.length === 0 && (!hmProib || hmProib.length === 0),
        `próprio: ${peq.length} pequenos, ${proibidos.length} fora da lista${proibidos.length ? ' [' + resumo(proibidos) + ']' : ''}${peq.length - proibidos.length ? '; permitidos: ' + resumo(peq.filter(x => pequenosPermitidos(vista, x))) : ''}${hm ? `; medir().alvosPequenos fora da lista: ${hmProib.length}${hmProib.length ? ' [' + hmProib.slice(0, 4).map(a => `${a.seletor} ${a.w}×${a.h}`).join(', ') + ']' : ''}` : ''}`,
        'nenhum fora da lista (seção 6 item 3)');

      // S6.3 — alvos nível A por vista
      if (ALVOS_POR_VISTA[vista]) {
        const sels = ALVOS_POR_VISTA[vista].map(x => x[0]);
        const rects = await page.evaluate(retangulos, sels);
        reg.medidas['alvos-' + vista] = rects;
        const f = checarAlvosA(`S6.3.${t}.${vista}`, rects, ALVOS_POR_VISTA[vista]);
        reg.alvosFalhos.push(...f.map(s => vista + ':' + s));
        if (perfil === P17) {
          const p3 = { mes: ['#viewTabs .view-tab', '#filters .chip', '#calFullBtn', '#seqTimerBtn', '#parceiroBtn', '#moreMenuBtn', '#openDialog', '#jarvis-btn'], dia: ['#viewContent .nav-btn'], jarvis: ['#jarvis-mic', '#jarvis-send', '.jarvis-hbtn'] }[vista] || [];
          for (const s of p3) { reg.p3 = reg.p3 || {}; reg.p3[s] = rects[s]; }
        }
      }

      // Medidas da S6.4 e da S6.9 por vista
      if (vista === 'mes') {
        const m = await page.evaluate(() => {
          const app = document.querySelector('main.app') || document.querySelector('.app');
          const a = app.getBoundingClientRect(), s = getComputedStyle(app);
          const cel = [...document.querySelectorAll('.calendar-day')].find(e => e.getBoundingClientRect().width > 0);
          const cr = cel.getBoundingClientRect();
          const tag = [...document.querySelectorAll('.calendar-tag')].find(e => e.getBoundingClientRect().width > 0);
          const hh = s2 => { const e = [...document.querySelectorAll(s2)].find(x => x.getBoundingClientRect().height > 0); return e ? e.getBoundingClientRect().height : null; };
          return { larguraConteudo: a.width, larguraConteudoInterna: a.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight),
            celW: cr.width, celH: cr.height, celTop: cr.top, tagFont: tag ? getComputedStyle(tag).fontSize : null,
            viewTabsH: hh('#viewTabs'), seqEntryH: hh('#seqEntryBtn'), filtersH: hh('#filters'), toolbarH: hh('#viewContent .toolbar') ?? hh('.toolbar'), scrollY: window.scrollY };
        });
        m4('larguraConteudo', m.larguraConteudo, 'largura do .app');
        m4('larguraConteudoInterna', m.larguraConteudoInterna, 'largura interna do .app');
        m4('celulaCalendario', m.celW, 'largura da célula do calendário');
        m4('celulaCalendarioAltura', m.celH, 'altura da célula do calendário');
        m4('calendarTagFont', m.tagFont, 'font-size da .calendar-tag');
        reg.medidas.topo = m;
        // S6.9 — orçamento vertical
        if (perfil === P17) {
          chk('S6.9.17pm.viewTabs', '#viewTabs altura', perto(m.viewTabsH, 54), f1(m.viewTabsH), `54 ± ${TOL}`);
          chk('S6.9.17pm.seqEntryBtn', '#seqEntryBtn altura', perto(m.seqEntryH, 44), f1(m.seqEntryH), `44 ± ${TOL}`);
          chk('S6.9.17pm.filters', '#filters altura', perto(m.filtersH, 60), f1(m.filtersH), `60 ± ${TOL}`);
          chk('S6.9.17pm.toolbar', '.toolbar altura (Mês)', perto(m.toolbarH, 62), f1(m.toolbarH), `62 ± ${TOL}`);
          chk('S6.9.17pm.celulaTop', 'top da primeira .calendar-day (rolagem 0)', perto(m.celTop, 598, 2), f1(m.celTop), '598 ± 2');
        } else {
          nota(`13 mes: #viewTabs ${f1(m.viewTabsH)}, #seqEntryBtn ${f1(m.seqEntryH)}, #filters ${f1(m.filtersH)}, .toolbar ${f1(m.toolbarH)}`);
          chk('S6.9.13.celulaTop', 'top da primeira .calendar-day (rolagem 0)', perto(m.celTop, 612, 2), f1(m.celTop), '612 ± 2');
        }
      }
      if (vista === 'dia') {
        const tm = await page.evaluate(() => [...document.querySelectorAll('#viewContent .task-main')].map(e => e.getBoundingClientRect().width).filter(w => w > 0));
        const v = tm.length ? Math.min(...tm) : null, vM = tm.length ? Math.max(...tm) : null;
        reg.medidas.taskMainTodos = tm.length;
        const e = esperado4('taskMain');
        chk(`S6.4.${t}.taskMain`, `largura de #viewContent .task-main (todos, vista dia)`, tm.length > 0 && perto(v, e) && perto(vM, e),
          tm.length ? `${tm.length} cartões, ${f1(v)}–${f1(vM)}` : 'ausente', `${e} ± ${TOL}`);
        reg.medidas.taskMain = v;
      }
      if (vista === 'jarvis') {
        const w = await page.evaluate(() => { const e = document.querySelector('#jarvis-panel.open'); return e ? e.getBoundingClientRect().width : null; });
        m4('jarvisPanel', w, 'largura do #jarvis-panel');
      }
      if (vista === 'nova-tarefa') {
        const w = await page.evaluate(() => document.getElementById('taskDialog').getBoundingClientRect().width);
        m4('taskDialog', w, 'largura do #taskDialog');
      }
      if (vista === 'voz') {
        const w = await page.evaluate(() => document.getElementById('voz-dialog').getBoundingClientRect().width);
        m4('vozDialog', w, 'largura do #voz-dialog');
      }

      // S6.7 — véu (lista e mes)
      if (vista === 'lista' || vista === 'mes') {
        const v = await page.evaluate(estiloVeu);
        reg.medidas['veu-' + vista] = v;
        const ok = v.position === 'fixed' && v.height === ins.top + 'px' && v.zIndex === '60' && v.content === '""' && v.bg === v.bodyBg;
        chk(`S6.7.${t}.${vista}.estilo`, `body::before é o véu (fixed, altura ${ins.top}px, z 60, cor do body) em ${vista}`, ok,
          `position ${v.position}, height ${v.height}, z ${v.zIndex}, content ${v.content}, bg ${v.bg} / body ${v.bodyBg}`,
          `fixed, ${ins.top}px, 60, "", bg = body`);
      }

      await capturar(page, `${perfil.nome}-${vista}`);

      // Depois da captura: testes que rolam ou mudam estado
      if (vista === 'lista') {
        const r = await page.evaluate(veuRolado, { ins });
        reg.medidas.veuRolado = r;
        // Esperado da especificação: 7 de 7 (17PM) / 3 de 3 (13), contados como a C1 contou (sem filtro de
        // visibilidade). Além disso, todos os interativos VISÍVEIS sob a faixa têm de estar cobertos.
        const cob = r.sob.filter(x => x.coberto).length, cobC1 = r.sobC1.filter(x => x.coberto).length, esp = perfil === P17 ? 7 : 3;
        const invis = r.sobC1.filter(x => !x.visivel).map(x => x.sel);
        chk(`S6.7.${t}.lista.rolado`, 'rolado 400: elementFromPoint(220,31) é o body e todo interativo sob a faixa fica coberto', r.pontoEhBody && !r.pontoDentroDoApp && cob === r.sob.length && cobC1 === r.sobC1.length && r.sobC1.length === esp,
          `scrollY ${r.scrollY}, ponto=${r.noPonto}${r.pontoDentroDoApp ? ' (dentro do .app)' : ''}; população da C1: cobertos ${cobC1} de ${r.sobC1.length}${invis.length ? ` (${invis.length} invisíveis: ${[...new Set(invis)].join(', ')})` : ''}; só visíveis: cobertos ${cob} de ${r.sob.length}${cob < r.sob.length ? ' [descobertos: ' + r.sob.filter(x => !x.coberto).slice(0, 4).map(x => x.sel + '→' + x.noPonto).join(', ') + ']' : ''}`,
          `body, ${esp} de ${esp} cobertos, visíveis todos cobertos`);
      }
      if (vista === 'mes') {
        // S6.9 — toast forçado
        const tt = await page.evaluate(async () => {
          const t = document.getElementById('toast'); if (!t) return null;
          if (!t.textContent.trim()) t.textContent = 'Teste de layout';
          t.classList.add('show');
          await new Promise(r => setTimeout(r, 700));
          const r = t.getBoundingClientRect(), c = document.getElementById('cardioFab');
          const cr = c ? c.getBoundingClientRect() : null;
          const out = { top: r.top, bottom: r.bottom, cardioTop: cr ? cr.top : null };
          t.classList.remove('show');
          return out;
        });
        await page.waitForTimeout(400);
        const alvo = perfil.height - ins.bottom - 184;
        chk(`S6.9.${t}.toast`, 'toast forçado: bottom = H − insetB − 184 e acima do #cardioFab', tt && perto(tt.bottom, alvo) && tt.cardioTop != null && tt.bottom < tt.cardioTop,
          tt ? `bottom ${f1(tt.bottom)}, #cardioFab top ${f1(tt.cardioTop)}` : 'sem #toast', `bottom ${alvo} ± ${TOL} e < ${perfil === P17 ? 749 : 637}`);
        reg.medidas.toast = tt;
      }
      if (NIVEL_B_POR_VISTA[vista]) {
        const sels = Object.fromEntries(NIVEL_B_POR_VISTA[vista].map(k => [k, NIVEL_B[k]]));
        const nb = await page.evaluate(testarNivelB, { sels, zonaMin: ZONA_MIN, ladoMin: LADO_MIN });
        reg.medidas['nivelB-' + vista] = nb;
        for (const [k, r] of Object.entries(nb)) chkNivelB(`S6.3.${t}.${vista}.B.${k}`, `nível B ${NIVEL_B[k]}`, r);
        // Zonas entre botões do mesmo cartão: nenhum par sobreposto
        const pz = await page.evaluate(paresZonas, { tol: TOL });
        reg.medidas['pares-' + vista] = pz;
        chk(`S6.3.${t}.${vista}.B.pares`, `zonas de toque sem sobreposição entre interativos do mesmo cartão em ${vista}`, pz.cartoes > 0 && pz.nPares === 0,
          `${pz.cartoes} cartões, ${pz.nInter} interativos, ${pz.nPares} pares sobrepostos${pz.nPares ? ' [' + pz.pares.join('; ') + ']' : ''}`, `≥1 cartão e 0 pares (interseção > ${TOL} px nos dois eixos)`);
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
      }
    } catch (e) {
      chk(`S6.1.${t}.${vista}`, `vista ${vista} medida sem erro`, false, 'erro: ' + e.message.split('\n')[0], 'sem erro');
    }
  }

  // Diálogos Reagendar e Alertas
  for (const dlg of ['reagendar', 'alertas']) {
    try {
      if (dlg === 'reagendar') {
        await h.irPara(page, 'lista');
        await page.$eval('#viewContent .task-reschedule', b => b.click());
        await page.waitForSelector('#rescheduleDialog[open]', { timeout: 4000 });
      } else {
        await h.irPara(page, 'menu');
        await page.$eval('#alertsBtn', b => b.click());
        await page.waitForSelector('#alertsDialog[open]', { timeout: 4000 });
      }
      await page.waitForTimeout(500);
      const c = await page.evaluate(coletarPagina, { ins, rolagem: ROLAGEM_INTENCIONAL });
      chk(`S6.1.${t}.${dlg}`, `sem rolagem lateral com o diálogo ${dlg} aberto`, c.sw === perfil.width, `scrollWidth ${c.sw}`, `${perfil.width}`);
      chkBruto(`S6.1.${t}.${dlg}.bruto`, `com o diálogo ${dlg} aberto`, c, perfil.width);
      const sels = dlg === 'reagendar' ? [['.reschedule-preset', 3], ['#rescheduleForm .secondary', 1], ['#rescheduleForm .primary', 1]] : [['#activateAlerts', 1], ['#exportCalendar', 1], ['#closeAlertsDialog', 1]];
      const rects = await page.evaluate(retangulos, sels.map(x => x[0]));
      reg.medidas['alvos-' + dlg] = rects;
      // A especificação fala em ".reschedule-preset ×3": confere os três primeiros e informa o total.
      if (dlg === 'reagendar' && rects['.reschedule-preset'].length > 3) { nota(`${t} reagendar: ${rects['.reschedule-preset'].length} presets; conferidos os 3 primeiros`); rects['.reschedule-preset'] = rects['.reschedule-preset'].slice(0, 3); }
      const f = checarAlvosA(`S6.3.${t}.${dlg}`, rects, sels);
      reg.alvosFalhos.push(...f.map(s => dlg + ':' + s));
      if (dlg === 'reagendar') {
        const m = await page.evaluate(() => ({ d: document.getElementById('rescheduleDialog').getBoundingClientRect().width, n: document.querySelector('#rescheduleDialog .reschedule-task-name').getBoundingClientRect().width }));
        m4('rescheduleDialog', m.d, 'largura do #rescheduleDialog');
        m4('rescheduleTaskName', m.n, 'largura do .reschedule-task-name');
      } else {
        const w = await page.evaluate(() => document.getElementById('alertsDialog').getBoundingClientRect().width);
        m4('alertsDialog', w, 'largura do #alertsDialog');
      }
      await capturar(page, `${perfil.nome}-${dlg}`);
      await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
    } catch (e) {
      chk(`S6.1.${t}.${dlg}`, `diálogo ${dlg} medido sem erro`, false, 'erro: ' + e.message.split('\n')[0], 'sem erro');
    }
  }

  // S6.2 — folgas dos quatro fixos (menor valor entre as vistas em que aparecem)
  for (const [id, min] of [['app-update', 10], ['jarvis-btn', 12], ['openDialog', 62], ['cardioFab', 125]]) {
    const fs_ = (reg.folgas || {})[id] || [];
    const menor = fs_.length ? Math.min(...fs_.map(x => x.folga)) : null;
    chk(`S6.2.${t}.folga.${id}`, `folga do #${id} até a faixa do indicador (H − insetB − bottom)`, menor != null && menor >= min - EPS,
      menor != null ? `${f1(menor)} (em ${fs_.length} vistas: ${[...new Set(fs_.map(x => x.folga))].join('/')})` : 'não visível', `≥ ${min}`);
  }

  reg.erros = page.__erros.slice();
  await context.close();
}

// ---------------------------------------------------------------------------------------------
// Etapa: paisagem (seção 6, item 10)

async function etapaPaisagem(browser, acum) {
  const perfil = PAISAGEM, ins = perfil.insets;
  const reg = acum[perfil.nome] = { vistas: {}, erros: [] };
  const { context, page } = await abrir(browser, perfil);
  for (const vista of ['mes', 'lista', 'jarvis', 'nova-tarefa']) {
    try {
      await h.irPara(page, vista);
      const c = await page.evaluate(coletarPagina, { ins, rolagem: ROLAGEM_INTENCIONAL });
      const fora = c.itens.filter(x => x.naTela && x.fixo && (x.cL < ins.left - 0.5 || x.cR > perfil.width - ins.right + 0.5));
      reg.vistas[vista] = { sw: c.sw, fora, nFora: c.nFora };
      if (vista !== 'nova-tarefa') { // a especificação pede sw e lados em mes, lista e jarvis
        chk(`S6.10.paisagem.${vista}.sw`, `paisagem ${vista}: scrollWidth ≤ 956`, c.sw <= perfil.width, `scrollWidth ${c.sw}`, '≤ 956');
        chk(`S6.10.paisagem.${vista}.lados`, `paisagem ${vista}: nenhum fixo interativo com left < 62 ou right > 894`, fora.length === 0,
          fora.length ? fora.slice(0, 6).map(x => `${x.sel} ${f1(x.cL)}..${f1(x.cR)}`).join(', ') : `${c.itens.filter(x => x.naTela && x.fixo).length} fixos, todos em [62, 894]`, 'left ≥ 62 e right ≤ 894');
      }
      chkBruto(`S6.10.paisagem.${vista}.bruto`, `na paisagem, ${vista} (extra)`, c, perfil.width);
      if (vista === 'nova-tarefa') {
        const d = await page.evaluate(() => { const e = document.getElementById('taskDialog'); if (!e || !e.open) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, w: r.width, h: r.height }; });
        reg.taskDialog = d;
        chk('S6.10.paisagem.nova-tarefa.dialogo', 'paisagem: #taskDialog com top ≥ 20 e bottom ≤ 420', !!d && d.top >= ins.top - EPS && d.bottom <= perfil.height - ins.bottom + EPS,
          d ? `top ${f1(d.top)}, bottom ${f1(d.bottom)} (${f1(d.w)}×${f1(d.h)})` : 'diálogo não abriu', 'top ≥ 20 e bottom ≤ 420');
      }
      if (vista === 'jarvis') {
        const p = await page.evaluate(() => { const e = document.querySelector('#jarvis-panel.open'); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height }; });
        reg.painel = p;
        chk('S6.10.paisagem.jarvis.painel', 'paisagem: #jarvis-panel.open com top ≥ 20 e bottom ≤ 420', p && p.top >= 20 - EPS && p.bottom <= 420 + EPS,
          p ? `top ${f1(p.top)}, bottom ${f1(p.bottom)} (altura ${f1(p.h)})` : 'painel não abriu', 'top ≥ 20 e bottom ≤ 420');
        // Critério da rodada 2 (S6.10 emendado): microfone, campo e enviar inteiros dentro do painel (overflow:hidden),
        // nos quatro lados, com a tolerância de 0,5 px.
        const e = await page.evaluate(() => {
          const p = document.querySelector('#jarvis-panel.open'); if (!p) return null;
          const pr = p.getBoundingClientRect();
          return { painel: { top: pr.top, bottom: pr.bottom, left: pr.left, right: pr.right }, itens: ['jarvis-mic', 'jarvis-input', 'jarvis-send'].map(id => { const el = document.getElementById(id); const r = el ? el.getBoundingClientRect() : null; return { id, top: r ? r.top : null, bottom: r ? r.bottom : null, left: r ? r.left : null, right: r ? r.right : null }; }) };
        });
        reg.entrada = e;
        const P = e && e.painel;
        const cortados = e ? e.itens.filter(x => x.top == null || x.top < P.top - TOL || x.bottom > P.bottom + TOL || x.left < P.left - TOL || x.right > P.right + TOL) : [];
        const escondido = x => Math.max(0, x.bottom - P.bottom, P.top - x.top, x.right - P.right, P.left - x.left);
        chk('S6.10.paisagem.jarvis.entrada', 'paisagem: microfone, campo e enviar do Jarvis inteiros dentro do painel', !!e && cortados.length === 0,
          e ? `painel ${f1(P.top)}..${f1(P.bottom)} × ${f1(P.left)}..${f1(P.right)}; ${e.itens.map(x => `#${x.id} ${f1(x.top)}..${f1(x.bottom)} × ${f1(x.left)}..${f1(x.right)}`).join(', ')}${cortados.length ? `; cortados ${cortados.length} (${f1(Math.max(...cortados.map(escondido)))} px escondidos)` : ''}` : 'painel não abriu',
          'os três inteiros dentro do painel (± 0,5)');
      }
      await capturar(page, `${perfil.nome}-${vista}`);
    } catch (e) {
      chk(`S6.10.paisagem.${vista}.sw`, `paisagem ${vista} medida sem erro`, false, 'erro: ' + e.message.split('\n')[0], 'sem erro');
    }
  }
  reg.erros = page.__erros.slice();
  await context.close();
}

// ---------------------------------------------------------------------------------------------
// Etapa: páginas auxiliares (seção 6, itens 6 e 7; plano, critério 6), perfil 17 Pro Max

const AUX = [
  { nome: 'financeiro', caminho: 'financeiro.html', veu: 'body' },
  { nome: 'marketplace', caminho: 'marketplace/', veu: 'body' },
  { nome: 'gamificacao', caminho: 'gamificacao.html', veu: 'body' },
  { nome: 'equipamentos-especiais', caminho: 'equipamentos-especiais.html', veu: 'rgb(16, 16, 23)' },
  { nome: 'treino', caminho: 'treino.html?date=TREINO', viaApp: true, veu: null },
  { nome: 'carteira', caminho: 'carteira.html', veu: 'body' },
  { nome: 'extrato-saldo', caminho: 'extrato-saldo.html?mes=MES', veu: 'body' },
  { nome: 'investimentos', caminho: 'investimentos.html', veu: 'body' },
  { nome: 'fatura-inter', caminho: 'fatura-inter.html', veu: 'body' },
  { nome: 'refaturamento', caminho: 'refaturamento.html', veu: 'body' },
  { nome: 'financeiro-compartilhado', caminho: 'financeiro-compartilhado.html', compartilhado: true, veu: 'body' },
  { nome: 'importar', caminho: 'importar.html', veu: 'body' },
];
// Alvos por página: [seletor, regra, quantidade esperada (null = ≥1)]; regra: 'h44', 'a44' (w e h ≥ 44), 'b' (nível B)
const ALVOS_AUX = {
  financeiro: [['.filters button', 'h44', 6], ['.sa-foot button', 'b', null], ['.iv-foot button', 'b', null], ['#pluxeeEdit', 'b', 1]],
  investimentos: [['.savebtn', 'h44', null], ['.editbtn', 'b', null]],
  'fatura-inter': [['.tabs button', 'h44', 2]],
  refaturamento: [['.sim-toggle', 'h44', null]],
  marketplace: [['#cofre label', 'h44', null]],
  'equipamentos-especiais': [['.chip', 'h44', 13], ['.appswitch a', 'h44', null], ['.quickbar button', 'h44', null], ['.buscabar input', 'h44', null], ['#cidadeFiltro', 'h44', 1], ['#app-update', 'a44', 1]],
  treino: [['.tr-preset', 'a44', null], ['.tr-tbtn', 'a44', null], ['#trHome', 'h44', 1], ['.tr-inputs input', 'h44', null]],
};
const STUB_SUPABASE = `export function createClient(){
  const hoje=new Date(),k=hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0');
  const snap={accounts:{mp:1234.56,nb:789.1,upd:k+'-10'},investments:{energisaPrev:{saldo:15432.1,aporteMensal:500}},
    summary:{currentInvoice:'R$ 2.345,67',currentInvoiceDetail:'Fecha dia 3 do próximo mês'},
    refaturamentos:[{date:k+'-05',description:'Compra parcelada devolvida na loja de eletrodomésticos do centro',status:'parcial',grossCents:123456,feeCents:1234,interCents:-50000,mpCents:48766,refundedFeeCents:1234}],
    tasks:[{id:'f1',text:'Mercado do mês com a lista grande de compras da casa',date:k+'-05',time:'10:00'},{id:'f2',text:'Salário',date:k+'-01'},{id:'f3',text:'Farmácia',date:k+'-08',time:'18:30'}],
    notes:{f1:{valor:'-450,90',forma:'pix'},f2:{valor:'5000',movimento:'entrada'},f3:{valor:'-89,90',forma:'crédito'}},generatedAt:Date.now()};
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{payload:[{id:'__shared_finance_snapshot_v2__',financeSnapshot:snap}]},error:null})};
  return {auth:{getUser:async()=>({data:{user:{id:'3f5bc48d-1c0d-4bc1-9437-0f62814d2f6b'}}})},from:()=>q};
}`;

async function etapaAux(browser, acum) {
  const perfil = P17, ins = perfil.insets;
  const pad = n => String(n).padStart(2, '0'), d = new Date();
  const HOJE = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, MES = HOJE.slice(0, 7);
  for (const a of AUX) {
    const reg = acum[a.nome] = {};
    let aberto = null;
    try {
      let caminho = a.caminho.replace('MES', MES);
      if (a.viaApp) {
        // treino.html só desenha com uma tarefa treino-<data> criada pelo treino.js no app (como na auditoria).
        aberto = await abrir(browser, perfil);
        const dt = await aberto.page.evaluate(hoje => {
          const ids = JSON.parse(localStorage.getItem('agenda_lagares_v3') || '[]').map(t => String(t.id)).filter(i => /^treino-\d{4}-\d{2}-\d{2}$/.test(i)).map(i => i.slice(7)).sort();
          return ids.find(x => x >= hoje) || ids[ids.length - 1] || hoje;
        }, HOJE);
        caminho = caminho.replace('TREINO', dt);
        await aberto.page.goto(BASE + caminho, { waitUntil: 'load' });
        await aberto.page.waitForTimeout(1200);
      } else if (a.compartilhado) {
        // Só abre para a usuária com acesso compartilhado; sem ela a página volta ao financeiro.
        // Aqui: config com workspaceOwnerId da Ana e cliente Supabase simulado (nenhum acesso à rede).
        aberto = await abrir(browser, perfil, { caminho: 'carteira.html' });
        await aberto.context.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm', r => r.fulfill({ contentType: 'application/javascript', body: STUB_SUPABASE }));
        await aberto.page.evaluate(() => localStorage.setItem('agenda_supabase_config_v1', JSON.stringify({ workspaceOwnerId: '3f5bc48d-1c0d-4bc1-9437-0f62814d2f6b' })));
        await aberto.page.goto(BASE + caminho, { waitUntil: 'load' });
        await aberto.page.waitForTimeout(1500);
      } else {
        aberto = await abrir(browser, perfil, { caminho });
      }
      const { page } = aberto;
      const url = page.url().replace(BASE, '');
      reg.url = url;
      const ehPaginaCerta = url.split('?')[0].replace(/index\.html$/, '') === a.caminho.split('?')[0];
      const topo = await page.evaluate(topoConteudo);
      const c = await page.evaluate(coletarPagina, { ins, rolagem: ROLAGEM_INTENCIONAL });
      let hm = null;
      try { hm = await h.medir(page, perfil, 'aux-' + a.nome); } catch (_) {}
      const si = sobIlha(c, ins), fi = fixosSobIndicador(c, ins);
      Object.assign(reg, { sw: c.sw, topo, ilha: si.length, ind: fi.length, nTransb: c.nTransb, erros: page.__erros.slice() });
      const pfx = `S6.6.${a.nome}`;
      chk(`${pfx}.pagina`, `${a.nome}: abriu a própria página`, ehPaginaCerta, url, a.caminho.replace('MES', MES));
      chk(`${pfx}.sw`, `${a.nome}: scrollWidth == 440`, c.sw === perfil.width, `scrollWidth ${c.sw}${c.nTransb ? ', transbordando ' + c.nTransb + ' [' + c.transb.slice(0, 3).join('; ') + ']' : ''}`, '440');
      chkBruto(`${pfx}.bruto`, `em ${a.nome} (extra)`, c, perfil.width);
      chk(`${pfx}.cabecalho`, `${a.nome}: conteúdo do topo fora da ilha (≥ 62)`, topo.top != null && topo.top >= ins.top - 0.5,
        `primeiro conteúdo em ${f1(topo.top)} (${topo.quem}); cabeçalho ${topo.cabecalho ? topo.cabecalho.sel + ' ' + topo.cabecalho.top + '–' + topo.cabecalho.bottom : '—'}${hm && hm.cabecalho ? `; medir(): conteudoTop ${hm.cabecalho.conteudoTop}, sobIlha ${hm.cabecalho.sobIlha}` : ''}`, '≥ 62');
      chk(`${pfx}.ilha`, `${a.nome}: nenhum interativo sob a ilha`, si.length === 0, `${si.length}${si.length ? ': ' + lista(si) : ''}`, '0');
      chk(`${pfx}.indicador`, `${a.nome}: nenhum fixo interativo sob o indicador`, fi.length === 0, `${fi.length}${fi.length ? ': ' + lista(fi) : ''}`, '0');
      reg.p6 = { sw: c.sw, topo: topo.top, ok: c.sw <= perfil.width && topo.top != null && topo.top >= ins.top - 0.5, pagina: ehPaginaCerta };

      // Alvos específicos
      for (const [sel, regra, n] of (ALVOS_AUX[a.nome] || [])) {
        if (regra === 'b') {
          const nb = await page.evaluate(testarNivelB, { sels: { [sel]: sel }, zonaMin: ZONA_MIN, ladoMin: LADO_MIN });
          const r = nb[sel];
          (reg.nivelB = reg.nivelB || {})[sel] = r;
          if (n != null && r.n !== n) chk(`${pfx}.B.${sel.replace(/\s+/g, '')}`, `${a.nome}: nível B ${sel} (quantidade)`, false, `${r.n} elementos`, `${n}`);
          else chkNivelB(`${pfx}.B.${sel.replace(/\s+/g, '')}`, `${a.nome}: nível B ${sel}`, r);
        } else {
          const rs = (await page.evaluate(retangulos, [sel]))[sel];
          const okTam = rs.every(r => ge(r.h, 44) && (regra === 'h44' || ge(r.w, 44)));
          const okQtd = n == null ? rs.length >= 1 : rs.length === n;
          chk(`${pfx}.${sel.replace(/\s+/g, '')}`, `${a.nome}: ${sel} ${regra === 'h44' ? 'h ≥ 44' : '≥ 44×44'}`, okTam && okQtd,
            rs.length ? `${rs.length}× ${[...new Set(rs.map(r => f1(r.w) + '×' + f1(r.h)))].slice(0, 5).join(' / ')}` : 'ausente', `${n == null ? '≥1' : n}× ${regra === 'h44' ? 'h ≥ 44' : 'w ≥ 44 e h ≥ 44'}`);
          if (sel === '#app-update' && rs.length) {
            const fol = Math.round((page.viewportSize().height - ins.bottom - rs[0].B) * 10) / 10;
            chk(`${pfx}.app-update.folga`, `${a.nome}: folga do #app-update até a faixa do indicador`, fol >= 10 - EPS, f1(fol), '≥ 10');
          }
        }
      }
      if (a.nome === 'marketplace') {
        const m = await page.evaluate(() => { const c = document.getElementById('cofreLembrar'); const r = c && c.getBoundingClientRect(); return r ? { w: r.width, h: r.height } : null; });
        chk(`${pfx}.cofreLembrar`, 'marketplace: #cofreLembrar 22×22 (tela de senha)', m && perto(m.w, 22) && perto(m.h, 22), m ? `${f1(m.w)}×${f1(m.h)}` : 'ausente', `22×22 ± ${TOL}`);
        const v = await page.evaluate(async () => {
          document.documentElement.classList.remove('trancado');
          await new Promise(r => setTimeout(r, 400));
          const bs = [...document.querySelectorAll('.views button')].filter(e => e.getBoundingClientRect().width > 0).map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; });
          const barra = document.querySelector('.barra');
          return { bs, barraTop: barra ? getComputedStyle(barra).top : null, barraPos: barra ? getComputedStyle(barra).position : null };
        });
        reg.destrancado = v;
        chk(`${pfx}.views-button`, 'marketplace (sem .trancado): .views button h ≥ 44', v.bs.length > 0 && v.bs.every(b => ge(b[1], 44)),
          v.bs.length ? `${v.bs.length}× ${[...new Set(v.bs.map(b => b.join('×')))].join(' / ')}` : 'ausente', '≥1, h ≥ 44');
        chk(`${pfx}.barra`, "marketplace: .barra getComputedStyle().top == '62px'", v.barraTop === '62px', `top ${v.barraTop} (position ${v.barraPos})`, '62px');
        await page.evaluate(() => document.documentElement.classList.add('trancado'));
        await page.waitForTimeout(300);
      }

      // S6.7 — véu nas 11 auxiliares
      if (a.veu) {
        const v = await page.evaluate(estiloVeu);
        reg.veu = v;
        const corOk = a.veu === 'body' ? v.bg === v.bodyBg : v.bg === a.veu;
        chk(`S6.7.aux.${a.nome}`, `${a.nome}: véu body::before (fixed, 62px, z 60, cor ${a.veu === 'body' ? 'do body' : a.veu})`,
          v.position === 'fixed' && v.height === ins.top + 'px' && v.zIndex === '60' && v.content === '""' && corOk,
          `position ${v.position}, height ${v.height}, z ${v.zIndex}, content ${v.content}, bg ${v.bg} / body ${v.bodyBg}`, `fixed, 62px, 60, "", ${a.veu === 'body' ? 'bg = body' : a.veu}`);
      }
      await capturar(page, `${perfil.nome}-aux-${a.nome}`);
    } catch (e) {
      chk(`S6.6.${a.nome}.pagina`, `${a.nome}: medida sem erro`, false, 'erro: ' + e.message.split('\n')[0], 'sem erro');
      reg.p6 = { ok: false, erro: e.message };
    }
    if (aberto) await aberto.context.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Etapa: S6.8 — versões e trechos (texto dos arquivos)

const TRECHOS = [
  // index.html, linha 21 (seção 3.13, itens 1–13)
  ['index.html', '.view-tab{min-height:37px;', '.view-tab{min-height:44px;'],
  ['index.html', '.chip{flex:0 0 auto;padding:8px 13px;', '.chip{flex:0 0 auto;min-height:44px;padding:0 13px;'],
  ['index.html', '.nav-btn{display:grid;place-items:center;width:35px;height:35px;', '.nav-btn{display:grid;place-items:center;width:44px;height:44px;'],
  ['index.html', '.toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 13px;', '.toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 13px;'],
  ['index.html', '.day-pick .day-pick-input{position:absolute;inset:0;width:100%;height:100%;', '.day-pick .day-pick-input{position:absolute;inset:-4px 0;width:100%;height:auto;'],
  ['index.html', '.task-card{display:grid;grid-template-columns:25px minmax(0,1fr) 32px;gap:10px;', '.task-card{display:grid;grid-template-columns:34px minmax(0,1fr) 34px;gap:6px;'],
  ['index.html', '.check{appearance:none;width:23px;height:23px;display:grid;place-items:center;margin:0;border:1.5px solid var(--faint);border-radius:8px;background:transparent;color:var(--accentInk);font-size:14px;font-weight:900}.check:checked{border-color:var(--accent);background:var(--accent)}.check:checked::after{content:"✓"}',
    '.check{appearance:none;position:relative;width:44px;height:44px;display:grid;place-items:center;margin:-10px -5px;border:0;background:transparent;color:var(--accentInk);font-size:14px;font-weight:900}.check::before{content:"";grid-area:1/1;width:23px;height:23px;box-sizing:border-box;border:1.5px solid var(--faint);border-radius:8px;background:transparent}.check:checked::before{border-color:var(--accent);background:var(--accent)}.check:checked::after{content:"✓";grid-area:1/1}'],
  ['index.html', '.clear-done{padding:4px 0;border:0;', '.clear-done{min-height:44px;padding:0 4px;margin:-10px -4px;border:0;'],
  ['index.html', 'color:var(--text);font-size:8.5px;font-weight:800;line-height:1.1;white-space:nowrap;text-overflow:ellipsis}', 'color:var(--text);font-size:9px;font-weight:800;line-height:1.1;white-space:nowrap;text-overflow:ellipsis}'],
  // emenda (R3, decisão do coordenador): max-height do dialog desconta os insets; o new da 3.13 vira old.
  ['index.html', ['dialog{width:min(calc(100% - 32px),480px);max-height:calc(100dvh - 32px);', 'max-width:calc(100% - 32px);max-height:calc(100dvh - 32px);'],
    'dialog{width:min(calc(100% - 32px),480px);max-width:calc(100% - 32px);max-height:calc(100dvh - 32px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));'],
  ['index.html', '.secondary,.primary{padding:11px 15px;border-radius:13px;', '.secondary,.primary{min-height:44px;padding:10px 16px;border-radius:13px;'],
  ['index.html', '.toast{position:fixed;z-index:20;left:50%;bottom:calc(93px + env(safe-area-inset-bottom));', '.toast{position:fixed;z-index:20;left:50%;bottom:calc(184px + env(safe-area-inset-bottom));'],
  ['index.html', null, 'body::before{content:"";position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);z-index:60;background:var(--bg)}#jarvis-locbar{min-height:44px!important;padding-top:0!important;padding-bottom:0!important}#equipamentosBtn::after,#atualizarBtn::after{content:attr(aria-label)}#equipamentosBtn svg,#atualizarBtn svg{width:20px;height:20px;margin:0 2px}'],
  // index.html, outras linhas (itens 14–28)
  ['index.html', '.month-toolbar{display:grid;grid-template-columns:35px minmax(0,1fr) 35px}', '.month-toolbar{display:grid;grid-template-columns:44px minmax(0,1fr) 44px}'],
  ['index.html', '.month-toolbar-spacer{width:35px;height:35px}', '.month-toolbar-spacer{width:44px;height:44px}'],
  ['index.html', '.app{padding-bottom:calc(180px + env(safe-area-inset-bottom))}', '.app{padding-bottom:calc(196px + env(safe-area-inset-bottom))}'],
  ['index.html', 'bottom:calc(46px + env(safe-area-inset-bottom));display:flex;flex-direction:column', 'bottom:calc(62px + env(safe-area-inset-bottom));display:flex;flex-direction:column'],
  ['index.html', '.task-reschedule{display:grid;place-items:center;width:31px;height:31px;padding:0;', '.task-reschedule{display:grid;place-items:center;width:44px;height:44px;margin:-6px -5px -7px;padding:0;'],
  ['index.html', '.list-previous{display:inline-flex;align-items:center;margin-top:5px;padding:0;border:0;background:transparent;color:var(--accent);font-size:11px;font-weight:800}',
    '.list-previous{position:relative;display:inline-flex;align-items:center;min-height:28px;margin-top:5px;padding:0;border:0;background:transparent;color:var(--accent);font-size:11px;font-weight:800}.list-previous::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}'],
  ['index.html', '.list-more{display:flex;margin:16px auto 10px;padding:10px 18px;', '.list-more{display:flex;align-items:center;min-height:44px;margin:16px auto 10px;padding:0 20px;'],
  ['index.html', '#rescheduleDialog{width:min(calc(100% - 40px),370px);overflow:visible;', '#rescheduleDialog{width:min(calc(100% - 32px),400px);max-width:calc(100% - 32px);overflow:visible;'],
  ['index.html', null, '.reschedule-head{display:flex;align-items:center;gap:12px}.reschedule-head>div{flex:1;min-width:0}'],
  ['index.html', '.reschedule-task-name{margin:3px 0 0!important;max-width:245px;', '.reschedule-task-name{margin:3px 0 0!important;max-width:100%;'],
  ['index.html', '.reschedule-preset{min-height:38px;', '.reschedule-preset{min-height:44px;'],
  ['index.html', '.field-check{display:flex;align-items:center;gap:9px;margin-top:8px;', '.field-check{display:flex;align-items:center;gap:9px;min-height:44px;margin-top:4px;'],
  // emenda (R2, decisão do coordenador): painel do Jarvis limitado pelos insets e #jarvis-msgs que encolhe.
  ['index.html', ['bottom:calc(90px + env(safe-area-inset-bottom));max-width:420px;max-height:72dvh;', 'bottom:calc(90px + env(safe-area-inset-bottom));max-height:72dvh;'],
    'bottom:calc(90px + env(safe-area-inset-bottom));max-height:min(72dvh,calc(100dvh - 90px - env(safe-area-inset-bottom,0px) - env(safe-area-inset-top,0px)));'],
  ['index.html', 'gap:10px;min-height:120px}', 'gap:10px;min-height:min(120px,15dvh)}'],
  // emenda (ponto de projeto P2): rodapé do cartão com gap 6 e 16 px entre linhas só nos cartões com .tr-open.
  ['index.html', '.task-footer{display:flex;flex-wrap:wrap;align-items:center;gap:16px 6px;margin-top:6px}',
    '.task-footer{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px}.task-footer:has(.tr-open){row-gap:16px}'],
  ['index.html', '#jarvis-header{display:flex;align-items:center;gap:10px;padding:14px 16px 12px;', '#jarvis-header{display:flex;align-items:center;gap:8px;padding:10px 16px 8px;'],
  ['index.html', '.jarvis-hbtn{width:30px;height:30px;border:0;border-radius:9px;', '.jarvis-hbtn{width:44px;height:44px;border:0;border-radius:12px;'],
  ['index.html', '#jarvis-mic{width:40px;height:40px;', '#jarvis-mic{width:44px;height:44px;'],
  ['index.html', '#jarvis-input{flex:1;min-height:40px;', '#jarvis-input{flex:1;min-height:44px;'],
  ['index.html', '#jarvis-send{width:40px;height:40px;', '#jarvis-send{width:44px;height:44px;'],
  ['index.html', 'font-weight:700;padding:7px 13px;border-radius:99px;cursor:pointer}', 'font-weight:700;min-height:44px;padding:0 13px;border-radius:99px;cursor:pointer}'],
  ['index.html', 'bottom:calc(6px + env(safe-area-inset-bottom));z-index:99;', 'bottom:calc(10px + env(safe-area-inset-bottom));z-index:99;'],
  ['index.html', 'justify-content:center;width:34px;height:34px;padding:0;', 'justify-content:center;width:44px;height:44px;padding:0;'],
  // item 29 e item 8 da seção 6 (versões). Emenda da rodada 2: notas v11, agenda-sharing v6, treino v14 (index e
  // treino.html); as versões intermediárias também têm de ter sumido.
  ['index.html', ['treino.js?v=12', 'treino.js?v=13'], 'treino.js?v=14'],
  ['index.html', ['notas.js?v=9', 'notas.js?v=10'], 'notas.js?v=11'],
  ['index.html', ['agenda-sharing.js?v=4', 'agenda-sharing.js?v=5'], 'agenda-sharing.js?v=6'],
  ['index.html', 'sequencial.js?v=3', 'sequencial.js?v=4'],
  ['index.html', 'vozes-neurais.js?v=1', 'vozes-neurais.js?v=2'],
  ['treino.html', ['treino.js?v=10', 'treino.js?v=13'], 'treino.js?v=14'],
  // scripts do app. Emenda (R1, contrato do nível B = −(8 px + borda)): pílulas com borda de 1 px usam −9px.
  ['notas.js', '.notas-toggle{margin-left:auto;display:inline-flex;', '.notas-toggle{position:relative;margin-left:auto;display:inline-flex;min-height:28px;'],
  ['notas.js', '.notas-toggle::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}', '.notas-toggle::before{content:"";position:absolute;left:0;right:0;top:-9px;bottom:-9px}'],
  ['agenda-sharing.js', '.agenda-share{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;', '.agenda-share{position:relative;display:inline-flex;align-items:center;gap:4px;min-height:28px;padding:3px 7px;'],
  ['agenda-sharing.js', '.agenda-share::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}', '.agenda-share::before{content:"";position:absolute;left:0;right:0;top:-9px;bottom:-9px}'],
  ['sequencial.js', 'margin:0 0 14px;padding:11px 14px;', 'margin:0 0 14px;min-height:44px;padding:0 14px;'],
  ['treino.js', '.tr-open{margin-left:auto;display:inline-flex;align-items:center;gap:5px;padding:4px 11px;', '.tr-open{position:relative;margin-left:auto;display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:4px 11px;'],
  ['treino.js', '.tr-open::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}', '.tr-open::before{content:"";position:absolute;left:0;right:0;top:-9px;bottom:-9px}'],
  ['treino.js', '.tr-close{position:absolute;top:14px;right:14px;width:34px;height:34px;', '.tr-close{position:absolute;top:14px;right:14px;width:44px;height:44px;'],
  ['treino.js', 'gap:6px;min-height:36px;padding:0 12px;', 'gap:6px;min-height:44px;padding:0 12px;'],
  ['treino.js', '.tr-preset{padding:5px 10px;', '.tr-preset{min-height:44px;min-width:44px;padding:0 10px;'],
  ['treino.js', '.tr-tbtn{width:42px;height:42px;', '.tr-tbtn{width:44px;height:44px;'],
  ['treino.js', '.tr-inputs input{width:100%;min-height:42px;', '.tr-inputs input{width:100%;min-height:44px;'],
  ['vozes-neurais.js', '#voz-dialog{width:min(420px,calc(100vw - 24px));max-height:86dvh;', '#voz-dialog{width:min(420px,calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:86dvh;'],
  ['vozes-neurais.js', '#voz-dialog .vz-x{width:30px;height:30px;border:0;border-radius:9px;', '#voz-dialog .vz-x{width:44px;height:44px;border:0;border-radius:12px;'],
  ['vozes-neurais.js', 'font-size:12px;font-weight:700;padding:7px 11px;border-radius:99px;cursor:pointer}', 'font-size:12px;font-weight:700;min-height:44px;padding:0 12px;border-radius:99px;cursor:pointer}'],
  // seção 4 — véu nas auxiliares
  ...[['financeiro.html', '#17181c'], ['carteira.html', '#17181c'], ['extrato-saldo.html', '#17181c'], ['investimentos.html', '#17181c'], ['fatura-inter.html', '#17181c'],
    ['refaturamento.html', 'var(--bg)'], ['financeiro-compartilhado.html', 'var(--bg)'], ['gamificacao.html', 'var(--bg)'], ['importar.html', '#0b1220'],
    ['marketplace/index.html', 'var(--bg)'], ['equipamentos-especiais.html', '#101017']]
    .map(([f, cor]) => [f, null, `body::before{content:"";position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);z-index:60;background:${cor}}`]),
  // 4.1 financeiro
  ['financeiro.html', '.filters button{padding:9px 11px;font-weight:800}', '.filters button{min-height:44px;padding:0 11px;font-weight:800}'],
  ['financeiro.html', '.sa-foot button{background:#2a2d35;', '.sa-foot button{position:relative;min-height:28px;background:#2a2d35;'],
  // emenda (R1): .sa-foot button tem borda de 1 px → −9px; .iv-foot button (sem borda) fica em −8px.
  ['financeiro.html', '.sa-foot button::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}', '.sa-foot button::before{content:"";position:absolute;left:0;right:0;top:-9px;bottom:-9px}'],
  ['financeiro.html', '.iv-foot button{background:rgba(255,255,255,.24);', '.iv-foot button{position:relative;min-height:28px;background:rgba(255,255,255,.24);'],
  ['financeiro.html', null, '.iv-foot button::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}'],
  // emenda (R4): #pluxeeEdit vira nível B (borda de 1 px → −9px).
  ['financeiro.html', null, '#pluxeeEdit{position:relative;min-height:28px}#pluxeeEdit::before{content:"";position:absolute;left:0;right:0;top:-9px;bottom:-9px}'],
  // 4.3 investimentos (emenda R1 no ::before do .editbtn, borda de 1 px)
  ['investimentos.html', '.editbtn{background:#2a2d35;', '.editbtn{position:relative;background:#2a2d35;'],
  ['investimentos.html', '.editbtn::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}', '.editbtn::before{content:"";position:absolute;left:0;right:0;top:-9px;bottom:-9px}'],
  ['investimentos.html', '.savebtn{width:100%;margin-top:14px;padding:13px;', '.savebtn{width:100%;min-height:44px;margin-top:14px;padding:13px;'],
  // 4.4 fatura-inter, 4.5 refaturamento
  ['fatura-inter.html', '.tabs button{padding:10px 8px;border:0;', '.tabs button{min-height:44px;padding:0 8px;border:0;'],
  ['refaturamento.html', '.sim-toggle{display:flex;align-items:center;gap:8px;min-height:42px;', '.sim-toggle{display:flex;align-items:center;gap:8px;min-height:44px;'],
  // 4.6 marketplace
  ['marketplace/index.html', '.barra{position:sticky;top:0;', '.barra{position:sticky;top:env(safe-area-inset-top,0px);'],
  ['marketplace/index.html', '#cats button{flex:1 0 auto;min-height:37px;', '#cats button{flex:1 0 auto;min-height:44px;'],
  ['marketplace/index.html', '.views button{flex:0 0 auto;padding:8px 13px;', '.views button{flex:0 0 auto;min-height:44px;padding:0 13px;'],
  // emenda da especificação (rodada 2, item 3): new do .x é o trecho longo; no #cofre label, só grep -c new == 1.
  ['marketplace/index.html', 'width:38px;height:38px;', '.x{float:right;display:grid;place-items:center;width:44px;height:44px;'],
  ['marketplace/index.html', null, '#cofre label{display:flex;gap:8px;align-items:center;min-height:44px;'],
  ['marketplace/index.html', null, '#cofre label input{width:22px;height:22px;margin:0}'],
  // 4.7 equipamentos-especiais
  ['equipamentos-especiais.html', 'border-radius:100px;padding:7px 14px;', 'border-radius:100px;min-height:44px;padding:0 14px;'],
  ['equipamentos-especiais.html', '.appswitch a{flex:1;text-align:center;padding:10px 6px;', '.appswitch a{flex:1;display:grid;place-items:center;min-height:44px;padding:0 6px;'],
  ['equipamentos-especiais.html', 'border-radius:13px;padding:12px 8px;', 'border-radius:13px;min-height:44px;padding:0 8px;'],
  ['equipamentos-especiais.html', '.buscabar input{width:100%;padding:11px 14px;', '.buscabar input{width:100%;min-height:44px;padding:11px 14px;'],
  ['equipamentos-especiais.html', '.buscabar select{width:100%;margin-top:7px;padding:10px 12px;', '.buscabar select{width:100%;min-height:44px;margin-top:7px;padding:10px 12px;'],
  ['equipamentos-especiais.html', 'bottom:calc(6px + env(safe-area-inset-bottom))', 'bottom:calc(10px + env(safe-area-inset-bottom))'],
  ['equipamentos-especiais.html', 'width:34px;height:34px;', 'width:44px;height:44px;'],
  // emenda (R4): botões da .toolbar e da .catbar com 44 de altura
  ['equipamentos-especiais.html', '.toolbar button{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);color:#fff;padding:9px 12px;',
    '.toolbar button{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);color:#fff;min-height:44px;padding:9px 12px;'],
  ['equipamentos-especiais.html', '.catbar button{flex:1;min-width:132px;border:none;border-radius:10px;padding:11px 8px;',
    '.catbar button{flex:1;min-width:132px;min-height:44px;border:none;border-radius:10px;padding:11px 8px;'],
];

function etapaTextos() {
  const cache = {};
  const ler = f => (cache[f] = cache[f] ?? fs.readFileSync(path.join(REPO, f), 'utf8'));
  const linhasCom = (txt, s) => txt.split('\n').filter(l => l.includes(s)).length; // = grep -cF
  // versões (seção 6 item 8, primeira frase; emenda da rodada 2): TODAS as referências ao script no arquivo têm a
  // versão esperada (e há pelo menos uma).
  const versoes = [['index.html', 'treino.js', 14], ['index.html', 'notas.js', 11], ['index.html', 'agenda-sharing.js', 6], ['index.html', 'sequencial.js', 4], ['index.html', 'vozes-neurais.js', 2], ['treino.html', 'treino.js', 14]];
  const achadas = versoes.map(([f, s, v]) => {
    const re = new RegExp('(?<![\\w.-])' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?v=(\\d+)', 'g');
    const vs = [...ler(f).matchAll(re)].map(m => +m[1]);
    return { f, s, v, vs, ok: vs.length >= 1 && vs.every(x => x === v) };
  });
  chk('S6.8.versoes', 'index.html e treino.html carregam as versões esperadas dos scripts (e nenhuma outra)', achadas.every(x => x.ok),
    achadas.map(x => `${x.f}: ${x.s}?v=${x.vs.length ? x.vs.join('/') : 'ausente'}`).join(', '),
    achadas.map(x => `${x.s}?v=${x.v}`).join(', '));
  const porArq = new Map();
  for (const [f, old, novo] of TRECHOS) {
    if (!porArq.has(f)) porArq.set(f, []);
    const txt = ler(f);
    const olds = old == null ? [] : Array.isArray(old) ? old : [old];
    const nOlds = olds.map(o => linhasCom(txt, o));
    const nOld = nOlds.reduce((s, n) => s + n, 0), nNew = linhasCom(txt, novo);
    // "intenção": o old não aparece fora de uma ocorrência do new, e o new aparece (para trechos genéricos ou old ⊂ new)
    const nOldFora = olds.reduce((s, o) => s + txt.split('\n').filter(l => l.split(novo).join('\u0000').includes(o)).length, 0);
    porArq.get(f).push({ old: olds.length ? olds.map((o, i) => `${o.slice(0, 36)}${o.length > 36 ? '…' : ''}" → ${nOlds[i]}`).join(' | old "') : null, olds, novo, nOld, nNew, nOldFora, oldDentroDoNew: olds.some(o => novo.includes(o)), ok: nOld === 0 && nNew === 1 });
  }
  bruto.textos = Object.fromEntries([...porArq].map(([f, arr]) => [f, arr.map(x => ({ olds: x.olds, novo: x.novo, nOld: x.nOld, nNew: x.nNew }))]));
  for (const [f, arr] of porArq) {
    const ruins = arr.filter(x => !x.ok);
    chk(`S6.8.${f}`, `${f}: grep -c de cada old = 0 e de cada new = 1`, ruins.length === 0,
      `${arr.length - ruins.length}/${arr.length} trechos ok${ruins.length ? ' [' + ruins.map(x => `new "${x.novo.slice(0, 48)}${x.novo.length > 48 ? '…' : ''}" → ${x.nNew}${x.old ? `, old "${x.old}` : ''}`).join('; ') + ']' : ''}`,
      `${arr.length}/${arr.length} (old 0, new 1)`);
    if (ruins.length) {
      // Conferência da intenção da mudança, só informativa sobre o porquê do FALHOU literal acima.
      const ruinsInt = ruins.filter(x => !(x.nOldFora === 0 && x.nNew >= 1));
      chk(`S6.8.${f}.intencao`, `${f}: nos trechos que falharam no grep literal, o old só existe dentro do new e o new está presente`, ruinsInt.length === 0,
        ruins.map(x => `"${x.novo.slice(0, 40)}": new em ${x.nNew} linha(s)${x.old ? `, old fora do new em ${x.nOldFora}${x.oldDentroDoNew ? ' (old é trecho do new)' : ''}` : ''}`).join('; '),
        'old fora do new = 0 e new ≥ 1');
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Etapa: suítes E2E e teste de unidade (seção 6 item 5; plano, critério 5)

function etapaSuites() {
  const nomes = ['e2e-so-claude', 'e2e-voz-saida', 'e2e-voz', 'e2e-gasto', 'e2e-multi', 'e2e-atualiza', 'e2e-lista', 'e2e-ouvindo', 'e2e-vozes-app'];
  const out = {};
  for (const n of nomes) {
    const arq = path.join(SUITES, n + '.cjs');
    if (!fs.existsSync(arq)) { out[n] = { ok: false, msg: 'arquivo não encontrado: ' + arq }; chk(`S6.5.${n}`, `suíte ${n}`, false, 'não encontrada', 'rc 0, ≥1 ok, 0 FALHOU'); continue; }
    const args = [arq, BASE + 'index.html'];
    if (n === 'e2e-vozes-app') args.push(SCRATCH);
    const t0 = Date.now();
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
    const txt = (r.stdout || '') + (r.stderr || '');
    const nOk = (txt.match(/^ok\b/gm) || []).length, nF = (txt.match(/FALHOU/g) || []).length;
    const ok = r.status === 0 && nOk > 0 && nF === 0;
    out[n] = { rc: r.status, ok: nOk, falhou: nF, s: Math.round((Date.now() - t0) / 1000) };
    chk(`S6.5.${n}`, `suíte ${n}`, ok, `rc ${r.status}, ${nOk} ok, ${nF} FALHOU`, 'rc 0, ≥1 ok, 0 FALHOU');
  }
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--test', 'tests/jarvis-claude.test.mjs'], { cwd: REPO, encoding: 'utf8', timeout: 300000 });
  const txt = (r.stdout || '') + (r.stderr || '');
  const pass = +((txt.match(/^# pass (\d+)/m) || [])[1] || 0), fail = +((txt.match(/^# fail (\d+)/m) || [])[1] || 0);
  out.unidade = { rc: r.status, pass, fail };
  chk('S6.5.unidade', 'teste de unidade tests/jarvis-claude.test.mjs', r.status === 0 && pass > 0 && fail === 0, `rc ${r.status}, pass ${pass}, fail ${fail}`, 'rc 0, pass ≥ 1, fail 0');
  return out;
}

// ---------------------------------------------------------------------------------------------

(async () => {
  fs.mkdirSync(CAPT, { recursive: true });
  nota(`base ${BASE}; capturas em ${CAPT}`);
  const browser = await chromium.launch({ executablePath: CHROME });
  nota('chromium ' + browser.version());
  const acum = bruto.perfis;

  for (const perfil of [P17, P13]) await etapaRetrato(browser, perfil, acum);

  // S6.4 — célula do 17PM maior que a do 13 por ≥ 6
  const c17 = acum.iphone17promax.medidas.celulaCalendario, c13 = acum.iphone13.medidas.celulaCalendario;
  chk('S6.4.celula-17pm-maior', 'célula do calendário no 17PM maior que no 13 por ≥ 6 px', c17 != null && c13 != null && c17 - c13 >= 6 - EPS,
    `${f1(c17)} − ${f1(c13)} = ${f1(c17 - c13)}`, '≥ 6');

  await etapaPaisagem(browser, acum);
  await etapaAux(browser, bruto.auxiliares);
  await browser.close();

  // S6.5 — erros de JavaScript nas vistas
  for (const p of [P17, P13, PAISAGEM]) {
    const e = (acum[p.nome] || {}).erros || [];
    chk(`S6.5.erros.${TAG[p.nome]}`, `nenhum erro de JavaScript (pageerror) nas vistas do app, ${p.nome}`, e.length === 0, e.length ? `${e.length}: ${e.slice(0, 3).join(' | ').slice(0, 300)}` : '0 erros', '0');
  }

  etapaTextos();
  bruto.suites = etapaSuites();

  // ---- Definição de pronto (P1–P6), a partir das mesmas medições ----
  const VP1 = ['mes', 'dia', 'lista', 'atrasadas', 'sequencia', 'jarvis', 'voz', 'nova-tarefa'];
  for (const p of [P17, P13]) {
    const r = acum[p.nome], t = TAG[p.nome];
    const medidas = VP1.map(v => ({ v, sw: (r.vistas[v] || {}).sw }));
    const ruins = medidas.filter(m => !(m.sw != null && m.sw <= p.width));
    chk(`P1.${t}`, `sem rolagem lateral (scrollWidth ≤ ${p.width}) em Mês, Dia, Lista, Atrasadas, Sequência, Jarvis, voz e nova tarefa`, ruins.length === 0,
      medidas.map(m => `${m.v} ${m.sw}`).join(', '), `todas ≤ ${p.width}`);
  }
  for (const p of [P17, P13]) {
    const r = acum[p.nome], t = TAG[p.nome];
    const tot = r.p2.reduce((s, x) => s + x.ilha + x.ind, 0);
    chk(`P2.${t}`, `nada clicável sob a ilha nem fixo sob o indicador (rolagem 0, ${r.p2.length} vistas)`, tot === 0 && r.p2.length === h.VISTAS.length,
      `sob a ilha ${r.p2.reduce((s, x) => s + x.ilha, 0)}, fixos sob o indicador ${r.p2.reduce((s, x) => s + x.ind, 0)}${tot ? ' [' + r.p2.filter(x => x.ilha + x.ind).map(x => x.vista + ': ' + x.detalhe).join('; ') + ']' : ''}`, '0 e 0 em 9 vistas');
  }
  {
    const p3 = acum.iphone17promax.p3 || {};
    const esp = ['#openDialog', '#jarvis-btn', '#viewContent .nav-btn', '#calFullBtn', '#viewTabs .view-tab', '#filters .chip', '#jarvis-mic', '#jarvis-send', '#seqTimerBtn', '#parceiroBtn', '#moreMenuBtn', '.jarvis-hbtn'];
    const ruins = esp.filter(s => !(p3[s] && p3[s].length && p3[s].every(r => ge(r.w, 44) && ge(r.h, 44))));
    chk('P3.17pm', 'alvos ≥ 44×44 no 17PM: +, Jarvis, setas, abas, filtros, mic/enviar, cabeçalho', ruins.length === 0,
      esp.map(s => `${s} ${p3[s] && p3[s].length ? p3[s].length + '× min ' + f1(Math.min(...p3[s].map(r => r.w))) + '×' + f1(Math.min(...p3[s].map(r => r.h))) : 'ausente'}`).join(', '), 'todos w ≥ 44 e h ≥ 44');
  }
  {
    const m17 = acum.iphone17promax.medidas, m13 = acum.iphone13.medidas;
    const ok = perto(m17.larguraConteudo, 440) && perto(m17.larguraConteudoInterna, 408) && m17.celulaCalendario > m13.celulaCalendario;
    chk('P4', 'largura extra aproveitada: .app ocupa a largura útil no 17PM e a célula fica mais larga que no 13', ok,
      `.app ${f1(m17.larguraConteudo)} (interna ${f1(m17.larguraConteudoInterna)}); célula ${f1(m17.celulaCalendario)} vs ${f1(m13.celulaCalendario)}`, '.app 440 (interna 408) e célula 17PM > 13');
  }
  {
    const s = bruto.suites;
    const ruins = Object.entries(s).filter(([k, v]) => k === 'unidade' ? !(v.rc === 0 && v.pass > 0 && v.fail === 0) : !(v.rc === 0 && v.ok > 0 && v.falhou === 0));
    const erros = [P17, P13].reduce((n, p) => n + ((acum[p.nome] || {}).erros || []).length, 0);
    chk('P5', 'sem regressão: 9 suítes E2E e teste de unidade passam; nenhum erro de JS nas vistas (o próprio layout.cjs é o código de saída)', ruins.length === 0 && erros === 0,
      `${Object.keys(s).length - ruins.length}/${Object.keys(s).length} passaram${ruins.length ? ' [falharam: ' + ruins.map(x => x[0]).join(', ') + ']' : ''}; erros de JS ${erros}`, '10/10 e 0 erros');
  }
  for (const a of AUX) {
    const r = bruto.auxiliares[a.nome] || {};
    const p6 = r.p6 || { ok: false };
    chk(`P6.${a.nome}`, `${a.nome}: sem rolagem lateral e cabeçalho fora da ilha (17PM)`, !!p6.ok && p6.pagina !== false,
      p6.erro ? 'erro: ' + p6.erro : `scrollWidth ${p6.sw}, primeiro conteúdo em ${f1(p6.topo)}${p6.pagina === false ? ', abriu ' + r.url : ''}`, 'scrollWidth ≤ 440, topo ≥ 62, página própria');
  }

  // ---- Resumo ----
  const falhas = resultados.filter(r => !r.ok);
  bruto.resultados = resultados;
  try { fs.writeFileSync(SAIDA_JSON, JSON.stringify(bruto, null, 1)); } catch (_) {}
  nota(`total ${resultados.length}: ${resultados.length - falhas.length} ok, ${falhas.length} FALHOU`);
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.log('FALHOU - execucao erro inesperado (' + (e && e.stack || e) + ' vs sem erro)'); process.exit(1); });
