(function () {
  'use strict';

  const TASKS = 'agenda_lagares_v3';
  const APP = 'agenda_lagares_config_v1';
  const SYNC = 'agenda_lagares_github_sync_v1';
  const BACKUP = 'agenda_lagares_backup_pre_sync_v1';
  const REPO = 'LGRSV/agenda-iphone';
  const PATH = 'sync/agenda-protegida.json';
  const text = new TextEncoder();
  const utf8 = new TextDecoder();
  const setItemOriginal = Storage.prototype.setItem;
  let interno = false;
  let timer = null;
  let enviando = false;

  function json(chave, padrao) {
    try { return JSON.parse(localStorage.getItem(chave) || '') || padrao; }
    catch (erro) { return padrao; }
  }

  function salvar(chave, valor) {
    interno = true;
    try { setItemOriginal.call(localStorage, chave, JSON.stringify(valor)); }
    finally { interno = false; }
  }

  function configuracao() {
    const salvo = json(SYNC, {});
    return {
      acesso: String(salvo.acesso || ''),
      senha: String(salvo.senha || ''),
      repositorio: String(salvo.repositorio || REPO),
      arquivo: String(salvo.arquivo || PATH),
      aparelho: String(salvo.aparelho || ('agenda-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8))),
      pronto: Boolean(salvo.pronto),
      remotoEm: String(salvo.remotoEm || ''),
      remotoPendente: Boolean(salvo.remotoPendente)
    };
  }

  function salvarConfiguracao(parcial) {
    const atual = Object.assign(configuracao(), parcial || {});
    salvar(SYNC, atual);
    return atual;
  }

  function pronto(c) {
    return Boolean(c.acesso && c.senha.length >= 10 && c.repositorio && c.arquivo);
  }

  function aviso(mensagem, tipo) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = mensagem;
    el.style.background = tipo === 'erro' ? '#8f2f2f' : (tipo === 'ok' ? '#176b3a' : '#050505');
    el.classList.add('show');
    clearTimeout(window.__agendaSyncToast);
    window.__agendaSyncToast = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  function bytesParaBase64(bytes) {
    let binario = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binario += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
    }
    return btoa(binario);
  }

  function base64ParaBytes(valor) {
    const binario = atob(String(valor || ''));
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
    return bytes;
  }

  async function chave(senha, sal) {
    const base = await crypto.subtle.importKey('raw', text.encode(senha), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: sal, iterations: 150000, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function proteger(dados, senha) {
    const sal = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const segredo = await chave(senha, sal);
    const cifra = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, segredo, text.encode(JSON.stringify(dados)));
    return {
      versao: 1,
      algoritmo: 'AES-GCM/PBKDF2-SHA-256',
      sal: bytesParaBase64(sal),
      iv: bytesParaBase64(iv),
      dados: bytesParaBase64(new Uint8Array(cifra))
    };
  }

  async function abrir(pacote, senha) {
    if (!pacote || pacote.versao !== 1) throw new Error('Arquivo de sincronização inválido.');
    const segredo = await chave(senha, base64ParaBytes(pacote.sal));
    const aberto = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ParaBytes(pacote.iv) },
      segredo,
      base64ParaBytes(pacote.dados)
    );
    return JSON.parse(utf8.decode(new Uint8Array(aberto)));
  }

  function b64Texto(valor) { return bytesParaBase64(text.encode(valor)); }
  function textoB64(valor) { return utf8.decode(base64ParaBytes(valor)); }

  function endpoint(c) {
    return 'https://api.github.com/repos/' + c.repositorio + '/contents/' + c.arquivo.split('/').map(encodeURIComponent).join('/');
  }

  function cabecalhos(c) {
    return {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + c.acesso,
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  async function lerNuvem(c) {
    const resposta = await fetch(endpoint(c), { headers: cabecalhos(c), cache: 'no-store' });
    if (resposta.status === 404) return null;
    if (!resposta.ok) {
      const detalhe = await resposta.json().catch(function () { return {}; });
      throw new Error(detalhe.message || ('Erro de conexão: ' + resposta.status));
    }
    const arquivo = await resposta.json();
    return {
      sha: arquivo.sha,
      pacote: JSON.parse(textoB64(String(arquivo.content || '').replace(/\s/g, '')))
    };
  }

  async function gravarNuvem(c, pacote, sha) {
    const corpo = {
      message: 'Agenda Lagares: sincronizar dados protegidos',
      content: b64Texto(JSON.stringify(pacote, null, 2))
    };
    if (sha) corpo.sha = sha;
    const resposta = await fetch(endpoint(c), {
      method: 'PUT',
      headers: Object.assign(cabecalhos(c), { 'Content-Type': 'application/json' }),
      body: JSON.stringify(corpo)
    });
    if (resposta.ok) return true;
    if (resposta.status === 409) return false;
    const detalhe = await resposta.json().catch(function () { return {}; });
    throw new Error(detalhe.message || ('Falha ao gravar: ' + resposta.status));
  }

  function estado(mensagem, tipo) {
    const el = document.getElementById('agenda-sync-status');
    if (!el) return;
    el.textContent = mensagem;
    el.style.color = tipo === 'erro' ? 'var(--danger)' : (tipo === 'ok' ? 'var(--green)' : 'var(--muted)');
  }

  function atualizarTela() {
    const c = configuracao();
    const acesso = document.getElementById('agenda-sync-token');
    const senha = document.getElementById('agenda-sync-password');
    const repo = document.getElementById('agenda-sync-repo');
    const arquivo = document.getElementById('agenda-sync-path');
    if (acesso && document.activeElement !== acesso) acesso.value = c.acesso ? '••••••••••••' : '';
    if (senha && document.activeElement !== senha) senha.value = c.senha ? '••••••••••' : '';
    if (repo && document.activeElement !== repo) repo.value = c.repositorio;
    if (arquivo && document.activeElement !== arquivo) arquivo.value = c.arquivo;
    if (!pronto(c)) estado('Configure o acesso e a senha de sincronização.', '');
    else if (c.remotoPendente) estado('Existem alterações de outro aparelho. Baixe a nuvem antes de editar.', 'erro');
    else if (c.pronto) estado('Sincronização online ativa.', 'ok');
    else estado('Conexão salva. Envie este aparelho ou baixe a cópia online.', '');
  }

  function instalarPainel() {
    const folha = document.querySelector('#settingsBackdrop .sheet');
    if (!folha || document.getElementById('agenda-sync-panel')) return;
    const painel = document.createElement('section');
    painel.id = 'agenda-sync-panel';
    painel.className = 'field';
    painel.innerHTML = [
      '<span>Sincronização online</span>',
      '<div class="notice">A agenda continua no GitHub. Antes de enviar, as tarefas são criptografadas; não ficam legíveis no repositório.</div>',
      '<label class="field">Token de acesso do GitHub<input id="agenda-sync-token" type="password" autocomplete="off" placeholder="Cole o token neste aparelho"></label>',
      '<label class="field">Senha de sincronização<input id="agenda-sync-password" type="password" autocomplete="new-password" placeholder="Use a mesma no iPhone e no computador"></label>',
      '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;font-weight:800">Opções avançadas</summary>',
      '<label class="field">Repositório<input id="agenda-sync-repo" type="text" autocomplete="off"></label>',
      '<label class="field">Arquivo protegido<input id="agenda-sync-path" type="text" autocomplete="off"></label></details>',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">',
      '<button class="secondary" type="button" id="agenda-sync-save">Salvar acesso</button>',
      '<button class="primary" type="button" id="agenda-sync-send">Enviar este aparelho</button></div>',
      '<button class="secondary" type="button" id="agenda-sync-get" style="width:100%;margin-top:8px">Baixar da nuvem neste aparelho</button>',
      '<div id="agenda-sync-status" class="notice"></div>',
      '<div class="notice" style="font-size:11px">Crie um token limitado ao repositório ' + REPO + ', com permissão Contents: Read and write. Não envie esse token no chat.</div>'
    ].join('');
    const fechar = folha.querySelector('#closeSettings');
    if (fechar) folha.insertBefore(painel, fechar); else folha.appendChild(painel);
    document.getElementById('agenda-sync-save').addEventListener('click', salvarAcesso);
    document.getElementById('agenda-sync-send').addEventListener('click', function () { enviar(true); });
    document.getElementById('agenda-sync-get').addEventListener('click', baixar);
    atualizarTela();
  }

  function salvarAcesso() {
    const anterior = configuracao();
    const acessoDigitado = String(document.getElementById('agenda-sync-token').value || '').trim();
    const senhaDigitada = String(document.getElementById('agenda-sync-password').value || '');
    const repositorio = String(document.getElementById('agenda-sync-repo').value || REPO).trim();
    const arquivo = String(document.getElementById('agenda-sync-path').value || PATH).trim().replace(/^\/+/, '');
    const acesso = acessoDigitado && !acessoDigitado.startsWith('•') ? acessoDigitado : anterior.acesso;
    const senha = senhaDigitada && !senhaDigitada.startsWith('•') ? senhaDigitada : anterior.senha;
    if (!acesso) return estado('Informe o token de acesso.', 'erro');
    if (senha.length < 10) return estado('Use uma senha com pelo menos 10 caracteres.', 'erro');
    if (!/^[^/\s]+\/[^/\s]+$/.test(repositorio)) return estado('Informe o repositório no formato usuário/repositório.', 'erro');
    if (!arquivo) return estado('Informe o arquivo protegido.', 'erro');
    const mudou = anterior.senha !== senha || anterior.repositorio !== repositorio || anterior.arquivo !== arquivo;
    salvarConfiguracao({ acesso: acesso, senha: senha, repositorio: repositorio, arquivo: arquivo, pronto: mudou ? false : anterior.pronto, remotoPendente: false });
    atualizarTela();
    aviso('Acesso de sincronização salvo neste aparelho.', 'ok');
  }

  async function enviar(forcar) {
    const c = configuracao();
    if (!pronto(c)) { instalarPainel(); atualizarTela(); return; }
    if (enviando) return;
    enviando = true;
    estado('Criptografando e enviando a agenda…', '');
    try {
      for (let tentativa = 0; tentativa < 3; tentativa += 1) {
        const remoto = await lerNuvem(c);
        const dataRemota = remoto && remoto.pacote && remoto.pacote.atualizadoEm || '';
        if (!forcar && dataRemota && (!c.remotoEm || dataRemota > c.remotoEm)) {
          salvarConfiguracao({ remotoPendente: true }); atualizarTela();
          return aviso('Existe uma cópia mais nova em outro aparelho. Baixe a nuvem antes de continuar.', 'erro');
        }
        const agora = new Date().toISOString();
        const conteudo = { tarefas: json(TASKS, []), configuracoes: json(APP, {}), atualizadoEm: agora, aparelho: c.aparelho };
        const pacote = { atualizadoEm: agora, aparelho: c.aparelho, protegido: await proteger(conteudo, c.senha) };
        if (await gravarNuvem(c, pacote, remoto && remoto.sha)) {
          salvarConfiguracao({ pronto: true, remotoEm: agora, remotoPendente: false });
          atualizarTela();
          return aviso('Agenda sincronizada online.', 'ok');
        }
      }
      throw new Error('Outro aparelho gravou ao mesmo tempo.');
    } catch (erro) {
      estado('Falha ao enviar: ' + (erro && erro.message ? erro.message : 'verifique o token e a internet.'), 'erro');
      aviso('Não foi possível sincronizar a agenda.', 'erro');
    } finally { enviando = false; }
  }

  async function baixar() {
    const c = configuracao();
    if (!pronto(c)) { instalarPainel(); atualizarTela(); return; }
    estado('Baixando e validando a cópia online…', '');
    try {
      const remoto = await lerNuvem(c);
      if (!remoto) return estado('Nenhuma cópia online foi encontrada ainda.', 'erro');
      const conteudo = await abrir(remoto.pacote.protegido, c.senha);
      if (!conteudo || !Array.isArray(conteudo.tarefas) || typeof conteudo.configuracoes !== 'object') throw new Error('Conteúdo online incompleto.');
      if (!confirm('As tarefas deste aparelho serão substituídas pela cópia online. Uma cópia local de segurança será preservada. Continuar?')) { atualizarTela(); return; }
      salvar(BACKUP, { data: new Date().toISOString(), tarefas: json(TASKS, []), configuracoes: json(APP, {}) });
      salvar(TASKS, conteudo.tarefas);
      salvar(APP, conteudo.configuracoes);
      salvarConfiguracao({ pronto: true, remotoEm: String(remoto.pacote.atualizadoEm || new Date().toISOString()), remotoPendente: false });
      aviso('Agenda baixada. Atualizando…', 'ok');
      setTimeout(function () { location.reload(); }, 500);
    } catch (erro) {
      estado('Falha ao baixar. Confirme a senha de sincronização.', 'erro');
      aviso('Não foi possível abrir a cópia online.', 'erro');
    }
  }

  function agendarEnvio() {
    const c = configuracao();
    if (!pronto(c) || !c.pronto || c.remotoPendente) return;
    clearTimeout(timer);
    timer = setTimeout(function () { enviar(false); }, 1600);
  }

  function observarAlteracoes() {
    Storage.prototype.setItem = function (chave, valor) {
      const retorno = setItemOriginal.apply(this, arguments);
      if (!interno && this === localStorage && (chave === TASKS || chave === APP)) agendarEnvio();
      return retorno;
    };
  }

  async function conferirNuvem() {
    const c = configuracao();
    if (!pronto(c) || !c.pronto || enviando) return;
    try {
      const remoto = await lerNuvem(c);
      const dataRemota = remoto && remoto.pacote && remoto.pacote.atualizadoEm || '';
      if (dataRemota && c.remotoEm && dataRemota > c.remotoEm) {
        salvarConfiguracao({ remotoPendente: true }); atualizarTela();
        aviso('Há atualizações na agenda de outro aparelho.', '');
      }
    } catch (erro) {}
  }

  function iniciar() {
    instalarPainel();
    observarAlteracoes();
    window.setInterval(conferirNuvem, 60000);
    window.addEventListener('focus', conferirNuvem);
    window.addEventListener('online', conferirNuvem);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
