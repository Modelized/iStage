"use strict";

(function(){
  const DATA_URL = '../assets/data/compare.json';

  const pickA = document.getElementById('pick-a');
  const pickB = document.getElementById('pick-b');
  const imgA  = document.getElementById('img-a');
  const imgB  = document.getElementById('img-b');
  const compareGrid = document.getElementById('compare-grid');
  const specTable = document.getElementById('spec-table');

  if (!pickA || !pickB || !imgA || !imgB || !compareGrid || !specTable) return;

  const esc = (s='') => String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));

  const normalizeModel = (m = {}) => {
    const name = (typeof m.name === 'string' && m.name.trim()) ? m.name : 'Untitled';
    const img  = (typeof m.img === 'string') ? m.img : '';

    const toText = (v) => {
      if (v == null) return '';
      if (Array.isArray(v)) return v.map(x => String(x == null ? '' : x)).join('\n');
      if (typeof v === 'object'){
        if (Array.isArray(v.lines)) return v.lines.map(x => String(x == null ? '' : x)).join('\n');
        if (Array.isArray(v.value)) return v.value.map(x => String(x == null ? '' : x)).join('\n');
        if (typeof v.text === 'string') return v.text;
      }
      return String(v);
    };

    let specs = [];

    if (Array.isArray(m.specs)){
      specs = m.specs
        .filter(x => x && typeof x === 'object')
        .map(x => ({
          k: String((x.label ?? x.k ?? x.key ?? '')).trim(),
          v: toText(x.v ?? x.value ?? '')
        }))
        .filter(x => x.k);

    }else if (m.specs && typeof m.specs === 'object' && !Array.isArray(m.specs)){
      specs = Object.entries(m.specs)
        .map(([k, v]) => ({ k: String(k || '').trim(), v: toText(v).trim() }))
        .filter(x => x.k);

    }else if (m.features && typeof m.features === 'object' && !Array.isArray(m.features)){
      specs = Object.entries(m.features)
        .map(([k, v]) => ({ k: String(k || '').trim(), v: toText(v).trim() }))
        .filter(x => x.k);

    }else if (Array.isArray(m.rows) || Array.isArray(m.items)){
      const arr = Array.isArray(m.rows) ? m.rows : m.items;
      specs = arr
        .filter(x => x && typeof x === 'object')
        .map(x => ({
          k: String((x.label ?? x.k ?? x.key ?? x.title ?? '')).trim(),
          v: toText(x.v ?? x.value ?? x.text ?? '').trim()
        }))
        .filter(x => x.k);
    }

    return { name, img, specs };
  };

  const buildSpecKeys = (models, keys) => {
    const out = [];
    const seen = new Set();
    for (const id of keys){
      const m = models[id];
      if (!m || !Array.isArray(m.specs)) continue;
      for (const s of m.specs){
        const k = String(s.k || '').trim();
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(k);
      }
    }
    return out;
  };

  const valueMapFor = (model) => {
    const map = new Map();
    for (const s of (model.specs || [])){
      const k = String(s.k || '').trim();
      if (!k) continue;
      map.set(k, String(s.v ?? ''));
    }
    return map;
  };

  const renderTable = (aId, bId, MODELS, specKeys) => {
    const ma = MODELS[aId];
    const mb = MODELS[bId];

    setImage(imgA, ma);
    setImage(imgB, mb);

    const amap = valueMapFor(ma || {});
    const bmap = valueMapFor(mb || {});

    const toLines = (v) => {
      const raw = String(v == null ? '' : v);
      const lines = raw
        .split(/\r?\n/)
        .map(t => t.trim());
      const cleaned = lines.filter(t => t.length > 0);
      return cleaned.length ? cleaned : ['-'];
    };

    const padLines = (aLines, bLines) => {
      const n = Math.max(aLines.length, bLines.length);
      while (aLines.length < n) aLines.push('');
      while (bLines.length < n) bLines.push('');
      return [aLines, bLines];
    };

    specTable.innerHTML = specKeys.map((k) => {
      let av = toLines(amap.has(k) ? amap.get(k) : '-');
      let bv = toLines(bmap.has(k) ? bmap.get(k) : '-');
      [av, bv] = padLines(av.slice(), bv.slice());

      const lineHtml = (t) => `<span class="line">${t ? esc(t) : '&nbsp;'}</span>`;
      const aHtml = av.map(lineHtml).join('');
      const bHtml = bv.map(lineHtml).join('');

      return `
        <li class="spec-item">
          <div class="spec-k">${esc(k)}</div>
          <div class="spec-v">${aHtml}</div>
          <div class="spec-v">${bHtml}</div>
        </li>
      `;
    }).join('');

    requestAnimationFrame(() => {
      equalizeSpecLineHeights();
      requestAnimationFrame(equalizeSpecLineHeights);
    });
  };

  const equalizeSpecLineHeights = () => {
    const items = specTable.querySelectorAll('.spec-item');
    if (!items.length) return;

    items.forEach((item) => {
      const cols = item.querySelectorAll('.spec-v');
      if (cols.length < 2) return;

      const aLines = cols[0].querySelectorAll('.line');
      const bLines = cols[1].querySelectorAll('.line');
      const n = Math.max(aLines.length, bLines.length);

      for (let i = 0; i < n; i++) {
        const a = aLines[i];
        const b = bLines[i];
        if (!a || !b) continue;

        a.style.minHeight = '';
        b.style.minHeight = '';

        const ha = Math.ceil(a.getBoundingClientRect().height);
        const hb = Math.ceil(b.getBoundingClientRect().height);
        const h = Math.max(ha, hb);

        a.style.minHeight = h + 'px';
        b.style.minHeight = h + 'px';
      }
    });
  };

  const setImage = (imgEl, m) => {
    const src = (m && typeof m.img === 'string') ? m.img : '';
    imgEl.alt = (m && typeof m.name === 'string') ? m.name : '';

    if (!src){
      imgEl.removeAttribute('src');
      imgEl.style.display = 'none';
      return;
    }

    imgEl.style.display = '';
    imgEl.src = src;
  };

  const fillSelect = (sel, keys, MODELS) => {
    sel.innerHTML = keys.map(k => `<option value="${esc(k)}">${esc(MODELS[k].name)}</option>`).join('');
  };

  fetch(DATA_URL, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject(`${r.status} ${r.statusText}`))
    .then(raw => {
      let src = raw;
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.models){
        src = raw.models;
      }

      const MODELS = {};
      const keys = [];

      if (Array.isArray(src)){
        src.forEach((v, idx) => {
          if (!v || typeof v !== 'object') return;
          const id = String(v.id ?? v.key ?? v.slug ?? v.version ?? idx);
          const nm = normalizeModel(v);
          MODELS[id] = nm;
          keys.push(id);
        });
      }else{
        for (const [k, v] of Object.entries(src || {})){
          if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
          const nm = normalizeModel(v);
          MODELS[String(k)] = nm;
          keys.push(String(k));
        }
      }

      if (!keys.length) throw new Error('No models found in compare data.');

      let specKeys = buildSpecKeys(MODELS, keys);

      const rowsSrc = (
        (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.rows)) ? raw.rows :
        (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.specRows)) ? raw.specRows :
        (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.items)) ? raw.items :
        null
      );

      const rowToKey = (row) => {
        if (!row || typeof row !== 'object') return '';
        return String(row.label ?? row.k ?? row.key ?? row.title ?? row.name ?? '').trim();
      };

      const rowValueFor = (row, modelId, modelIndex) => {
        if (!row || typeof row !== 'object') return '';

        if (row.values && typeof row.values === 'object' && !Array.isArray(row.values)){
          return row.values[modelId];
        }

        if (Array.isArray(row.values)){
          return row.values[modelIndex];
        }

        if (row[modelId] != null){
          return row[modelId];
        }

        if (row.v && typeof row.v === 'object' && !Array.isArray(row.v)){
          return row.v[modelId];
        }

        if (modelIndex === 0 && row.a != null) return row.a;
        if (modelIndex === 1 && row.b != null) return row.b;

        return '';
      };

      if (!specKeys.length && Array.isArray(rowsSrc) && rowsSrc.length){
        keys.forEach((id) => { MODELS[id].specs = []; });

        specKeys = rowsSrc.map(rowToKey).filter(Boolean);

        rowsSrc.forEach((row) => {
          const k = rowToKey(row);
          if (!k) return;

          keys.forEach((id, idx) => {
            const val = rowValueFor(row, id, idx);
            MODELS[id].specs.push({ k, v: (val == null || String(val).trim() === '') ? '-' : String(val) });
          });
        });
      }

      if (!specKeys.length){
        specKeys = ['—'];
        keys.forEach((id) => {
          if (!Array.isArray(MODELS[id].specs) || !MODELS[id].specs.length){
            MODELS[id].specs = [{ k: '—', v: '-' }];
          }
        });
      }

      let a = keys[0];
      let b = keys[1] || keys[0];
      if (a === b && keys.length > 1) b = keys[1];

      fillSelect(pickA, keys, MODELS);
      fillSelect(pickB, keys, MODELS);

      const render = () => {
        pickA.value = a;
        pickB.value = b;
        renderTable(a, b, MODELS, specKeys);
      };

      const setA = (next) => {
        next = String(next);
        if (!MODELS[next]) return;
        if (next === b){
          const prevA = a;
          a = next;
          b = prevA;
        }else{
          a = next;
        }
        render();
      };

      const setB = (next) => {
        next = String(next);
        if (!MODELS[next]) return;
        if (next === a){
          const prevB = b;
          b = next;
          a = prevB;
        }else{
          b = next;
        }
        render();
      };

      pickA.addEventListener('change', () => setA(pickA.value));
      pickB.addEventListener('change', () => setB(pickB.value));

      let resizeT;
      window.addEventListener('resize', () => {
        clearTimeout(resizeT);
        resizeT = setTimeout(equalizeSpecLineHeights, 80);
      }, { passive: true });

      render();

    })
    .catch(() => {
      compareGrid.innerHTML = `<div class="compare-state small muted" role="alert">Unable to load.</div>`;
    });
})();
