"use strict";

/* ---- Releases renderer (GitHub API) ---- */
(function(){
  const OWNER = 'Modelized';
  const REPO  = 'iStage';
  const list  = document.getElementById('releases-list');

  const groupHTML = (title, inner) => `
    <div class="releases-group" data-group="${title}">
      <h2 class="group-title">${title}</h2>
      <div class="releases-list">${inner}</div>
    </div>`;

  if (list){
    list.innerHTML = [
      groupHTML('Latest Releases',  `<div class="empty small muted">Checking for latest updates...</div>`),
      groupHTML('Previous Releases',`<div class="empty small muted">Checking for previous updates...</div>`)
    ].join('');
  }
  if (!list) return;

  const esc = (s='') => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const fmtDate = iso => {
    try{
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
    }catch(_){ return iso || ''; }
  };
  const fmtSize = bytes => {
    if (bytes == null) return '';
    const units = ['B','KB','MB','GB'];
    let i = 0, n = bytes;
    while (n >= 1024 && i < units.length-1){ n/=1024; i++; }
    return `${n.toFixed(n < 10 && i>0 ? 1 : 0)} ${units[i]}`;
  };

  const stripImages = (md='') =>
    md.replace(/!\[[^\]]*]\([^)]*\)/g, '').replace(/<img[\s\S]*?>/gi, '');

  const mdToHtml = (md='') => {
    md = stripImages(md);
    md = md.replace(/\r\n?|[\u2028\u2029]/g, '\n');
    md = md.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${esc(code)}</code></pre>`);

    const lines = md.split('\n');
    const out = [];
    let inList = false;
    let inKnownIssues = false;
    let knownIssueDetailPending = false;

    const flushList = () => { if (inList){ out.push('</ul>'); inList = false; } };

    for (let raw of lines){
      const line = raw.trimEnd();

      if (/^###\s+/.test(line)){
        flushList();
        inKnownIssues = false;
        knownIssueDetailPending = false;
        out.push(`<h3>${esc(line.replace(/^###\s+/, ''))}</h3>`);
        continue;
      }
      if (/^##\s+/.test(line)){
        flushList();
        const title = line.replace(/^##\s+/, '').trim();
        inKnownIssues = title.toLowerCase() === 'known issues';
        knownIssueDetailPending = false;
        out.push(`<h2${inKnownIssues ? ' class="known-issues-title"' : ''}>${esc(title)}</h2>`);
        continue;
      }
      if (/^#\s+/.test(line)){
        flushList();
        inKnownIssues = false;
        knownIssueDetailPending = false;
        out.push(`<h1>${esc(line.replace(/^#\s+/, ''))}</h1>`);
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)){
        const item = line.replace(/^\s*[-*]\s+/, '');
        if (inKnownIssues){
          flushList();
          out.push(`<h3 class="known-issue-title">${esc(item)}</h3>`);
          knownIssueDetailPending = true;
          continue;
        }
        if (!inList){ out.push('<ul>'); inList = true; }
        out.push(`<li>${esc(item)}</li>`);
        continue;
      }

      if (!line.trim()){ flushList(); continue; }

      flushList();

      let html = esc(line)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');

      const detailClass = inKnownIssues && knownIssueDetailPending ? ' class="known-issue-detail"' : '';
      out.push(`<p${detailClass}>${html}</p>`);
      knownIssueDetailPending = false;
    }
    flushList();
    return out.join('');
  };

  const versionFromTag = (tag = '') => {
    const m = String(tag).match(/\d+/);
    return m ? m[0] : '';
  };

  const tpl = (r, isHighlight = false) => {
    const title = r.name || r.tag_name || 'Untitled';
    const tag   = r.tag_name ? `${r.tag_name}` : '';
    const date  = r.published_at ? fmtDate(r.published_at) : '';
    const asset = (r.assets||[]).find(a => /\.klck$/i.test(a.name)) || (r.assets||[])[0];
    const size  = asset ? fmtSize(asset.size) : '';
    const href  = asset ? asset.browser_download_url : r.html_url;

    const metaText = [date, size].filter(Boolean).join(' • ');

    const ver  = versionFromTag(tag);
    const icon = ver
      ? `<img class="release-icon" src="../assets/img/iStage-${ver}-icon.png" alt="iStage ${ver} Icon" loading="lazy" onerror="this.style.display='none'">`
      : '';

    return `
      <article class="card ${isHighlight ? 'is-highlight' : ''}">
        <header class="release-head">
          ${icon}
          <div class="release-head-text">
            <h3 class="release-title">${esc(title)}</h3>
            <div class="muted small release-meta"><span>${esc(metaText)}</span></div>
          </div>
        </header>
        <div class="prose" style="margin-top:12px">${mdToHtml(r.body||'')}</div>
        <footer class="release-foot">
          <a class="btn btn-blue" href="${href}" ${asset ? 'download' : ''}>Download</a>
        </footer>
      </article>
    `;
  };

  const showState = (msg, role = 'status') => {
    list.innerHTML = `<div class="empty small muted" role="${role}">${esc(msg)}</div>`;
  };

  fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
    headers: { 'Accept': 'application/vnd.github+json' }
  })
  .then(r => r.ok ? r.json() : Promise.reject(`${r.status} ${r.statusText}`))
  .then(items => {
    if (!Array.isArray(items) || !items.length){ showState('No releases found.'); return; }

    const latestByVer = new Map();
    for (const r of items){
      const v = versionFromTag(r.tag_name || '');
      if (!v) continue;
      const prev = latestByVer.get(v);
      const t = new Date(r.published_at || r.created_at || 0).getTime();
      const pt = prev ? new Date(prev.published_at || prev.created_at || 0).getTime() : -Infinity;
      if (!prev || t > pt) latestByVer.set(v, r);
    }

    const versionNum = r => parseInt(versionFromTag(r.tag_name || ''), 10) || 0;
    const latestReleases = Array.from(latestByVer.values())
      .sort((a, b) => versionNum(b) - versionNum(a));

    const timeOf = r => new Date(r.published_at || r.created_at || 0).getTime();
    const previousReleases = items
      .filter(r => {
        const v = versionFromTag(r.tag_name || '');
        return !(v && latestByVer.get(v) === r);
      })
      .sort((a, b) => timeOf(b) - timeOf(a));

    if (!latestReleases.length){ showState('No releases.'); return; }

    const empty = (msg) => `<div class="empty"><p class="small muted">${esc(msg)}</p></div>`;
    const group = (title, arr, emptyMsg) => `
      <div class="releases-group" data-group="${title}">
        <h2 class="group-title">${title}</h2>
        <div class="releases-list">
          ${arr.length ? arr.map((r, i) => tpl(r, title === 'Latest Releases' && i === 0)).join('') : empty(emptyMsg || 'No releases.')}
        </div>
      </div>`;

    list.innerHTML = [
      group('Latest Releases',  latestReleases,  'No releases.'),
      group('Previous Releases', previousReleases, previousReleases.length ? '' : 'No previous releases.')
    ].join('');
  })
  .catch(() => showState('Unable to load.', 'alert'));
})();
