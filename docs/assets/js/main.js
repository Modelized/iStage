
(function(){
  const body = document.body;
  const toggle = document.querySelector('.menu-toggle');
  const panel = document.getElementById('menuPanel');
  const closeBtn = document.querySelector('.menu-close');
  function openMenu(){ body.classList.add('nav-open'); toggle.setAttribute('aria-expanded','true'); panel.setAttribute('aria-hidden','false'); }
  function closeMenu(){ body.classList.remove('nav-open'); toggle.setAttribute('aria-expanded','false'); panel.setAttribute('aria-hidden','true'); }
  toggle&&toggle.addEventListener('click', ()=> body.classList.contains('nav-open')?closeMenu():openMenu());
  closeBtn&&closeBtn.addEventListener('click', closeMenu);
  panel&&panel.addEventListener('click', (e)=>{ if(e.target===panel) closeMenu(); });

  // Releases tabs
  const tabs = document.querySelectorAll('.version-tabs .tab');
  if(tabs.length){
    const qs = new URLSearchParams(location.search); let v = qs.get('version')||'26';
    function select(ver){ document.querySelectorAll('.release-list').forEach(s=>s.style.display=(s.dataset.v===ver)?'block':'none'); tabs.forEach(t=>t.classList.toggle('active',t.dataset.v===ver)); }
    tabs.forEach(t=>t.addEventListener('click',()=>select(t.dataset.v)));
    select(v);
  }
})();