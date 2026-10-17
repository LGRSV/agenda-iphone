// Medições complementares da auditoria (fora das 9 vistas do contrato):
// diálogo de reagendar, itens do menu sem rótulo, alvos pequenos dentro de <label>,
// e a regra de UA dialog:modal que limita a largura dos diálogos.
//   node extras-auditoria.cjs <arquivoJson>
'use strict';
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const h = require('./medir.cjs');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const out = {};
  for (const perfil of Object.values(h.perfis)) {
    const { context, page } = await h.abrirApp(browser, perfil);
    const r = out[perfil.nome] = {};
    // 1. Reagendar: abre pelo primeiro relógio da Lista.
    await h.irPara(page, 'lista');
    await page.$eval('#viewContent .task-reschedule', b => b.click());
    await page.waitForSelector('#rescheduleDialog[open]', { timeout: 4000 });
    await page.waitForTimeout(400);
    r.reagendar = await page.evaluate(() => {
      const d = document.getElementById('rescheduleDialog'), b = d.getBoundingClientRect(), n = d.querySelector('.reschedule-task-name');
      return { w: Math.round(b.width * 10) / 10, left: Math.round(b.left), top: Math.round(b.top), bottom: Math.round(b.bottom),
        nomeTarefaW: n ? Math.round(n.getBoundingClientRect().width) : null,
        presets: [...d.querySelectorAll('.reschedule-preset')].map(e => { const q = e.getBoundingClientRect(); return [Math.round(q.width * 10) / 10, Math.round(q.height * 10) / 10]; }).slice(0, 3) };
    });
    // 2. Diálogo modal: largura pedida pelo autor x largura final (a UA limita a calc(100% - 6px - 2em)).
    r.uaDialogMaxWidth = await page.evaluate(() => getComputedStyle(document.getElementById('rescheduleDialog')).maxWidth);
    await page.evaluate(() => document.getElementById('rescheduleDialog').close());
    await h.irPara(page, 'nova-tarefa');
    r.novaTarefa = await page.evaluate(() => {
      const d = document.getElementById('taskDialog'), cs = getComputedStyle(d);
      const lem = document.getElementById('taskLembrete');
      const lr = lem && (lem.closest('label') || null);
      return { w: Math.round(d.getBoundingClientRect().width * 10) / 10, maxWidthComputado: cs.maxWidth,
        lembrete: lem ? { w: lem.getBoundingClientRect().width, h: lem.getBoundingClientRect().height, dentroDeLabel: !!lr,
          labelW: lr ? Math.round(lr.getBoundingClientRect().width) : null, labelH: lr ? Math.round(lr.getBoundingClientRect().height) : null } : null };
    });
    // 3. Menu: itens sem texto visível (botões só com ícone movidos para o menu pelo header-cleanup.js).
    await h.irPara(page, 'menu');
    r.menuItens = await page.evaluate(() => [...document.querySelectorAll('#quickMenu > a, #quickMenu > button')].map(e => {
      const q = e.getBoundingClientRect();
      return { seletor: e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.getAttribute('href') ? `[href="${e.getAttribute('href')}"]` : ''),
        texto: e.textContent.replace(/\s+/g, ' ').trim(), ariaLabel: e.getAttribute('aria-label'), w: Math.round(q.width), h: Math.round(q.height) };
    }));
    // 4. Alvos pequenos de tarefa: o checkbox fica dentro de <label>? (a área do label conta como alvo)
    await h.irPara(page, 'dia');
    r.tarefaAlvos = await page.evaluate(() => {
      const c = document.querySelector('#viewContent .task-card .check');
      const card = c && c.closest('.task-card');
      return c ? { checkDentroDeLabel: !!c.closest('label'), check: [c.getBoundingClientRect().width, c.getBoundingClientRect().height],
        coluna: card ? getComputedStyle(card).gridTemplateColumns : null } : null;
    });
    // 5. Cabeçalho: largura do título e dos botões
    r.cabecalho = await page.evaluate(() => {
      const h1 = document.querySelector('.topbar h1'), ha = document.querySelector('.head-actions');
      return { h1FontSize: getComputedStyle(h1).fontSize, h1W: Math.round(h1.getBoundingClientRect().width), headActionsW: Math.round(ha.getBoundingClientRect().width),
        botoes: [...ha.children].filter(e => e.getBoundingClientRect().width > 0 && e.id !== 'quickMenu').map(e => ({ id: e.id, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })) };
    });
    // 6. Calendário: altura das células e fonte das etiquetas
    await h.irPara(page, 'mes');
    r.calendario = await page.evaluate(() => {
      const c = document.querySelector('.calendar-day'), t = document.querySelector('.calendar-tag'), g = document.querySelector('.month-grid');
      return { celulaW: c.getBoundingClientRect().width, celulaMinHeight: getComputedStyle(c).minHeight, padding: getComputedStyle(c).padding,
        etiquetaFonte: t ? getComputedStyle(t).fontSize : null, gradeW: Math.round(g.getBoundingClientRect().width), gradeH: Math.round(g.getBoundingClientRect().height) };
    });
    // 7. Depois de rolar 400 px na Lista: o que fica atrás da ilha (não há barra fixa no topo)?
    await h.irPara(page, 'lista');
    r.rolado400 = await page.evaluate(ins => {
      window.scrollTo(0, 400);
      const y = Math.round(ins.top / 2), el = document.elementFromPoint(220, y);
      const fixosNoTopo = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); if (s.position !== 'fixed' && s.position !== 'sticky') return false; const q = e.getBoundingClientRect(); return q.top <= 0 && q.bottom >= ins.top && q.width >= innerWidth * 0.9 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.05; }).map(e => e.id || e.className);
      const inter = [...document.querySelectorAll('button, a, input, select, textarea, [role=button]')].filter(e => { const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0 && q.top < ins.top && q.bottom > 0; }).length;
      const out = { scrollY: window.scrollY, pontoY: y, elementoNoPonto: el ? (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].join('.')) : null, barrasFixasCobrindoIlha: fixosNoTopo, interativosSobIlhaRolado: inter };
      window.scrollTo(0, 0);
      return out;
    }, perfil.insets);
    r.flutuantes = (await h.medir(page, perfil, 'lista')).flutuantes;
    // 8. Mês com rolagem 0: que dias do calendário cada botão flutuante cobre (interseção de retângulos).
    await h.irPara(page, 'mes');
    r.diasCobertosNoMes = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.calendar-day')], out = {};
      for (const id of ['openDialog', 'cardioFab', 'jarvis-btn', 'app-update']) {
        const el = document.getElementById(id); if (!el) continue;
        const f = el.getBoundingClientRect();
        out[id] = cells.filter(c => { const q = c.getBoundingClientRect(); return q.left < f.right && q.right > f.left && q.top < f.bottom && q.bottom > f.top; })
          .map(c => (c.getAttribute('aria-label') || '').replace('Abrir ', '') + (c.classList.contains('today') ? ' (hoje)' : ''));
      }
      return out;
    });
    await context.close();
  }
  await browser.close();
  const destino = process.argv[2];
  if (destino) fs.writeFileSync(destino, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error('FALHOU:', e); process.exit(1); });
