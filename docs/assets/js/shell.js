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
