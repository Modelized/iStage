function initMenuThumb(){
  const menu = document.querySelector('ul.menu');
  if (!menu) return;

  // Prevent double-init
  if (menu.dataset.thumbInit === '1') return;
  menu.dataset.thumbInit = '1';

  const allLinks = [...menu.querySelectorAll('a')];

  const isLegalPath = (p) => {
    const s = (p || '').toLowerCase();
    return s.includes('/legal');
  };

  const isExcluded = (a) => {
    if (!a) return true;
    if (a.dataset.noThumb === '1') return true;
    const text = (a.textContent || '').trim().toLowerCase();
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (text === 'legal') return true;
    if (isLegalPath(href)) return true;
    return false;
  };

  // Candidates for the moving thumb (exclude Legal)
  const links = allLinks.filter(a => !isExcluded(a));
  if (!links.length) return;

  const normPath = (p) => {
    if (!p) return '/';
    // Keep GitHub Pages paths stable: collapse repeated slashes & strip trailing slashes (except root)
    const s = p.replace(/\/+/g, '/');
    return (s.length > 1) ? s.replace(/\/+$/, '') : s;
  };

  const currentPath = normPath(location.pathname);
  const onLegalPage = isLegalPath(currentPath);

  // Clear any previous current state
  allLinks.forEach(a => a.classList.remove('is-current'));

  // Find current link among candidates
  let current = null;
  for (const a of links){
    try{
      const url = new URL(a.getAttribute('href'), location.origin);
      if (normPath(url.pathname) === currentPath){
        current = a;
        break;
      }
    }catch{
      // ignore
    }
  }

  // If we are on Legal page, do not mark any menu item current
  if (!onLegalPage && current){
    current.classList.add('is-current');
  }

  // Thumb positioning
  const getThumbPad = () => {
    const padStr = getComputedStyle(menu).getPropertyValue('--menu-thumb-pad').trim();
    const n = parseFloat(padStr);
    return Number.isFinite(n) ? n : 10;
  };

  const setThumbTo = (a, show = true) => {
    if (!a){
      menu.style.setProperty('--menu-thumb-o', '0');
      return;
    }

    const mr = menu.getBoundingClientRect();
    const r  = a.getBoundingClientRect();
    const pad = getThumbPad();

    const x  = (r.left - mr.left) - pad;
    const w  = r.width + pad * 2;

    menu.style.setProperty('--menu-thumb-x', `${x}px`);
    menu.style.setProperty('--menu-thumb-w', `${w}px`);
    menu.style.setProperty('--menu-thumb-o', show ? '1' : '0');
  };

  const setTargetText = (targetEl) => {
    // Base state: slightly dimmed; highlighted item fully opaque
    for (const a of allLinks){
      a.style.color = 'rgba(232,233,236,.72)';
    }
    if (targetEl){
      targetEl.style.color = 'rgba(232,233,236,1)';
    }
  };

  const snapToCurrent = () => {
    const cur = menu.querySelector('a.is-current');
    if (cur){
      setThumbTo(cur, true);
      setTargetText(cur);
    }else{
      setThumbTo(null, false);
      setTargetText(null);
    }
  };

  // Initial state: prevent the first-frame "grow from left" transition
  menu.classList.add('thumb-init');
  snapToCurrent();
  requestAnimationFrame(() => menu.classList.remove('thumb-init'));

  // Realign on resize / font load / layout changes
  const realign = () => {
    // If hovering, keep the hover target; otherwise snap back to current
    if (menu.dataset.thumbHovering) return;
    snapToCurrent();
  };

  window.addEventListener('resize', realign);
  window.addEventListener('orientationchange', realign);
  if (document.fonts?.ready) document.fonts.ready.then(realign);

  if (typeof ResizeObserver !== 'undefined'){
    const ro = new ResizeObserver(realign);
    ro.observe(menu);
  }

  // Hover-follow behavior (sticky snap to nearest item) — mouse + Apple Pencil hover
  let raf = 0;
  let target = menu.querySelector('a.is-current') || links[0];
  let leaveTimer = 0;

  const isHoverPointer = (e) => {
    // Ignore touch so mobile portrait doesn't get "sticky" behavior.
    return e && (e.pointerType === 'mouse' || e.pointerType === 'pen');
  };

  const nearestLinkByX = (clientX) => {
    let best = links[0];
    let bestD = Infinity;
    for (const a of links){
      const r = a.getBoundingClientRect();
      const cx = (r.left + r.right) / 2;
      const d = Math.abs(clientX - cx);
      if (d < bestD){ bestD = d; best = a; }
    }
    return best;
  };

  const tick = () => {
    raf = 0;
    setThumbTo(target, true);
    setTargetText(target);
  };

  const cancelLeave = () => {
    if (leaveTimer){
      clearTimeout(leaveTimer);
      leaveTimer = 0;
    }
  };

  const scheduleLeave = () => {
    cancelLeave();
    // Small delay prevents jitter when the pointer grazes the menu boundary.
    leaveTimer = setTimeout(() => {
      delete menu.dataset.thumbHovering;
      snapToCurrent();
    }, 180);
  };

  // Pointer Events: works for mouse + Apple Pencil hover on iPadOS
  menu.addEventListener('pointerenter', (e) => {
    if (!isHoverPointer(e)) return;
    cancelLeave();
    menu.dataset.thumbHovering = '1';
    // If we're on Legal page, keep thumb hidden until the first move
    if (onLegalPage) menu.style.setProperty('--menu-thumb-o', '0');
  });

  menu.addEventListener('pointermove', (e) => {
    if (!isHoverPointer(e)) return;
    cancelLeave();
    menu.dataset.thumbHovering = '1';

    const next = nearestLinkByX(e.clientX);
    if (next !== target) target = next;
    if (!raf) raf = requestAnimationFrame(tick);
  });

  menu.addEventListener('pointerleave', (e) => {
    if (!isHoverPointer(e)){
      // If touch leaves, just snap silently.
      delete menu.dataset.thumbHovering;
      snapToCurrent();
      return;
    }
    scheduleLeave();
  });

  // Fallback for browsers without Pointer Events (just in case)
  if (!('PointerEvent' in window)){
    menu.addEventListener('mousemove', (e) => {
      menu.dataset.thumbHovering = '1';
      const next = nearestLinkByX(e.clientX);
      if (next !== target) target = next;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    menu.addEventListener('mouseleave', () => {
      delete menu.dataset.thumbHovering;
      snapToCurrent();
    });
  }
}
