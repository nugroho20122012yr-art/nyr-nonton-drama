/* Nyr Nonton Melolo - frontend (tanpa framework) */
const app = document.getElementById('app');
const CHIPS = ['cinta', 'CEO', 'balas dendam', 'sun wukong', 'kerajaan', 'istri'];
const seen = {};      // cache hasil pencarian (buat sinopsis)
let token = 0;        // penanda render terbaru, supaya hasil lama diabaikan

/* ---------- util ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } },
};

async function api(path) {
  const r = await fetch(path);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.success === false) throw new Error(d.error || `Gagal memuat (${r.status})`);
  return d;
}

const img = (src, cls) =>
  `<img class="${cls}" src="${esc(src || '')}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.removeAttribute('src')">`;

const loading = (t = 'Lagi dimuat...') => `<div class="loading">${esc(t)}</div>`;
const errBox = (m) => `<div class="box err"><b>Waduh, gagal.</b><br>${esc(m)}<div style="margin-top:12px"><a class="btn white small" href="#/">Ke beranda</a></div></div>`;

function cardHtml(d) {
  return `<a class="card" href="#/drama/${esc(d.id)}">
    ${img(d.cover, 'poster')}
    <div class="info"><div class="t">${esc(d.title)}</div>${d.platform ? `<div class="m"><span class="tag">${esc(d.platform)}</span></div>` : ''}</div>
  </a>`;
}

/* ---------- riwayat ---------- */
function saveHistory(item) {
  const list = store.get('nnm_history', []).filter((x) => x.id !== item.id);
  list.unshift(item);
  store.set('nnm_history', list.slice(0, 12));
}
const lastEp = (id) => (store.get('nnm_history', []).find((x) => x.id === id) || {}).ep || 1;

/* ---------- halaman: beranda ---------- */
async function viewHome(my, query) {
  const history = store.get('nnm_history', []);
  const q = query || CHIPS[0];

  app.innerHTML = `
    <form class="search" id="f">
      <input id="q" type="search" placeholder="Cari judul drama..." value="${esc(query || '')}" autocomplete="off">
      <button class="btn" type="submit">CARI</button>
    </form>
    <div class="chips">${CHIPS.map((c) => `<button class="chip ${c === q ? 'on' : ''}" data-q="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    ${history.length ? `<h2 class="sec-title">Lanjut Nonton</h2>
      <div class="grid">${history.map((h) => `<a class="card" href="#/watch/${esc(h.id)}/${h.ep}">${img(h.cover, 'poster')}<div class="info"><div class="t">${esc(h.title)}</div><div class="m"><span class="tag">Eps ${h.ep}</span></div></div></a>`).join('')}</div>` : ''}
    <h2 class="sec-title">${query ? 'Hasil: ' + esc(query) : 'Lagi rame: ' + esc(q)}</h2>
    <div id="res"><div class="grid">${'<div class="skeleton"></div>'.repeat(6)}</div></div>`;

  document.getElementById('f').onsubmit = (e) => {
    e.preventDefault();
    const v = document.getElementById('q').value.trim();
    if (v) location.hash = '#/cari/' + encodeURIComponent(v);
  };
  app.querySelectorAll('.chip').forEach((b) => (b.onclick = () => (location.hash = '#/cari/' + encodeURIComponent(b.dataset.q))));

  try {
    const data = await api('/api/search?q=' + encodeURIComponent(q));
    if (my !== token) return;
    data.results.forEach((d) => (seen[d.id] = d));
    document.getElementById('res').innerHTML = data.results.length
      ? `<div class="grid">${data.results.map(cardHtml).join('')}</div>`
      : `<div class="box">Nggak ketemu untuk "${esc(q)}". Coba kata kunci lain, rek.</div>`;
  } catch (e) {
    if (my === token) document.getElementById('res').innerHTML = errBox(e.message);
  }
}

/* ---------- halaman: detail drama ---------- */
async function viewDrama(my, id) {
  app.innerHTML = loading('Ngambil info drama...');
  try {
    const d = await api('/api/drama?id=' + encodeURIComponent(id));
    if (my !== token) return;
    const syn = (seen[id] && seen[id].synopsis) || '';
    const tags = (seen[id] && seen[id].tags) || [];
    const resume = lastEp(id);
    document.title = `${d.title || 'Drama'} - Nyr Nonton Melolo`;
    app.innerHTML = `
      <a class="btn white small" href="#/">&larr; Beranda</a>
      <div class="detail" style="margin-top:16px">
        ${img(d.cover, 'cover')}
        <div>
          <h1>${esc(d.title || 'Tanpa judul')}</h1>
          <div class="row"><span class="tag">${d.totalEpisodes} Episode</span>${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
          ${syn ? `<p class="syn">${esc(syn)}</p>` : ''}
          <div class="row" style="margin-top:12px">
            <a class="btn" href="#/watch/${esc(id)}/1">&#9654; Mulai Eps 1</a>
            ${resume > 1 ? `<a class="btn pink" href="#/watch/${esc(id)}/${resume}">Lanjut Eps ${resume}</a>` : ''}
          </div>
        </div>
      </div>
      <h2 class="sec-title">Daftar Episode</h2>
      <div class="eps">${d.episodes.map((e) => `<a class="ep" href="#/watch/${esc(id)}/${e.episode}">${e.episode}</a>`).join('')}</div>`;
  } catch (e) {
    if (my === token) app.innerHTML = errBox(e.message);
  }
}

