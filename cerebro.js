// Cérebro do João dentro do app: ler, buscar, editar e criar notas do vault Obsidian "Jarvis".
// Nada do conteúdo do vault fica neste repositório: tudo vem na hora da Edge Function
// jarvis-cerebro-app, que só responde ao dono logado (a tabela é fechada para o navegador).
// O que for salvo aqui o PC baixa a cada 15 min (jarvis_app_sync.py) e grava no Obsidian.
const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const MARKED_URL = 'https://cdn.jsdelivr.net/npm/marked@12.0.2/+esm';
const PURIFY_URL = 'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/+esm';
const OWNER = '718266ce-ac47-4ab9-ac39-4fde8344c9d7';
const MARCA = '<!-- gerado: não editar acima desta linha -->';
const FONTES = '90 Fontes';
const CAIXA = '00 Início/Caixa de entrada';

const el = id => document.getElementById(id);
const tela = el('tela');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nomeDe = c => String(c || '').split('/').pop().replace(/\.md$/, '');
const quando = ts => {
  if (!ts) return '';
  const d = new Date(ts), hoje = new Date();
  return d.toDateString() === hoje.toDateString()
    ? 'hoje ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};
const ERROS = {
  segredo: 'Parece ter senha, token, chave ou telefone. O cérebro não guarda isso: escreva onde a informação está, não qual é.',
  parte_gerada: 'Esta nota é gerada pelo PC: só dá para mudar o texto abaixo da marca.',
  somente_leitura: '90 Fontes é só leitura (são exportações).',
  nome_repetido: 'Já existe uma nota com esse nome no cérebro (o nome precisa ser único no vault inteiro).',
  pasta_invalida: 'Escolha uma pasta que já existe (fora de 90 Fontes).',
  nao_existe: 'Essa nota não existe no cérebro (ou ainda não foi enviada pelo PC).',
  too_large: 'Texto grande demais.',
  bad_request: 'Pedido inválido (confira o nome da nota: sem / \\ : * ? " < > | # ^ [ ]).',
  forbidden: 'O cérebro é só do dono da agenda.',
  unauthorized: 'Sessão expirada. Entre de novo na agenda.',
  unavailable: 'O banco não respondeu. Tente de novo.',
  rede: 'Sem conexão com o servidor.',
};
const erroTexto = r => ERROS[r?.error] || ('Erro: ' + (r?.error || 'desconhecido'));

let sb, cfg, md = null, pastas = null, sujo = false, rotaAtual = '', editando = false;

async function iniciar() {
  const c = window.AgendaSupabaseConfig || {};
  let salvo = {};
  try { salvo = JSON.parse(localStorage.getItem('agenda_supabase_config_v1') || '{}') || {}; } catch (_) {}
  cfg = { url: c.url || salvo.url || 'https://uabpevnjfcwidbjscowq.supabase.co', key: c.publishableKey || salvo.publishableKey || 'sb_publishable_SHH7EV0MT5grOTdCFM-V-w_FqPrtzPh' };
  const { createClient } = await import(MODULE_URL);
  sb = createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const { data } = await sb.auth.getSession();
  const uid = data?.session?.user?.id;
  if (!uid) { location.replace('./?locked=1'); return; }
  if (uid !== OWNER) { tela.innerHTML = `<div class="aviso err">${ERROS.forbidden}</div>`; el('novaBtn').hidden = true; el('busca').hidden = true; return; }
  el('busca').addEventListener('input', buscarDigitando);
  el('busca').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); irBusca(true); } });
  el('novaBtn').addEventListener('click', () => { location.hash = 'nova=' + encodeURIComponent(pastaAtual() || CAIXA); });
  window.addEventListener('hashchange', rotear);
  window.addEventListener('beforeunload', e => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });
  rotear();
}

async function api(body) {
  const { data } = await sb.auth.getSession();
  const tok = data?.session?.access_token;
  if (!tok) { location.replace('./?locked=1'); return { ok: false, error: 'unauthorized' }; }
  try {
    const res = await fetch(cfg.url + '/functions/v1/jarvis-cerebro-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.key, Authorization: 'Bearer ' + tok },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({ ok: false, error: 'rede' }));
    j.status = res.status;
    return j;
  } catch (_) { return { ok: false, error: 'rede' }; }
}

async function markdown() {
  if (!md) {
    const [m, p] = await Promise.all([import(MARKED_URL), import(PURIFY_URL)]);
    const purify = p.default;
    purify.addHook('afterSanitizeAttributes', n => {
      if (n.tagName === 'A' && /^https?:/i.test(n.getAttribute('href') || '')) { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); }
    });
    md = { marked: m.marked, purify };
  }
  return md;
}

