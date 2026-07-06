/* =========================================================================
   sync.js — backup e sincronização na nuvem (Gist secreto do GitHub).
   Guarda tarefas, notas e treinos criptografados (AES-GCM) num Gist privado,
   para os dados sobreviverem mesmo se o iPhone limpar o armazenamento local.
   - Botão ☁️ na barra abre as configurações (token + senha).
   - Envia sozinho quando você edita (debounce) e recupera ao abrir.
   Enhancement autossuficiente; não altera o núcleo do app.
   ========================================================================= */
(() => {
  'use strict';

  const TASKS = 'agenda_lagares_v3';
  const NOTES = 'agenda_notas_v1';
  const TLOGS = 'agenda_treino_logs_v1';
  const TMETA = 'agenda_treino_meta_v1';
  const APP = 'agenda_lagares_config_v1';
  const RULES = 'agenda_lagares_rules_v1';
  const JKEYS = 'jarvis_keys';
  const SYNC = 'agenda_lagares_gitsync_v1';
  const WATCH = [TASKS, NOTES, TLOGS, TMETA, APP, RULES, JKEYS];
  const FILE = 'agenda-lagares.json';
  const DIALOG_ID = 'syncDialog';
  const STYLE_ID = 'syncStyles';

  const text = new TextEncoder(), utf8 = new TextDecoder();
  const setItemOriginal = Storage.prototype.setItem;
  let interno = false, timer = null, enviando = false, dialogEl = null;

  const json = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v == null ? d : v; } catch (_) { return d; } };
  function salvar(k, v) { interno = true; try { setItemOriginal.call(localStorage, k, typeof v === 'string' ? v : JSON.stringify(v)); } finally { interno = false; } }
  function newDeviceId() { return 'ag-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function cfg() {
    const s = json(SYNC, {}) || {};
    return {
      token: String(s.token || ''), senha: String(s.senha || ''), gistId: String(s.gistId || ''),
      aparelho: String(s.aparelho || newDeviceId()), pronto: Boolean(s.pronto),
      remotoEm: String(s.remotoEm || ''), remotoPendente: Boolean(s.remotoPendente)
    };
  }
  function setCfg(p) { const a = Object.assign(cfg(), p || {}); salvar(SYNC, a); return a; }
  const pronto = c => Boolean(c.token && c.senha.length >= 8);

  /* ------------------------------ cripto -------------------------------- */
  function b2b64(b) { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, Math.min(i + 0x8000, b.length))); return btoa(s); }
  function b64b(v) { const bin = atob(String(v || '')); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }
  async function chave(senha, sal) {
    const base = await crypto.subtle.importKey('raw', text.encode(senha), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function proteger(dados, senha) {
    const sal = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const k = await chave(senha, sal);
    const cifra = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, text.encode(JSON.stringify(dados)));
    return { versao: 1, sal: b2b64(sal), iv: b2b64(iv), dados: b2b64(new Uint8Array(cifra)) };
  }
  async function abrir(p, senha) {
    if (!p || p.versao !== 1) throw new Error('pacote inválido');
    const k = await chave(senha, b64b(p.sal));
    const a = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64b(p.iv) }, k, b64b(p.dados));
    return JSON.parse(utf8.decode(new Uint8Array(a)));
  }

  /* ------------------------------ gist api ------------------------------ */
  const headers = c => ({ 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + c.token, 'X-GitHub-Api-Version': '2022-11-28' });
  async function gistCreate(c, content) {
    const r = await fetch('https://api.github.com/gists', { method: 'POST', headers: Object.assign(headers(c), { 'Content-Type': 'application/json' }), body: JSON.stringify({ description: 'Agenda Lagares — backup criptografado', public: false, files: { [FILE]: { content } } }) });
    if (!r.ok) throw new Error('criar gist ' + r.status);
    return (await r.json()).id;
  }
  async function gistUpdate(c, content) {
    const r = await fetch('https://api.github.com/gists/' + c.gistId, { method: 'PATCH', headers: Object.assign(headers(c), { 'Content-Type': 'application/json' }), body: JSON.stringify({ files: { [FILE]: { content } } }) });
    if (r.status === 404) return false;
    if (!r.ok) throw new Error('gravar gist ' + r.status);
    return true;
  }
  // reencontra o gist do backup pelo nome do arquivo (usado quando o
  // gistId foi perdido, ex.: o iOS limpou o armazenamento do app)
  async function gistFind(c) {
    try {
      const r = await fetch('https://api.github.com/gists?per_page=100', { headers: headers(c), cache: 'no-store' });
      if (!r.ok) return '';
      const list = await r.json();
      if (!Array.isArray(list)) return '';
      const hit = list.find(g => g && g.files && g.files[FILE]);
      return hit ? hit.id : '';
    } catch (_) { return ''; }
  }
  async function gistRead(c) {
    if (!c.gistId) return null;
    const r = await fetch('https://api.github.com/gists/' + c.gistId, { headers: headers(c), cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('ler gist ' + r.status);
    const g = await r.json();
    const f = g.files && g.files[FILE];
    if (!f) return null;
    let content = f.content;
    if (f.truncated && f.raw_url) content = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
    return JSON.parse(content);
  }
  // lista as revisões (histórico) do gist — o GitHub guarda todas as versões
  async function gistHistory(c) {
    if (!c.gistId) return [];
    const r = await fetch('https://api.github.com/gists/' + c.gistId, { headers: headers(c), cache: 'no-store' });
    if (!r.ok) return [];
    const g = await r.json();
    return Array.isArray(g.history) ? g.history : [];
  }
  async function gistReadRevision(c, version) {
    const r = await fetch('https://api.github.com/gists/' + c.gistId + '/' + version, { headers: headers(c), cache: 'no-store' });
    if (!r.ok) return null;
    const g = await r.json();
    const f = g.files && g.files[FILE];
    if (!f) return null;
    let content = f.content;
    if (f.truncated && f.raw_url) content = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
    try { return JSON.parse(content); } catch (_) { return null; }
  }

  function snapshot(c) {
    return { tarefas: json(TASKS, []), notas: json(NOTES, {}), treinoLogs: json(TLOGS, {}), treinoMeta: json(TMETA, {}), config: json(APP, {}), regras: json(RULES, []), jarvisChaves: localStorage.getItem(JKEYS) || '', atualizadoEm: new Date().toISOString(), aparelho: c.aparelho };
  }
  function aplicar(dados) {
    if (Array.isArray(dados.tarefas)) salvar(TASKS, dados.tarefas);
    if (dados.notas && typeof dados.notas === 'object') salvar(NOTES, dados.notas);
    if (dados.treinoLogs && typeof dados.treinoLogs === 'object') salvar(TLOGS, dados.treinoLogs);
    if (dados.treinoMeta && typeof dados.treinoMeta === 'object') salvar(TMETA, dados.treinoMeta);
    if (dados.config && typeof dados.config === 'object') salvar(APP, dados.config);
    if (Array.isArray(dados.regras)) salvar(RULES, dados.regras);
    if (typeof dados.jarvisChaves === 'string' && dados.jarvisChaves) salvar(JKEYS, dados.jarvisChaves);
  }

  /* ------------------------------ ações --------------------------------- */
  async function enviar(forcar) {
    let c = cfg();
    if (!pronto(c)) { openDialog(); return; }
    if (enviando) return; enviando = true; status('Criptografando e enviando…', '');
    try {
      if (!c.gistId) { const id = await gistFind(c); if (id) c = setCfg({ gistId: id }); }
      if (c.gistId) {
        const remoto = await gistRead(c).catch(() => null);
        const dr = remoto && remoto.atualizadoEm || '';
        if (!forcar && dr && (!c.remotoEm || dr > c.remotoEm)) { setCfg({ remotoPendente: true }); refresh(); toast('Há uma cópia mais nova na nuvem — baixe antes.', 'erro'); return; }
      }
      const snap = snapshot(c);
      const pacote = { atualizadoEm: snap.atualizadoEm, aparelho: c.aparelho, protegido: await proteger(snap, c.senha) };
      const content = JSON.stringify(pacote);
      let gistId = c.gistId;
      if (gistId) { if (!await gistUpdate(c, content)) gistId = await gistCreate(c, content); }
      else gistId = await gistCreate(c, content);
      setCfg({ gistId, pronto: true, remotoEm: snap.atualizadoEm, remotoPendente: false }); refresh();
      toast('Agenda salva na nuvem.', 'ok');
    } catch (e) {
      status('Falha ao enviar: ' + (e && e.message ? e.message : 'verifique o token e a internet.'), 'erro');
      toast('Não foi possível salvar na nuvem.', 'erro');
    } finally { enviando = false; }
  }

  async function baixar() {
    let c = cfg();
    if (!pronto(c)) { openDialog(); return; }
    status('Baixando da nuvem…', '');
    try {
      if (!c.gistId) { const id = await gistFind(c); if (id) c = setCfg({ gistId: id }); }
      const remoto = await gistRead(c);
      if (!remoto) { status('Nenhuma cópia na nuvem ainda. Envie este aparelho primeiro.', 'erro'); return; }
      const dados = await abrir(remoto.protegido, c.senha);
      if (!dados || !Array.isArray(dados.tarefas)) throw new Error('conteúdo inválido');
      aplicar(dados);
      setCfg({ pronto: true, remotoEm: String(remoto.atualizadoEm || new Date().toISOString()), remotoPendente: false });
      toast('Agenda restaurada. Atualizando…', 'ok');
      setTimeout(() => location.reload(), 500);
    } catch (e) {
      status('Falha ao baixar. Confira a senha de sincronização.', 'erro');
      toast('Não foi possível abrir a cópia da nuvem.', 'erro');
    }
  }

  function agendarEnvio() {
    const c = cfg();
    if (!pronto(c) || !c.pronto || c.remotoPendente) return;
    clearTimeout(timer);
    timer = setTimeout(() => enviar(false), 1800);
  }

  // ao abrir: recupera se a nuvem tem algo mais novo (ou se o local foi limpo)
  async function conferir() {
    let c = cfg();
    if (!pronto(c) || enviando) return;
    if (!c.gistId) { const id = await gistFind(c); if (!id) return; c = setCfg({ gistId: id }); }
    try {
      const remoto = await gistRead(c);
      const dr = remoto && remoto.atualizadoEm || '';
      if (!dr) return;
      const reais = (json(TASKS, []) || []).filter(t => t && t.text && !/^🏋/.test(t.text));
      const localVazio = reais.length === 0;
      if (localVazio || (c.remotoEm && dr > c.remotoEm) || !c.remotoEm) {
        if (localVazio) {
          const dados = await abrir(remoto.protegido, c.senha).catch(() => null);
          if (dados && Array.isArray(dados.tarefas) && dados.tarefas.some(t => t && t.text && !/^🏋/.test(t.text))) {
            aplicar(dados); setCfg({ remotoEm: dr, remotoPendente: false });
            toast('Dados recuperados da nuvem. Atualizando…', 'ok');
            setTimeout(() => location.reload(), 600); return;
          }
        }
        if (c.remotoEm && dr > c.remotoEm) { setCfg({ remotoPendente: true }); refresh(); toast('Atualização de outro aparelho — abra ☁️ para baixar.', ''); }
      }
    } catch (_) {}
  }

  /* ------------------------------- UI ----------------------------------- */
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${DIALOG_ID}{width:min(calc(100% - 28px),470px);max-height:calc(100dvh - 28px);padding:0;border:1px solid var(--line);border-radius:24px;background:var(--surface);color:var(--text);box-shadow:0 30px 90px rgba(0,0,0,.56)}
      #${DIALOG_ID}::backdrop{background:rgba(0,0,0,.6);backdrop-filter:blur(4px)}
      .sy-modal{padding:20px;overflow-y:auto;max-height:calc(100dvh - 28px)}
      .sy-modal h3{margin:0 0 6px;font-size:22px;letter-spacing:-.045em}
      .sy-modal p{margin:0;color:var(--muted);font-size:13px;line-height:1.45}
      .sy-note{margin:12px 0;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--soft);color:var(--muted);font-size:12px;line-height:1.5}
      .sy-note b{color:var(--text)} .sy-note a{color:var(--accent)}
      .sy-label{display:block;margin:14px 0 6px;color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
      .sy-modal input{width:100%;min-height:46px;padding:11px 12px;border:1px solid var(--line);border-radius:13px;outline:0;background:var(--soft);color:var(--text);font-size:16px}
      .sy-modal input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(117,203,255,.2)}
      .sy-status{margin:14px 0 0;font-size:13px;font-weight:650}
      .sy-btns{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}
      .sy-btn{min-height:46px;border-radius:13px;font-size:14px;font-weight:800}
      .sy-btn.ghost{border:1px solid var(--line);background:var(--soft);color:var(--text)}
      .sy-btn.solid{border:1px solid var(--accent);background:var(--accent);color:var(--accentInk)}
      .sy-btn.wide{grid-column:1/-1}
      .sy-close{margin-top:12px;width:100%;min-height:42px;border:1px solid var(--line);border-radius:13px;background:transparent;color:var(--muted);font-size:13px;font-weight:750}
      .sy-reclist{display:grid;gap:7px;margin-top:10px}
      .sy-reclist:empty{margin:0}
      .sy-recmsg{color:var(--muted);font-size:12px;line-height:1.5;padding:2px 0}
      .sy-rev{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:44px;padding:9px 13px;border:1px solid var(--line);border-radius:12px;background:var(--soft);color:var(--text);text-align:left}
      .sy-rev:active{transform:scale(.98)}
      .sy-rev b{font-size:14px;font-weight:800}
      .sy-rev span{color:var(--muted);font-size:12px;font-weight:650}
    `;
    document.head.appendChild(s);
  }

  function status(msg, tipo) {
    const el = dialogEl && dialogEl.querySelector('#syStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = tipo === 'erro' ? 'var(--danger)' : (tipo === 'ok' ? '#78d88b' : 'var(--muted)');
  }
  function toast(msg, tipo) {
    const t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function refresh() {
    const c = cfg();
    const btn = document.getElementById('syncBtn');
    if (btn) { btn.classList.toggle('sync-pend', c.remotoPendente); btn.title = c.remotoPendente ? 'Há dados novos na nuvem — toque' : (c.pronto ? 'Sincronização ativa' : 'Sincronismo'); }
    if (!dialogEl) return;
    const t = dialogEl.querySelector('#syToken'), s = dialogEl.querySelector('#syPass');
    if (t && document.activeElement !== t) t.value = c.token ? '••••••••••••' : '';
    if (s && document.activeElement !== s) s.value = c.senha ? '••••••••' : '';
    if (!pronto(c)) status('Cole o token e crie uma senha de sincronização.', '');
    else if (c.remotoPendente) status('Há dados mais novos na nuvem. Toque em “Baixar da nuvem”.', 'erro');
    else if (c.pronto) status('Sincronização ativa. Seus dados estão salvos na nuvem.', 'ok');
    else status('Acesso salvo. Toque em “Enviar este aparelho”.', '');
  }

  function ensureDialog() {
    if (dialogEl) return dialogEl;
    dialogEl = document.createElement('dialog');
    dialogEl.id = DIALOG_ID;
    dialogEl.innerHTML = `
      <section class="sy-modal">
        <h3>Sincronismo</h3>
        <p>Salva sua agenda criptografada num Gist secreto do GitHub, para não perder nada se o iPhone limpar o app.</p>
        <div class="sy-note"><b>Token do GitHub</b> — crie em <a href="https://github.com/settings/tokens/new?scopes=gist&description=Agenda%20Lagares" target="_blank" rel="noopener">github.com/settings/tokens</a> marcando só o escopo <b>gist</b>. Cole abaixo (fica só neste aparelho).</div>
        <label class="sy-label" for="syToken">Token do GitHub (escopo gist)</label>
        <input id="syToken" type="password" autocomplete="off" placeholder="ghp_…">
        <label class="sy-label" for="syPass">Senha de sincronização (mín. 8)</label>
        <input id="syPass" type="password" autocomplete="new-password" placeholder="use a mesma em todos os aparelhos">
        <p id="syStatus" class="sy-status"></p>
        <div class="sy-btns">
          <button class="sy-btn ghost" id="sySave" type="button">Salvar acesso</button>
          <button class="sy-btn solid" id="sySend" type="button">Enviar este aparelho</button>
          <button class="sy-btn ghost wide" id="syGet" type="button">Baixar da nuvem</button>
          <button class="sy-btn ghost wide" id="syRecover" type="button">Recuperar versão anterior…</button>
          <button class="sy-btn ghost wide" id="syDevice" type="button">Recuperar deste aparelho</button>
        </div>
        <div id="syRecList" class="sy-reclist"></div>
        <button class="sy-close" id="syClose" type="button">Fechar</button>
      </section>`;
    document.body.appendChild(dialogEl);
    dialogEl.querySelector('#syClose').addEventListener('click', () => dialogEl.close());
    dialogEl.addEventListener('click', e => { if (e.target === dialogEl) dialogEl.close(); });
    dialogEl.querySelector('#sySave').addEventListener('click', salvarAcesso);
    dialogEl.querySelector('#sySend').addEventListener('click', () => enviar(true));
    dialogEl.querySelector('#syGet').addEventListener('click', baixar);
    dialogEl.querySelector('#syRecover').addEventListener('click', recuperar);
    dialogEl.querySelector('#syDevice').addEventListener('click', recuperarAparelho);
    dialogEl.querySelector('#syRecList').addEventListener('click', e => {
      const rev = e.target.closest('[data-rev]');
      if (rev) { aplicarRevisao(rev.dataset.rev); return; }
      const dev = e.target.closest('[data-dev]');
      if (dev) aplicarAparelho(dev.dataset.dev);
    });
    return dialogEl;
  }

  // ---- recuperação a partir das chaves locais deste aparelho -----------
  // varredura COMPLETA: examina todas as chaves do armazenamento em busca de
  // qualquer coisa com cara de tarefa (útil se os dados estiverem sob um nome
  // inesperado, de alguma versão antiga do app)
  let devCache = {};
  function recuperarAparelho() {
    const box = dialogEl.querySelector('#syRecList');
    const esc = s => { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; };
    const taskLike = o => o && typeof o === 'object' && o.text && (o.date || o.day);
    const extract = v => Array.isArray(v) ? v : (v && Array.isArray(v.tarefas)) ? v.tarefas : (v && Array.isArray(v.tasks)) ? v.tasks : null;
    const reais = a => (a || []).filter(t => taskLike(t) && !/^🏋/.test(t.text)).length;
    devCache = {};
    const found = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      let v; try { v = JSON.parse(localStorage.getItem(key)); } catch (_) { continue; }
      const arr = extract(v);
      if (!arr) continue;
      const n = reais(arr);
      if (n > 0) found.push({ key, n, arr });
    }
    found.sort((a, b) => b.n - a.n);
    if (!found.length) {
      box.innerHTML = '<div class="sy-recmsg">Fiz uma varredura completa e <b>nenhuma</b> parte deste aparelho tem tarefas guardadas (fora a academia). Infelizmente elas não ficaram salvas aqui.</div>';
      return;
    }
    let rows = '';
    found.forEach((f, idx) => { devCache[idx] = f.arr; rows += `<button class="sy-rev" type="button" data-dev="${idx}"><b>${f.n} tarefa${f.n === 1 ? '' : 's'}</b><span>${esc(f.key)}</span></button>`; });
    box.innerHTML = `<div class="sy-recmsg">Varredura completa — toque na fonte que tiver suas tarefas:</div>${rows}`;
  }
  function aplicarAparelho(id) {
    const arr = devCache[id];
    if (!arr || !arr.length) return;
    const atual = json(TASKS, []);
    const treino = (Array.isArray(atual) ? atual : []).filter(t => t && /^🏋/.test(t.text || ''));
    const merged = arr.concat(treino.filter(tt => !arr.some(c => c && c.id === tt.id)));
    salvar(TASKS, merged);
    toast('Tarefas recuperadas deste aparelho. Atualizando…', 'ok');
    setTimeout(() => location.reload(), 500);
  }

  // ---- recuperação por histórico de versões ----------------------------
  let revCache = {}; // version -> dados decifrados
  async function recuperar() {
    const c = cfg();
    if (!pronto(c)) { status('Preencha token e senha primeiro.', 'erro'); return; }
    const box = dialogEl.querySelector('#syRecList');
    box.innerHTML = '<div class="sy-recmsg">Procurando versões salvas…</div>';
    try {
      let cc = c;
      if (!cc.gistId) { const id = await gistFind(cc); if (id) cc = setCfg({ gistId: id }); }
      if (!cc.gistId) { box.innerHTML = '<div class="sy-recmsg">Nenhum backup encontrado nesta conta.</div>'; return; }
      const hist = await gistHistory(cc);
      if (!hist.length) { box.innerHTML = '<div class="sy-recmsg">Sem histórico de versões.</div>'; return; }
      const lim = hist.slice(0, 20);
      revCache = {};
      let ok = 0, rows = '';
      for (const h of lim) {
        const ver = h.version; if (!ver) continue;
        const pacote = await gistReadRevision(cc, ver);
        let n = -1;
        if (pacote && pacote.protegido) {
          const dados = await abrir(pacote.protegido, cc.senha).catch(() => null);
          if (dados && Array.isArray(dados.tarefas)) {
            revCache[ver] = dados; ok++;
            n = dados.tarefas.filter(t => t && t.text && !/^🏋/.test(t.text)).length;
          }
        }
        const quando = h.committed_at ? new Date(h.committed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ver.slice(0, 7);
        if (n >= 0) rows += `<button class="sy-rev" type="button" data-rev="${ver}"><b>${n} tarefa${n === 1 ? '' : 's'}</b><span>${quando}</span></button>`;
      }
      if (!ok) { box.innerHTML = '<div class="sy-recmsg">Não consegui abrir as versões — confira se a senha é a mesma de quando ativou o backup.</div>'; return; }
      box.innerHTML = `<div class="sy-recmsg">Toque na versão que tiver suas tarefas:</div>${rows}`;
    } catch (e) {
      box.innerHTML = '<div class="sy-recmsg">Falha ao ler o histórico. Verifique o token e a internet.</div>';
    }
  }
  function aplicarRevisao(ver) {
    const dados = revCache[ver];
    if (!dados) return;
    aplicar(dados);
    const c = cfg();
    setCfg({ remotoEm: String(dados.atualizadoEm || new Date().toISOString()), remotoPendente: false, pronto: true });
    toast('Versão restaurada. Atualizando…', 'ok');
    setTimeout(() => location.reload(), 500);
  }

  function salvarAcesso() {
    const prev = cfg();
    const tv = String(dialogEl.querySelector('#syToken').value || '').trim();
    const sv = String(dialogEl.querySelector('#syPass').value || '');
    const token = tv && !tv.startsWith('•') ? tv : prev.token;
    const senha = sv && !sv.startsWith('•') ? sv : prev.senha;
    if (!token) return status('Cole o token do GitHub.', 'erro');
    if (senha.length < 8) return status('A senha precisa de ao menos 8 caracteres.', 'erro');
    setCfg({ token, senha });
    refresh();
    toast('Acesso salvo neste aparelho.', 'ok');
  }

  function openDialog() { ensureStyles(); ensureDialog(); refresh(); if (!dialogEl.open) dialogEl.showModal(); }

  function ensureButton() {
    const actions = document.querySelector('.head-actions');
    if (!actions || document.getElementById('syncBtn')) return;
    const b = document.createElement('button');
    b.id = 'syncBtn'; b.className = 'icon-btn'; b.type = 'button';
    b.title = 'Sincronismo'; b.setAttribute('aria-label', 'Sincronismo na nuvem');
    b.textContent = '☁️';
    actions.insertBefore(b, actions.firstChild);
    b.addEventListener('click', openDialog);
    refresh();
  }

  // detecta edições locais → agenda envio
  Storage.prototype.setItem = function (chave, valor) {
    const r = setItemOriginal.apply(this, arguments);
    if (!interno && this === localStorage && WATCH.indexOf(chave) >= 0) agendarEnvio();
    return r;
  };

  function init() {
    ensureStyles();
    ensureButton();
    let frame = 0;
    new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(ensureButton); })
      .observe(document.body, { childList: true, subtree: true });
    setTimeout(conferir, 1500);
    window.addEventListener('focus', () => conferir());
    window.addEventListener('online', () => conferir());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
