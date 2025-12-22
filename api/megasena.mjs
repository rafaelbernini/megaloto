import axios from 'axios';

const CAIXA_BASE = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';
const AXIOS_OPTS = {
  headers: {
    'User-Agent': 'Mozilla/5.0',
    Accept: 'application/json, text/plain, */*',
    Referer: 'https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx',
    Origin: 'https://loterias.caixa.gov.br'
  },
  timeout: 10000
};

const isVirada = (item) => item?.indicadorConcursoEspecial === 1;

const parseBrDate = (s) => {
  if (!s || typeof s !== 'string') return null;
  const parts = s.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return isNaN(d.getTime()) ? null : d;
};

const inRange = (d, from, to) => {
  const t = d?.getTime?.();
  return t != null && t >= from.getTime() && t <= to.getTime();
};

const cache = new Map();

async function fetchWithCache(numero) {
  if (cache.has(numero)) return cache.get(numero);
  try {
    const { data } = await axios.get(`${CAIXA_BASE}/megasena/${numero}`, AXIOS_OPTS);
    const result = { item: data, isVirada: isVirada(data) };
    cache.set(numero, result);
    return result;
  } catch (e) {
    console.error(`Error fetching contest ${numero}:`, e.message);
    return null;
  }
}

async function handleLatest(req, res) {
  try {
    const { data } = await axios.get(`${CAIXA_BASE}/megasena`, AXIOS_OPTS);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ latest: data, isVirada: isVirada(data) }));
  } catch (e) {
    console.error('Latest error:', e.message);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
}

async function handleHistory(req, res, query) {
  const results = [];
  try {
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setFullYear(defaultFrom.getFullYear() - 1);

    const from = query.from ? new Date(query.from) : defaultFrom;
    const to = query.to ? new Date(query.to) : today;

    const { data: latest } = await axios.get(`${CAIXA_BASE}/megasena`, AXIOS_OPTS);
    const current = latest.numero;

    const latestDate = parseBrDate(latest.dataApuracao);
    if (latestDate && inRange(latestDate, from, to)) {
      results.push({ item: latest, isVirada: isVirada(latest) });
    }

    const queue = [];
    for (let n = current - 1; n > 0 && queue.length < 300; n--) queue.push(n);

    const BATCH_SIZE = 5;
    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      const batch = queue.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((n) => fetchWithCache(n)));

      let stop = false;
      for (const r of batchResults) {
        if (!r) continue;
        const rDate = parseBrDate(r.item?.dataApuracao);
        if (rDate) {
          if (rDate.getTime() < from.getTime()) {
            stop = true;
            break;
          }
          if (inRange(rDate, from, to)) results.push(r);
        }
      }
      if (stop) break;
    }

    results.sort((a, b) => b.item.numero - a.item.numero);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(results));
  } catch (e) {
    console.error('History global error:', e.message);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(results));
  }
}

// Very small query parser for function requests
function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const qs = url.substring(idx + 1);
  return Object.fromEntries(qs.split('&').filter(Boolean).map((p) => {
    const [k, v] = p.split('=');
    return [decodeURIComponent(k), decodeURIComponent(v || '')];
  }));
}

export default async function handler(req, res) {
  try {
    const url = req.url || '';
    // Normalize path: function will be called for routes like /api/megasena/history
    if (url.includes('/latest')) return handleLatest(req, res);
    if (url.includes('/history')) {
      const q = parseQuery(url);
      return handleHistory(req, res, q);
    }
    // default: small info
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, routes: ['/api/megasena/latest','/api/megasena/history'] }));
  } catch (err) {
    console.error('Handler error:', err?.message || err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err) }));
  }
}
