/* Atalho leve para a página financeira dedicada. */
(() => {
  'use strict';
  const icon='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M16.5 7.5c-.7-1.2-2.2-2-4.1-2-2.3 0-4.1 1.2-4.1 3s1.6 2.6 4.1 3.2c2.5.6 4.1 1.4 4.1 3.2s-1.8 3-4.1 3c-1.9 0-3.5-.8-4.3-2"/></svg>';
  function add(){const host=document.querySelector('.head-actions');if(!host||document.getElementById('financeiroBtn'))return;const b=document.createElement('button');b.id='financeiroBtn';b.className='icon-btn';b.type='button';b.title='Painel financeiro';b.setAttribute('aria-label','Abrir painel financeiro');b.innerHTML=icon;b.addEventListener('click',()=>location.href='./financeiro.html');host.insertBefore(b,host.firstChild)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add);else add();
})();