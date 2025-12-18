import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());

const CAIXA_BASE = "https://servicebus2.caixa.gov.br/portaldeloterias/api";
const AXIOS_OPTS = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx",
    "Origin": "https://loterias.caixa.gov.br"
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

app.get("/api/megasena/latest", async (req, res) => {
  try {
    const { data } = await axios.get(`${CAIXA_BASE}/megasena`, AXIOS_OPTS);
    res.json({ latest: data, isVirada: isVirada(data) });
  } catch (e) {
    console.error("Latest error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/megasena/history", async (req, res) => {
  const results = [];
  try {
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setFullYear(defaultFrom.getFullYear() - 1);

    const from = req.query.from ? new Date(req.query.from) : defaultFrom;
    const to = req.query.to ? new Date(req.query.to) : today;

    console.log(`History request: from=${from.toISOString()} to=${to.toISOString()}`);

    const { data: latest } = await axios.get(`${CAIXA_BASE}/megasena`, AXIOS_OPTS);
    const current = latest.numero;

    const latestDate = parseBrDate(latest.dataApuracao);
    if (latestDate && inRange(latestDate, from, to)) {
      results.push({ item: latest, isVirada: isVirada(latest) });
    }

    const queue = [];
    for (let n = current - 1; n > 0 && queue.length < 300; n--) {
      queue.push(n);
    }

    const BATCH_SIZE = 5;
    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      const batch = queue.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(n => fetchWithCache(n)));

      let stop = false;
      for (const r of batchResults) {
        if (!r) continue;
        const rDate = parseBrDate(r.item?.dataApuracao);
        if (rDate) {
          if (rDate.getTime() < from.getTime()) {
            stop = true;
            break;
          }
          if (inRange(rDate, from, to)) {
            results.push(r);
          }
        }
      }
      if (stop) break;
    }

    results.sort((a, b) => b.item.numero - a.item.numero);
    console.log(`Returning ${results.length} history items`);
    res.json(results);
  } catch (e) {
    console.error("History global error:", e.message);
    res.status(200).json(results);
  }
});

const port = process.env.PORT || 3001;
// Apenas inicia o servidor se NÃO estiver na produção (Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => console.log(`Backend V2 running on port ${port}`));
}

// Exporta para a Vercel
export default app;