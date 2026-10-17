// E2E do seletor "Tela de início" (missão inicio-minimalista).
// Uso: node e2e-tela-inicio.cjs [base]   (padrão http://127.0.0.1:8765/)
// Confere: sem escolha não há data-home; cada variante escolhida pelo menu aplica o atributo,
// carrega o CSS e sobrevive a recarregar; "Atual" remove o atributo; alvos ≥ 44 px nos dois
// temas; nenhum erro de JS. Imprime "ok - …" / "FALHOU - …" e sai com 1 se algo falhar.
'use strict';
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const h = require('/home/user/agenda-iphone/.orquestra/layout-17promax/harness/medir.cjs');

const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const IDS = ['essencial', 'hoje', 'ios', 'zen'];
const KEY = 'agenda_tela_inicio';
let falhas = 0;
const ok = m => console.log('ok - ' + m);
const falhou = (m, e) => { falhas++; console.log('FALHOU - ' + m + (e ? ': ' + (e.message || e) : '')); };
async function checar(nome, fn) { try { const r = await fn(); ok(r ? `${nome} (${r})` : nome); } catch (e) { falhou(nome, e); } }
const assert = (c, m) => { if (!c) throw new Error(m || 'condição falsa'); };

const home = page => page.evaluate(() => document.documentElement.getAttribute('data-home'));
// impressão digital de estilos da tela de início, para provar que o CSS da variante pegou
const digital = page => page.evaluate(() => ['.topbar', '.topbar h1', '#currentDate', '.summary', '#viewTabs', '#filters', '#openDialog'].map(s => {
  const e = document.querySelector(s); if (!e) return s + ':-';
  const c = getComputedStyle(e), r = e.getBoundingClientRect();
  return [s, c.fontSize, c.fontWeight, c.backgroundColor, c.borderTopWidth, c.position, Math.round(r.top), Math.round(r.height)].join('|');
}).join(' '));

async function recarregar(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.AgendaAPI, null, { timeout: 20000 });
  await page.waitForSelector('#viewContent > *', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(700);
}

async function abrirSeletor(page) {
  await page.evaluate(() => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); window.scrollTo(0, 0); });
  await page.click('#moreMenuBtn');
  await page.waitForSelector('#quickMenu.is-open', { timeout: 4000 });
  await page.waitForTimeout(250);
  await page.click('#telaInicioBtn');
  await page.waitForSelector('#telaInicioDialog[open]', { timeout: 4000 });
  await page.waitForTimeout(150);
}

