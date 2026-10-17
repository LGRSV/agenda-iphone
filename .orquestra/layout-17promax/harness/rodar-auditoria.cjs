// Roda a auditoria completa com o harness: prova da área segura, 9 vistas x 2 perfis e as páginas
// auxiliares no perfil 17 Pro Max. Grava as capturas e um JSON com todas as medições.
//   node rodar-auditoria.cjs <pastaCapturas> <arquivoJson>
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const h = require('./medir.cjs');

const PASTA = process.argv[2] || path.join(process.cwd(), 'antes');
const SAIDA = process.argv[3] || path.join(process.cwd(), 'medicoes-antes.json');

// Páginas auxiliares alcançáveis a partir do app (levantadas pela leitura do código; a origem vai no relatório).
const AUX = [
  { nome: 'financeiro', caminho: 'financeiro.html' },
  { nome: 'marketplace', caminho: 'marketplace/' },
  { nome: 'gamificacao', caminho: 'gamificacao.html' },
  { nome: 'equipamentos-especiais', caminho: 'equipamentos-especiais.html' },
  { nome: 'treino', caminho: 'treino.html?date=TREINO', viaApp: true }, // a página só desenha com uma tarefa treino-<data> criada pelo app
  { nome: 'carteira', caminho: 'carteira.html' },
  { nome: 'extrato-saldo', caminho: 'extrato-saldo.html?mes=MES' },
  { nome: 'investimentos', caminho: 'investimentos.html' },
  { nome: 'fatura-inter', caminho: 'fatura-inter.html' },
  { nome: 'refaturamento', caminho: 'refaturamento.html' },
  { nome: 'financeiro-compartilhado', caminho: 'financeiro-compartilhado.html' },
  { nome: 'importar', caminho: 'importar.html' },
];

(async () => {
  fs.mkdirSync(PASTA, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const out = { quando: new Date().toISOString(), chromium: browser.version(), perfis: h.perfis, provaAreaSegura: [], vistas: [], auxiliares: [], erros: {} };

  // 1. Prova da área segura pelos dois métodos (o harness usa o CDP; a troca de texto é o plano B).
  for (const perfil of Object.values(h.perfis)) {
    for (const metodo of ['nenhum', 'cdp', 'route']) {
      const { context, page } = await h.abrirApp(browser, perfil, { metodo });
      const prova = await page.evaluate(() => {
        const app = document.querySelector('.app'), jb = document.getElementById('jarvis-btn');
        return {
          paddingTopApp: parseFloat(getComputedStyle(app).paddingTop), // calc(18px + env(safe-area-inset-top)) na linha 21
          jarvisBtnBottomGap: Math.round((innerHeight - jb.getBoundingClientRect().bottom) * 10) / 10, // calc(12px + env(safe-area-inset-bottom)) na linha 70
        };
      });
      out.provaAreaSegura.push({ perfil: perfil.nome, metodo: page.__areaSegura.metodo, envMedido: page.__areaSegura.medido, confere: page.__areaSegura.confere, ...prova });
      await context.close();
    }
  }

  // 2. As 9 vistas nos dois perfis.
  for (const perfil of Object.values(h.perfis)) {
    const { context, page } = await h.abrirApp(browser, perfil);
    for (const vista of h.VISTAS) {
      try {
        await h.irPara(page, vista);
        const m = await h.medir(page, perfil, vista);
        await h.capturar(page, path.join(PASTA, `${perfil.nome}-${vista}.png`));
        out.vistas.push(m);
        console.log('ok', perfil.nome, vista, 'sw', m.scrollWidth, 'ilha', m.interativosSobIlha.length, 'ind', m.interativosSobIndicador.length, 'peq', m.alvosPequenos.length);
      } catch (e) {
        console.log('FALHA', perfil.nome, vista, e.message);
        out.vistas.push({ vista, perfil: perfil.nome, erro: e.message });
      }
    }
    out.erros[perfil.nome] = page.__erros.slice();
    await context.close();
  }

  // 3. Páginas auxiliares no 17 Pro Max.
  const pad = n => String(n).padStart(2, '0'), d = new Date();
  const HOJE = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, MES = HOJE.slice(0, 7);
  const perfil = h.perfis.iphone17promax;
  for (const a of AUX) {
    const caminho = a.caminho.replace('HOJE', HOJE).replace('MES', MES);
    try {
      let aberto, caminhoFinal = caminho;
      if (a.viaApp) {
        aberto = await h.abrirApp(browser, perfil);
        const dt = await aberto.page.evaluate(hoje => {
          const ids = JSON.parse(localStorage.getItem('agenda_lagares_v3') || '[]').map(t => String(t.id)).filter(i => /^treino-\d{4}-\d{2}-\d{2}$/.test(i)).map(i => i.slice(7)).sort();
          return ids.find(d => d >= hoje) || ids[ids.length - 1] || hoje;
        }, HOJE);
        caminhoFinal = caminho.replace('TREINO', dt);
        await aberto.page.goto('http://127.0.0.1:8765/' + caminhoFinal, { waitUntil: 'load' });
        await aberto.page.waitForTimeout(1200);
      } else {
        aberto = await h.abrirApp(browser, perfil, { caminho });
      }
      const { context, page } = aberto;
      await page.evaluate(() => window.scrollTo(0, 0));
      const m = await h.medir(page, perfil, 'aux-' + a.nome);
      m.caminhoPedido = caminhoFinal;
      m.viewportMeta = await page.evaluate(() => (document.querySelector('meta[name=viewport]') || {}).content || null);
      m.errosJs = page.__erros.slice();
      await h.capturar(page, path.join(PASTA, `aux-${a.nome}.png`));
      out.auxiliares.push(m);
      console.log('ok aux', a.nome, '->', m.url, 'sw', m.scrollWidth, 'cab', JSON.stringify(m.cabecalho), 'ilha', m.interativosSobIlha.length);
      await context.close();
    } catch (e) {
      console.log('FALHA aux', a.nome, e.message);
      out.auxiliares.push({ vista: 'aux-' + a.nome, perfil: perfil.nome, caminhoPedido: caminho, erro: e.message });
    }
  }
  await browser.close();
  fs.writeFileSync(SAIDA, JSON.stringify(out, null, 1));
  console.log('json', SAIDA);
})().catch(e => { console.error('FALHOU:', e); process.exit(1); });