/* ---------- halaman: nonton ---------- */
async function viewWatch(my, id, ep) {
  app.innerHTML = loading(`Nyiapin episode ${ep}...`);
  try {
    const d = await api(`/api/episode?id=${encodeURIComponent(id)}&ep=${ep}`);
    if (my !== token) return;

    const quals = d.stream.qualities || [];
    let current = quals.length ? quals[0] : { quality: 'Auto', url: d.stream.url, encrypted: d.stream.encrypted };
    const total = d.totalEpisodes || ep;
    const prev = ep > 1 ? ep - 1 : null;
    const next = ep < total ? ep + 1 : null;
    const auto = store.get('nnm_auto', true);

    document.title = `Eps ${ep} - ${d.title || 'Drama'} - Nyr Nonton Melolo`;
    saveHistory({ id, ep, title: d.title || 'Drama', cover: d.cover });

    app.innerHTML = `
      <a class="btn white small" href="#/drama/${esc(id)}">&larr; Semua episode</a>
      <div class="player-head" style="margin-top:14px"><h1>${esc(d.title || 'Drama')}</h1><span class="tag">Episode ${ep} / ${total}</span></div>
      <div class="player-wrap"><div class="player-box">
        <video id="v" controls playsinline autoplay preload="metadata" referrerpolicy="no-referrer" poster="${esc(d.cover || '')}"></video>
      </div></div>
      <div class="player-ctrl">
        <div id="msg"></div>
        ${quals.length > 1 ? `<div class="chips" id="qs">${quals.map((q, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-i="${i}">${esc(q.quality)}</button>`).join('')}</div>` : ''}
        <div class="row" style="margin-top:10px">
          <a class="btn" href="#/watch/${esc(id)}/${prev || ep}" aria-disabled="${!prev}">&larr; Sebelumnya</a>
          <a class="btn pink" href="#/watch/${esc(id)}/${next || ep}" aria-disabled="${!next}">Lanjut &rarr;</a>
        </div>
        <label class="auto" style="margin-top:14px"><input type="checkbox" id="auto" ${auto ? 'checked' : ''}> Putar episode berikutnya otomatis</label>
      </div>
      <h2 class="sec-title">Episode</h2>
      <div class="eps">${Array.from({ length: total }, (_, i) => `<a class="ep ${i + 1 === ep ? 'now' : ''}" href="#/watch/${esc(id)}/${i + 1}">${i + 1}</a>`).join('')}</div>`;

    const v = document.getElementById('v');
    const msg = document.getElementById('msg');
    const play = (q) => {
      current = q;
      msg.innerHTML = q.encrypted ? '<div class="box err" style="margin-bottom:12px">Stream ini ditandai terenkripsi, jadi mungkin nggak bisa diputar langsung.</div>' : '';
      const t = v.currentTime;
      v.src = q.url || '';
      if (t > 0) v.addEventListener('loadedmetadata', () => { v.currentTime = t; }, { once: true });
      v.play().catch(() => {});
    };
    v.onerror = () => {
      msg.innerHTML = `<div class="box err" style="margin-bottom:12px"><b>Video gagal diputar.</b> Link stream mungkin kedaluwarsa atau diblokir.<div class="row" style="margin-top:10px"><button class="btn white small" id="retry">Coba lagi</button>${current.url ? `<a class="btn white small" href="${esc(current.url)}" target="_blank" rel="noopener noreferrer">Buka langsung</a>` : ''}</div></div>`;
      const r = document.getElementById('retry');
      if (r) r.onclick = () => viewWatch(++token, id, ep);
    };
    v.onended = () => { if (store.get('nnm_auto', true) && next) location.hash = `#/watch/${id}/${next}`; };
    document.getElementById('auto').onchange = (e) => store.set('nnm_auto', e.target.checked);
    const qs = document.getElementById('qs');
    if (qs) qs.querySelectorAll('.chip').forEach((b) => (b.onclick = () => {
      qs.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      play(quals[Number(b.dataset.i)]);
    }));
    play(current);
    window.scrollTo({ top: 0 });
  } catch (e) {
    if (my === token) app.innerHTML = errBox(e.message);
  }
}

/* ---------- router ---------- */
function route() {
  const my = ++token;
  document.title = 'Nyr Nonton Melolo';
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [a, b, c] = parts;
  if (a === 'drama' && b) return viewDrama(my, b);
  if (a === 'watch' && b) return viewWatch(my, b, Math.max(1, parseInt(c, 10) || 1));
  if (a === 'cari' && b) return viewHome(my, decodeURIComponent(b));
  return viewHome(my, '');
}
window.addEventListener('hashchange', route);
route();
