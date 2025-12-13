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
     }

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
         // Keep GitHub Pages paths stable: strip trailing slashes (except root)
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
       const setThumbTo = (a, show = true) => {
         if (!a){
           menu.style.setProperty('--menu-thumb-o', '0');
           return;
         }
         const mr = menu.getBoundingClientRect();
         const r  = a.getBoundingClientRect();

         // Wider thumb: pad is controlled by CSS var --menu-thumb-pad
         const padStr = getComputedStyle(menu).getPropertyValue('--menu-thumb-pad').trim();
         const padNum = parseFloat(padStr);
         const pad = Number.isFinite(padNum) ? padNum : 10;

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

       // Initial state: show current page highlight (except Legal) without first-frame transition glitch
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