// [[nota]], [[nota|apelido]], [[nota#seção]] viram links do app; ![[anexo]] vira só o nome.
function wikify(t) {
  return t.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((seg, i) => i % 2 ? seg : seg
    .replace(/!\[\[([^\]\n]+)\]\]/g, (_, x) => `<span class="anexo">📎 ${esc(x.split('|')[0])}</span>`)
    .replace(/\[\[([^\]\n]+)\]\]/g, (_, x) => {
      const [alvo, apelido] = x.split('|');
      const nome = alvo.replace(/\\$/, '').trim();
      const txt = (apelido || nome.split('#')[0].split('/').pop() || nome).trim();
      return `<a class="wl" href="#w=${encodeURIComponent(nome)}">${esc(txt)}</a>`;
    })).join('');
}

async function renderizar(texto) {
  const { marked, purify } = await markdown();
  let props = '';
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto);
  if (fm) { props = `<div class="props">${esc(fm[1])}</div>`; texto = texto.slice(fm[0].length); }
  const html = marked.parse(wikify(texto), { gfm: true, breaks: true });
  return props + purify.sanitize(html);
}

const pastaAtual = () => {
  const h = location.hash.slice(1);
  if (h.startsWith('p=')) return decodeURIComponent(h.slice(2));
  if (h.startsWith('n=')) return decodeURIComponent(h.slice(2)).split('/').slice(0, -1).join('/');
  return '';
};

const k0 = h => h.split('=')[0];

async function rotear() {
  const h = location.hash.slice(1);
  if (sujo && editando && h !== rotaAtual) {
    if (!confirm('Sair sem salvar a edição?')) { history.pushState(null, '', '#' + rotaAtual); return; }
  }
  sujo = false;
  editando = k0(h) === 'e' || k0(h) === 'nova';
  rotaAtual = h;
  window.scrollTo(0, 0);
  const [k, ...resto] = h.split('=');
  const v = decodeURIComponent(resto.join('='));
  if (k === 'n') return abrirNota(v);
  if (k === 'w') return abrirWiki(v);
  if (k === 'p') return abrirPasta(v);
  if (k === 'q') { el('busca').value = v; return mostrarBusca(v); }
  if (k === 'e') return editar(v);
  if (k === 'nova') return nova(v);
  return inicio();
}

function titulo(t) { el('titulo').textContent = t || 'Cérebro'; document.title = t ? t + ' · Cérebro' : 'Cérebro'; }

async function carregarPastas() {
  if (!pastas) {
    const r = await api({ action: 'pastas' });
    if (!r.ok) throw r;
    pastas = r.pastas.filter(p => p.pasta);
  }
  return pastas;
}

// subpastas diretas de "base" ('' = raiz), com o total de notas de cada uma (somando as de dentro)
function filhas(base) {
  const mapa = new Map();
  for (const p of pastas) {
    if (base && !p.pasta.startsWith(base + '/')) continue;
    const resto = base ? p.pasta.slice(base.length + 1) : p.pasta;
    if (!resto) continue;
    const nome = resto.split('/')[0];
    const cheio = base ? base + '/' + nome : nome;
    mapa.set(cheio, (mapa.get(cheio) || 0) + Number(p.notas));
  }
  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
}

const linhaNota = n => `<a class="item" href="#n=${encodeURIComponent(n.caminho)}"><b>${esc(n.titulo || nomeDe(n.caminho))}</b>
  <small>${n.pendente_pc ? '<span class="tag pend">aguardando o PC</span>' : n.origem === 'app' ? '<span class="tag app">editada no app</span>' : ''}${esc(quando(n.atualizado))}${n.pasta !== undefined && !rotaAtual.startsWith('p=') ? ' · ' + esc(n.pasta) : ''}</small></a>`;
const linhaPasta = ([p, qtd], base) => `<a class="item" href="#p=${encodeURIComponent(p)}"><span class="n">${qtd}</span>📁 <b>${esc(base ? p.slice(base.length + 1) : p)}</b></a>`;

