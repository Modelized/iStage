// r20-themecolor.js
// Dynamically sync <meta name="theme-color"> with the section at top (dark vs light)
(() => {
  const meta = document.querySelector('meta[name="theme-color"]') || (() => {
    const m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); return m;
  })();

  const DARK = '#000000', LIGHT = '#f5f5f7';
  const sections = Array.from(document.querySelectorAll('.hero')).map(el => ({
    el, tone: el.classList.contains('hero-26') ? 'dark' :
              el.classList.contains('hero-18') ? 'light' : 'light'
  }));

  function update() {
    const y = window.scrollY + 2; // near top
    // Find the top-most section intersecting viewport top
    let active = sections[0];
    for (const s of sections) {
      const r = s.el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      const bottom = top + r.height;
      if (y >= top && y < bottom) { active = s; break; }
    }
    meta.setAttribute('content', active.tone === 'dark' ? DARK : LIGHT);
    document.documentElement.style.setProperty('--statusbar-bg', active.tone === 'dark' ? DARK : LIGHT);
  }
  update();
  window.addEventListener('scroll', update, {passive:true});
  window.addEventListener('resize', update);
})();