/**
 * Melolo scraper (via nunodrama.my.id)
 * Node.js >= 18, tanpa dependency.
 * creator: xemoz
 * (versi modul untuk Vercel: tanpa CLI)
 */

const BASE = 'https://nunodrama.my.id';
const CREATOR = 'xemoz';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------- HTTP + rate limit ---------------------------- */

const rate = { remaining: Infinity, resetAt: 0 };

async function http(path, { json = false, retries = 3 } = {}) {
  const url = path.startsWith('http') ? path : BASE + path;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (rate.remaining <= 2 && Date.now() < rate.resetAt) {
      await sleep(Math.min(rate.resetAt - Date.now() + 250, 5000));
    }

    let res;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: json ? 'application/json' : 'text/html,application/xhtml+xml',
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.5',
          Referer: BASE + '/',
        },
        redirect: 'follow',
      });
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(800 * (attempt + 1));
      continue;
    }

    const rem = res.headers.get('x-ratelimit-remaining');
    const reset = res.headers.get('x-ratelimit-reset');
    if (rem !== null) rate.remaining = Number(rem);
    if (reset !== null) rate.resetAt = Date.now() + Number(reset) * 1000;

    if (res.status === 429) {
      const wait = Math.min(Math.max((Number(reset) || 3) * 1000, 2000), 6000);
      await sleep(wait + 250);
      continue;
    }
    if (res.status >= 500 && attempt < retries) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const e = new Error(`HTTP ${res.status} untuk ${url}`);
      e.status = res.status;
      throw e;
    }
    return json ? res.json() : res.text();
  }
  throw new Error('Gagal setelah retry: ' + url);
}

/* ------------------------------ HTML helpers ------------------------------ */

function decodeEntities(s = '') {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function attrs(tagHtml) {
  const out = {};
  const re = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*"([^"]*)")?/g;
  let m;
  while ((m = re.exec(tagHtml))) {
    if (m[2] !== undefined) out[m[1]] = decodeEntities(m[2]);
    else if (!(m[1] in out)) out[m[1]] = true;
  }
  return out;
}

function cleanCover(u) {
  if (!u) return null;
  return u;
}

/* --------------------------------- Search --------------------------------- */

async function search(query, { platform = 'melolo', page } = {}) {
  const qs = new URLSearchParams({ q: query });
  if (page) qs.set('page', String(page));
  const data = await http(`/api/search/${platform}?${qs}`, { json: true });

  const list = Array.isArray(data.dramas) ? data.dramas : [];
  return {
    creator: CREATOR,
    success: data.success !== false,
    query,
    total: list.length,
    results: list.map((d) => ({
      id: d.BookID,
      title: d.BookName,
      cover: cleanCover(d.Cover),
      synopsis: d.Introduction || '',
      tags: d.Tags || [],
      platform: d.Platform || platform,
      url: `${BASE}/detail/${platform}/${d.BookID}`,
      watch: `${BASE}/watch/${platform}/${d.BookID}?ep=1`,
    })),
  };
}

/* ------------------------------ Watch page parse ------------------------------ */

function parseWatch(html, { id, ep, platform = 'melolo' } = {}) {
  const vm = html.match(/<video\b[^>]*id="player"[^>]*>/);
  const v = vm ? attrs(vm[0]) : {};

  const epIdx = [...html.matchAll(/data-ep-index="(\d+)"/g)].map((m) => Number(m[1]));
  const label = html.match(/(\d+)\s*Episode\s*Tersedia/i);
  const totalEpisodes = Math.max(0, ...epIdx, label ? Number(label[1]) : 0);

  const qualities = [];
  const qre = /<[a-z]+\b[^>]*data-quality-option[^>]*>/g;
  let qm;
  while ((qm = qre.exec(html))) {
    const a = attrs(qm[0]);
    if (!a['data-url']) continue;
    qualities.push({
      quality: a['data-label'] || a['data-id'],
      url: a['data-url'],
      encrypted: a['data-encrypted'] === 'true',
    });
  }

  const titleTag = html.match(/<title>([^<]*)<\/title>/);
  const epNow = Number(v['data-ep'] || ep || 1);

  return {
    id: v['data-book'] || id,
    platform: v['data-platform'] || platform,
    title: v['data-title'] || null,
    cover: cleanCover(v['data-cover'] || v.poster),
    episode: epNow,
    totalEpisodes,
    next: v['data-next'] ? BASE + v['data-next'] : null,
    prev: v['data-prev'] ? BASE + v['data-prev'] : null,
    pageTitle: titleTag ? decodeEntities(titleTag[1]) : null,
    stream: {
      kind: v['data-kind'] || null,
      url: v['data-src'] || v['data-encrypt-url'] || null,
      encrypted: v['data-encrypted'] === 'true',
      qualities,
    },
  };
}

/* ------------------------------ Drama / Episode ------------------------------ */

async function getEpisode(id, ep = 1, platform = 'melolo') {
  const html = await http(`/watch/${platform}/${id}?ep=${ep}`);
  const info = parseWatch(html, { id, ep, platform });
  if (!info.stream.url && !info.stream.qualities.length) {
    throw new Error(`Stream tidak ditemukan (id=${id}, ep=${ep}). Cek apakah episode ada.`);
  }
  return { creator: CREATOR, ...info };
}

async function getDrama(id, platform = 'melolo') {
  const html = await http(`/watch/${platform}/${id}?ep=1`);
  const info = parseWatch(html, { id, ep: 1, platform });
  const total = info.totalEpisodes;
  return {
    creator: CREATOR,
    id: info.id,
    platform: info.platform,
    title: info.title,
    cover: info.cover,
    totalEpisodes: total,
    episodes: Array.from({ length: total }, (_, i) => ({
      episode: i + 1,
      watch: `${BASE}/watch/${platform}/${id}?ep=${i + 1}`,
    })),
  };
}

module.exports = { search, getDrama, getEpisode, parseWatch };