async function inicio() {
  titulo('');
  el('voltar').href = './';
  tela.innerHTML = '<div class="vazio">Carregando…</div>';
  const [rec] = await Promise.all([api({ action: 'listar', recentes: true }), carregarPastas().catch(e => e)]);
  if (!rec.ok) { tela.innerHTML = `<div class="aviso err">${esc(erroTexto(rec))}</div>`; return; }
  const pend = rec.notas.filter(n => n.pendente_pc).length;
  tela.innerHTML = `
    ${pend ? `<div class="aviso">${pend} nota(s) mudada(s) no app esperando o PC (ele baixa a cada 15 min quando está ligado).</div>` : ''}
    <div class="sec">Pastas</div>
    <div class="list">${pastas ? filhas('').map(f => linhaPasta(f, '')).join('') : '<div class="vazio">Erro ao carregar as pastas.</div>'}</div>
    <div class="sec">Mudadas por último</div>
    <div class="list">${rec.notas.map(linhaNota).join('') || '<div class="vazio">Nada ainda.</div>'}</div>`;
}

async function abrirPasta(pasta, pagina = 0) {
  titulo(nomeDe(pasta));
  tela.innerHTML = '<div class="vazio">Carregando…</div>';
  await carregarPastas().catch(() => null);
  const r = await api({ action: 'listar', pasta, pagina });
  if (!r.ok) { tela.innerHTML = `<div class="aviso err">${esc(erroTexto(r))}</div>`; return; }
  const subs = pastas ? filhas(pasta) : [];
  const cima = pasta.split('/').slice(0, -1).join('/');
  tela.innerHTML = `
    <div class="crumb">${crumb(pasta)}</div>
    ${pasta.startsWith(FONTES) ? '<div class="aviso">90 Fontes: exportações, só leitura.</div>' : ''}
    ${subs.length ? `<div class="sec">Subpastas</div><div class="list">${subs.map(f => linhaPasta(f, pasta)).join('')}</div>` : ''}
    <div class="sec">Notas${pagina ? ` (página ${pagina + 1})` : ''}</div>
    <div class="list">${r.notas.map(linhaNota).join('') || '<div class="vazio">Nenhuma nota direto nesta pasta.</div>'}</div>
    <div class="row" style="margin-top:10px">
      ${pagina ? `<button class="btn" id="ant" style="flex:1">‹ Anteriores</button>` : ''}
      ${r.mais ? `<button class="btn" id="prox" style="flex:1">Mais notas ›</button>` : ''}
    </div>`;
  if (el('ant')) el('ant').onclick = () => abrirPasta(pasta, pagina - 1);
  if (el('prox')) el('prox').onclick = () => abrirPasta(pasta, pagina + 1);
  el('voltar').href = cima ? '#p=' + encodeURIComponent(cima) : '#';
}

function crumb(pasta) {
  const partes = pasta.split('/');
  return '<a href="#">Cérebro</a>' + partes.map((p, i) => ` › <a href="#p=${encodeURIComponent(partes.slice(0, i + 1).join('/'))}">${esc(p)}</a>`).join('');
}

let timerBusca;
function buscarDigitando() { clearTimeout(timerBusca); timerBusca = setTimeout(() => irBusca(false), 450); }
function irBusca(forcar) {
  const q = el('busca').value.trim();
  if (!q) { if (rotaAtual.startsWith('q=')) history.replaceState(null, '', location.pathname), rotear(); return; }
  const alvo = '#q=' + encodeURIComponent(q);
  if (rotaAtual.startsWith('q=')) { history.replaceState(null, '', alvo); rotaAtual = alvo.slice(1); mostrarBusca(q); }
  else if (forcar || q.length >= 3) location.hash = alvo;
}

async function mostrarBusca(q) {
  titulo('Busca');
  tela.innerHTML = '<div class="vazio">Buscando…</div>';
  const r = await api({ action: 'buscar', q });
  if (el('busca').value.trim() !== q) return; // já digitou outra coisa
  if (!r.ok) { tela.innerHTML = `<div class="aviso err">${esc(erroTexto(r))}</div>`; return; }
  tela.innerHTML = `<div class="sec">${r.notas.length} resultado(s) para “${esc(q)}”</div><div class="list">${r.notas.map(n => `
    <a class="item" href="#n=${encodeURIComponent(n.caminho)}"><b>${esc(n.titulo)}</b><small>${esc(n.pasta)}</small>
    <div class="trecho">${esc(n.trecho || '').replace(/«/g, '<mark>').replace(/»/g, '</mark>')}</div></a>`).join('') || '<div class="vazio">Nada encontrado.</div>'}</div>`;
}

