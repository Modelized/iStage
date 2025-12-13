 (function(){
   const body = document.body;
   const base = body.getAttribute('data-base');

   function initNav(){
     const nav    = document.querySelector('.nav');
     const toggle = document.querySelector('.nav-toggle');
     const sheet  = document.getElementById('mobile-sheet');
     const bodyEl = document.body;

     if (toggle && sheet && nav){
       toggle.addEventListener('click', () => {
         const open = nav.classList.toggle('nav--open');
         toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
         sheet.setAttribute('aria-hidden',   open ? 'false' : 'true');
         bodyEl.classList.toggle('no-scroll', open);
       });

       document.addEventListener('keydown', (e) => {
         if (e.key === 'Escape' && nav.classList.contains('nav--open')){
           nav.classList.remove('nav--open');
           toggle.setAttribute('aria-expanded', 'false');
           sheet.setAttribute('aria-hidden', 'true');
           bodyEl.classList.remove('no-scroll');
         }
       });
     }

     const brand = document.querySelector('.brand');
     const logo  = document.querySelector('.brand-logo');
     const txt   = document.querySelector('.brand-text');

     function update(){
       if (brand && logo && txt && logo.naturalWidth > 0){
         brand.classList.add('has-logo');
       }
     }

     if (logo){
       if (logo.complete) update();
       logo.addEventListener('load',  update);
       logo.addEventListener('error', () => {
         if (brand) brand.classList.remove('has-logo');
       });
     }

     initMenuThumb();
     initNavBackdrop();
   }

   function initNavBackdrop(){
     const backdrop = document.querySelector('.nav-backdrop');
     if (!backdrop) return;

     if (backdrop.dataset.backdropInit === '1') return;
     backdrop.dataset.backdropInit = '1';

     let last = null;
     let ticking = false;

     const compute = () => {
       ticking = false;
       const y = window.scrollY || window.pageYOffset || 0;
       const visible = y > 4;

       if (visible !== last){
         backdrop.classList.toggle('is-visible', visible);
         last = visible;
       }
     };

     const onChange = () => {
       if (ticking) return;
       ticking = true;
       requestAnimationFrame(compute);
     };

     compute();
     window.addEventListener('scroll', onChange, { passive:true });
     window.addEventListener('resize', onChange);
     window.addEventListener('orientationchange', onChange);
     window.addEventListener('pageshow', onChange);
   }

   function initMenuThumb(){
     const menu = document.querySelector('ul.menu');
     if (!menu) return;

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

     const links = allLinks.filter(a => !isExcluded(a));
     if (!links.length) return;

     const normPath = (p) => {
       if (!p) return '/';
       const s = p.replace(/\/+/g, '/');
       return (s.length > 1) ? s.replace(/\/+$/, '') : s;
     };

     const currentPath = normPath(location.pathname);
     const onLegalPage = isLegalPath(currentPath);

     allLinks.forEach(a => a.classList.remove('is-current'));

     let current = null;
     for (const a of links){
       try{
         const url = new URL(a.getAttribute('href'), location.origin);
         if (normPath(url.pathname) === currentPath){
           current = a;
           break;
         }
       }catch{}
     }

     if (!onLegalPage && current){
       current.classList.add('is-current');
     }

     const setThumbTo = (a, show = true) => {
       if (!a){
         menu.style.setProperty('--menu-thumb-o', '0');
         return;
       }

       const mr = menu.getBoundingClientRect();
       const r  = a.getBoundingClientRect();
       const ms = getComputedStyle(menu);

       const padStr = ms.getPropertyValue('--menu-thumb-pad').trim();
       const padNum = parseFloat(padStr);
       const pad = Number.isFinite(padNum) ? padNum : 10;

       const borderLeftNum = parseFloat(ms.borderLeftWidth);
       const borderLeft = Number.isFinite(borderLeftNum) ? borderLeftNum : 0;

       const x  = (r.left - mr.left) - borderLeft - pad;
       const w  = r.width + pad * 2;

       menu.style.setProperty('--menu-thumb-x', `${x}px`);
       menu.style.setProperty('--menu-thumb-w', `${w}px`);
       menu.style.setProperty('--menu-thumb-o', show ? '1' : '0');
     };

     const setTargetText = (targetEl) => {
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

     menu.classList.add('thumb-init');
     snapToCurrent();
     requestAnimationFrame(() => menu.classList.remove('thumb-init'));

     const realign = () => {
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

     let raf = 0;
     let target = menu.querySelector('a.is-current') || links[0];
     let leaveTimer = 0;

     const isHoverPointer = (e) => {
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
       leaveTimer = setTimeout(() => {
         delete menu.dataset.thumbHovering;
         snapToCurrent();
       }, 180);
     };

     menu.addEventListener('pointerenter', (e) => {
       if (!isHoverPointer(e)) return;
       cancelLeave();
       menu.dataset.thumbHovering = '1';
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
         delete menu.dataset.thumbHovering;
         snapToCurrent();
         return;
       }
       scheduleLeave();
     });

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

   function initFooter(){
     const yearSpan = document.getElementById('year');
     if (yearSpan){
       yearSpan.textContent = new Date().getFullYear();
     }
   }

   function inject(selector, file, callback){
     const slot = document.querySelector(selector);
     if (!slot || !base) {
       if (typeof callback === 'function') callback();
       return;
     }

     fetch(`${base}/assets/partials/${file}`)
       .then((res) => res.text())
       .then((html) => {
         slot.innerHTML = html;
         if (typeof callback === 'function') callback();
       })
       .catch((err) => {
         console.error('Partial load failed:', file, err);
         if (typeof callback === 'function') callback();
       });
   }

   const hasSlots = document.getElementById('nav-slot') || document.getElementById('footer-slot');

   if (hasSlots && base){
     if (document.getElementById('nav-slot')){
       inject('#nav-slot', 'nav.html', initNav);
     }else{
       initNav();
     }

     if (document.getElementById('footer-slot')){
       inject('#footer-slot', 'footer.html', initFooter);
     }else{
       initFooter();
     }
   }else{
     initNav();
     initFooter();
   }
 })();
