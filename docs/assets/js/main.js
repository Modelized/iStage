
(() => {
  const wrap = document.querySelector('.nav-wrap');
  const toggle = document.getElementById('navToggle');
  const closeBtn = document.getElementById('navClose');
  function open() { wrap.classList.add('open'); }
  function close() { wrap.classList.remove('open'); }
  toggle?.addEventListener('click', () => wrap.classList.toggle('open'));
  closeBtn?.addEventListener('click', close);
  document.addEventListener('keydown', e => { if(e.key==='Escape') close(); });
})();