async function abrirWiki(nome) {
  tela.innerHTML = '<div class="vazio">Abrindo…</div>';
  const r = await api({ action: 'ler', nome });
  if (!r.ok) { titulo(nome); tela.innerHTML = `<div class="aviso err">“${esc(nome)}”: ${esc(erroTexto(r))}</div>`; return; }
  history.replaceState(null, '', '#n=' + encodeURIComponent(r.nota.caminho));
  rotaAtual = 'n=' + encodeURIComponent(r.nota.caminho);
  mostrarNota(r);
}

async function abrirNota(caminho) {
  titulo(nomeDe(caminho));
  tela.innerHTML = '<div class="vazio">Carregando…</div>';
  const r = await api({ action: 'ler', caminho });
  if (!r.ok) { tela.innerHTML = `<div class="aviso err">${esc(erroTexto(r))}</div>`; return; }
  mostrarNota(r);
}

async function mostrarNota(r) {
  const n = r.nota;
  titulo(n.titulo);
  el('voltar').href = n.pasta ? '#p=' + encodeURIComponent(n.pasta) : '#';
  const tags = [
    r.somente_leitura ? '<span class="tag ro">só leitura</span>' : '',
    r.gerada ? '<span class="tag">gerada: edite abaixo da marca</span>' : '',
    n.pendente_pc ? '<span class="tag pend">aguardando o PC</span>' : n.origem === 'app' ? '<span class="tag app">editada no app</span>' : '',
  ].join('');
  const corpo = await renderizar(n.conteudo);
  tela.innerHTML = `
    <div class="crumb">${crumb(n.pasta)}</div>
    <div class="status">${tags}${esc(quando(n.atualizado))} · versão ${n.versao}</div>
    <article class="md">${corpo}</article>
    ${r.somente_leitura ? '' : `<div class="barra"><a class="btn pri" href="#e=${encodeURIComponent(n.caminho)}">Editar</a></div>`}`;
}

function editorHTML(extra = '') {
  return `${extra}
    <div class="tabs"><button type="button" id="tabEd" class="on">Editar</button><button type="button" id="tabPv">Prévia</button></div>
    <textarea class="ed" id="ed" spellcheck="true" autocapitalize="sentences"></textarea>
    <article class="md" id="pv" hidden></article>
    <div id="msg"></div>`;
}

function ligarEditor(texto, montar) {
  const ed = el('ed');
  ed.value = texto;
  const original = ed.value;
  ed.addEventListener('input', () => { sujo = ed.value !== original; });
  el('tabEd').onclick = () => { el('tabEd').classList.add('on'); el('tabPv').classList.remove('on'); ed.hidden = false; el('pv').hidden = true; };
  el('tabPv').onclick = async () => {
    el('tabPv').classList.add('on'); el('tabEd').classList.remove('on');
    el('pv').innerHTML = await renderizar(montar(ed.value)); ed.hidden = true; el('pv').hidden = false;
  };
  return () => ed.value !== original;
}

function mostrarErro(r, extra = '') { el('msg').innerHTML = `<div class="aviso err">${esc(erroTexto(r))}${extra}</div>`; }