async function escolher(page, id) {
  await abrirSeletor(page);
  await page.click(`#telaInicioDialog [data-home-id="${id}"]`);
  await page.waitForFunction(() => !document.querySelector('#telaInicioDialog[open]'), null, { timeout: 3000 });
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const perfil = h.perfis.iphone17promax;
  const { context, page } = await h.abrirApp(browser, perfil, { base: BASE });
  const erros = [];
  page.on('pageerror', e => erros.push(String(e)));
  // O SDK do Supabase pode apagar o token falso do harness; sem ele a recarga cai no login.
  // Também registra se o data-home já estava no <html> quando o <body> nasceu (sem "pisca").
  await context.addInitScript(() => {
    try { localStorage.setItem('sb-uabpevnjfcwidbjscowq-auth-token', '{"access_token":"x","refresh_token":"y"}'); } catch (_) {}
    window.__homeNoBody = 'sem-body';
    // o init script roda antes de existir o <html>: observa o document inteiro até o <body> aparecer
    const mo = new MutationObserver(() => { if (document.body) { window.__homeNoBody = document.documentElement.getAttribute('data-home'); mo.disconnect(); } });
    mo.observe(document, { childList: true, subtree: true });
  });

  await checar('sem escolha não existe data-home', async () => {
    const v = await home(page); const ls = await page.evaluate(k => localStorage.getItem(k), KEY);
    assert(v === null, 'data-home=' + v); assert(ls === null, 'localStorage=' + ls);
  });
  const dPadrao = await digital(page);

  await checar('script de pré-pintura vem antes do primeiro <style> e as 4 folhas estão no <head>', async () => {
    const r = await page.evaluate(ids => {
      const head = document.head, kids = [...head.children];
      const iScript = kids.findIndex(e => e.tagName === 'SCRIPT' && /agenda_tela_inicio/.test(e.textContent));
      const iStyle = kids.findIndex(e => e.tagName === 'STYLE');
      const folhas = ids.map(id => [...document.styleSheets].find(s => s.href && s.href.includes(`estilos-inicio/${id}.css`)));
      return { iScript, iStyle, carregadas: folhas.map(s => !!s && s.cssRules.length > 0) };
    }, IDS);
    assert(r.iScript >= 0 && r.iScript < r.iStyle, JSON.stringify(r));
    assert(r.carregadas.every(Boolean), 'folhas: ' + r.carregadas);
  });

  await checar('item "Tela de início" no menu com o mesmo estilo dos outros e alvo ≥ 44 px', async () => {
    await page.click('#moreMenuBtn'); await page.waitForSelector('#quickMenu.is-open'); await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const b = document.getElementById('telaInicioBtn'), ref = document.getElementById('themeToggle');
      const f = e => { const c = getComputedStyle(e); return [c.display, c.minHeight, c.fontSize, c.fontWeight, c.color, c.backgroundColor, c.paddingLeft, c.borderRadius].join('|'); };
      const rb = b.getBoundingClientRect(), svg = b.querySelector('.menu-option-icon svg');
      return { igual: f(b) === f(ref), a: f(b), b: f(ref), w: rb.width, h: rb.height, icone: !!svg && getComputedStyle(svg).strokeWidth, texto: b.textContent.trim(), dentro: rb.bottom <= innerHeight };
    });
    await page.click('#moreMenuBtn'); await page.waitForTimeout(250);
    assert(r.igual, `${r.a} ≠ ${r.b}`); assert(r.h >= 44 && r.w >= 44, `${r.w}×${r.h}`);
    assert(r.icone === '1.8px', 'ícone ' + r.icone); assert(r.texto === 'Tela de início', r.texto); assert(r.dentro, 'item fora da tela');
    return `${Math.round(r.w)}×${Math.round(r.h)}`;
  });

  for (const tema of ['escuro', 'claro']) {
    await checar(`diálogo: 5 opções, "Atual" marcada e todas com alvo ≥ 44 px (tema ${tema})`, async () => {
      await page.evaluate(t => { document.documentElement.dataset.theme = t === 'claro' ? 'light' : 'dark'; }, tema);
      await abrirSeletor(page);
      const r = await page.evaluate(() => [...document.querySelectorAll('#telaInicioDialog [data-home-id], #closeTelaInicioDialog')].map(e => {
        const b = e.getBoundingClientRect(); return { id: e.dataset.homeId || 'fechar', w: b.width, h: b.height, marcado: e.getAttribute('aria-checked'), dentro: b.top >= 0 && b.bottom <= innerHeight, nome: e.querySelector('.home-option-name')?.textContent, desc: e.querySelector('.home-option-desc')?.textContent };
      }));
      await page.click('#closeTelaInicioDialog');
      await page.waitForFunction(() => !document.querySelector('#telaInicioDialog[open]'));
      const ops = r.filter(o => o.id !== 'fechar');
      assert(ops.map(o => o.id).join() === 'atual,' + IDS.join(), ops.map(o => o.id).join());
      assert(ops.every(o => o.nome && o.desc), 'opção sem nome ou conceito');
      assert(ops.filter(o => o.marcado === 'true').map(o => o.id).join() === 'atual', 'marcadas: ' + ops.filter(o => o.marcado === 'true').map(o => o.id));
      const peq = r.filter(o => o.w < 44 || o.h < 44 || !o.dentro);
      assert(!peq.length, 'pequenas/fora: ' + JSON.stringify(peq));
      assert(await home(page) === null, '"Fechar" mudou a tela');
      return 'menor altura ' + Math.round(Math.min(...r.map(o => o.h))) + ' px';
    });
  }
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });

  for (const id of IDS) {
    await checar(`escolher "${id}" pelo menu aplica data-home, grava e muda o visual`, async () => {
      await escolher(page, id);
      const v = await home(page), ls = await page.evaluate(k => localStorage.getItem(k), KEY);
      assert(v === id, 'data-home=' + v); assert(ls === id, 'localStorage=' + ls);
      assert(await digital(page) !== dPadrao, 'o visual não mudou');
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      assert(sw[0] <= sw[1], 'rolagem lateral ' + sw);
    });
    await checar(`"${id}" sobrevive a recarregar, já presente quando o <body> nasce, e fica marcado no seletor`, async () => {
      const antes = await digital(page);
      await recarregar(page);
      const v = await home(page), cedo = await page.evaluate(() => window.__homeNoBody);
      assert(v === id, 'data-home=' + v); assert(cedo === id, 'no nascimento do body: ' + cedo);
      assert(await digital(page) === antes, 'visual diferente depois de recarregar');
      await abrirSeletor(page);
      const marcadas = await page.$$eval('#telaInicioDialog [aria-checked="true"]', e => e.map(x => x.dataset.homeId));
      await page.click('#closeTelaInicioDialog'); await page.waitForTimeout(150);
      assert(marcadas.join() === id, 'marcadas: ' + marcadas);
    });
  }

  await checar('voltar para "Atual" remove o atributo e a gravação, e o visual volta ao padrão', async () => {
    await escolher(page, 'atual');
    assert(await home(page) === null, 'data-home=' + await home(page));
    assert(await page.evaluate(k => localStorage.getItem(k), KEY) === null, 'localStorage ainda tem valor');
    assert(await digital(page) === dPadrao, 'visual diferente do padrão');
    await recarregar(page);
    assert(await home(page) === null, 'depois de recarregar: data-home=' + await home(page));
    assert(await digital(page) === dPadrao, 'visual diferente do padrão depois de recarregar');
  });

  await checar('valor desconhecido no localStorage é ignorado', async () => {
    await page.evaluate(k => localStorage.setItem(k, 'xyz'), KEY);
    await recarregar(page);
    assert(await home(page) === null, 'data-home=' + await home(page));
    await page.evaluate(k => localStorage.removeItem(k), KEY);
  });

  await checar('nenhum erro de JS', async () => { assert(!erros.length, erros.join(' | ')); });

  await context.close(); await browser.close();
  console.log(falhas ? `${falhas} falha(s)` : 'tudo ok');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.log('FALHOU - execução: ' + (e.stack || e)); process.exit(1); });