async function editar(caminho) {
  titulo('Editar · ' + nomeDe(caminho));
  el('voltar').href = '#n=' + encodeURIComponent(caminho);
  tela.innerHTML = '<div class="vazio">Carregando…</div>';
  const r = await api({ action: 'ler', caminho });
  if (!r.ok) { tela.innerHTML = `<div class="aviso err">${esc(erroTexto(r))}</div>`; return; }
  if (r.somente_leitura) { tela.innerHTML = `<div class="aviso err">${ERROS.somente_leitura}</div>`; return; }
  const n = r.nota;
  let topo = '', livre = n.conteudo;
  if (r.gerada) { const i = n.conteudo.indexOf(MARCA) + MARCA.length; topo = n.conteudo.slice(0, i); livre = n.conteudo.slice(i); }
  const avisos = [
    r.gerada ? `<details class="topo"><summary>Parte gerada pelo PC (não editável)</summary><pre>${esc(topo)}</pre></details>` : '',
    r.oculto ? '<div class="aviso">Esta nota tem trechos [oculto] (segredos que ficaram só no PC). Se salvar, o PC não sobrescreve a nota dele: guarda a sua versão como cópia “(conflito app …)” ao lado.</div>' : '',
    n.pendente_pc ? '<div class="aviso">Já há uma edição desta nota esperando o PC; esta substitui aquela.</div>' : '',
  ].join('');
  tela.innerHTML = `<div class="crumb">${crumb(n.pasta)} › <b>${esc(n.titulo)}</b></div>` + editorHTML(avisos) +
    `<div class="barra"><a class="btn" href="#n=${encodeURIComponent(caminho)}">Cancelar</a><button class="btn pri" id="salvar" type="button">Salvar</button></div>`;
  const montar = v => r.gerada ? topo + v : v;
  const mudou = ligarEditor(livre, montar);
  el('salvar').onclick = async () => {
    if (!mudou()) { sujo = false; location.hash = 'n=' + encodeURIComponent(caminho); return; }
    el('salvar').disabled = true; el('salvar').textContent = 'Salvando…';
    const s = await api({ action: 'salvar', caminho, conteudo: montar(el('ed').value), versao: n.versao });
    el('salvar').disabled = false; el('salvar').textContent = 'Salvar';
    if (s.ok) { sujo = false; location.hash = 'n=' + encodeURIComponent(caminho); return; }
    if (s.error === 'conflito') {
      el('msg').innerHTML = `<div class="aviso err">A nota mudou depois que você abriu (${s.origem === 'app' ? 'no app, em outro aparelho' : 'o PC mandou uma versão nova'}, ${esc(quando(s.atualizado))}). Seu texto continua aqui: copie, abra a nota de novo e aplique.
        <div class="row" style="margin-top:8px"><button class="btn" id="copiar" type="button">Copiar meu texto</button><a class="btn" href="#n=${encodeURIComponent(caminho)}">Ver a versão atual</a></div></div>`;
      el('copiar').onclick = async () => { try { await navigator.clipboard.writeText(el('ed').value); el('copiar').textContent = 'Copiado'; } catch (_) { el('ed').select(); } };
      return;
    }
    mostrarErro(s);
  };
}

async function nova(pastaSugerida) {
  titulo('Nova nota');
  el('voltar').href = '#';
  tela.innerHTML = '<div class="vazio">Carregando…</div>';
  try { await carregarPastas(); } catch (e) { tela.innerHTML = `<div class="aviso err">${esc(erroTexto(e))}</div>`; return; }
  const opcoes = [CAIXA, ...pastas.map(p => p.pasta).filter(p => p !== CAIXA && p !== FONTES && !p.startsWith(FONTES + '/'))];
  const escolhida = opcoes.includes(pastaSugerida) ? pastaSugerida : CAIXA;
  const hoje = new Date().toLocaleDateString('sv-SE');
  tela.innerHTML = `
    <label class="campo"><span>Pasta (sem tema claro: Caixa de entrada)</span><select id="pasta">${opcoes.map(p => `<option${p === escolhida ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
    <label class="campo"><span>Nome da nota (único no cérebro)</span><input id="nome" maxlength="150" autocomplete="off" placeholder="Ex.: Impressora Epson"></label>
    ${editorHTML()}
    <div class="barra"><a class="btn" href="#">Cancelar</a><button class="btn pri" id="criar" type="button">Criar</button></div>`;
  const ed = el('ed');
  const modelo = t => `---\ntags: []\natualizado: ${hoje}\n---\n\n# ${t}\n\n`;
  ligarEditor(modelo(''), v => v);
  el('nome').addEventListener('input', () => {
    const t = el('nome').value.trim();
    if (/^---\ntags: \[\]\natualizado: [\d-]+\n---\n\n# .*\n\n$/.test(ed.value)) ed.value = modelo(t);
    sujo = true;
  });
  el('criar').onclick = async () => {
    const titulo_ = el('nome').value.trim();
    if (!titulo_) { mostrarErro({ error: 'bad_request' }); el('nome').focus(); return; }
    el('criar').disabled = true;
    const r = await api({ action: 'criar', pasta: el('pasta').value, titulo: titulo_, conteudo: ed.value });
    el('criar').disabled = false;
    if (!r.ok) { mostrarErro(r); return; }
    sujo = false; pastas = null;
    location.hash = 'n=' + encodeURIComponent(r.caminho);
  };
}

iniciar().catch(e => { tela.innerHTML = `<div class="aviso err">Não abriu: ${esc(e?.message || e)}</div>`; });
