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

// Último resultado
app.get("/api/megasena/latest", async (req, res) => {
  try {
    const { data } = await axios.get(`${CAIXA_BASE}/megasena`, AXIOS_OPTS);
    res.json({ latest: data, isVirada: isVirada(data) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Resultado por concurso específico
app.get("/api/megasena/:concurso", async (req, res) => {
  try {
    const { concurso } = req.params;
    const { data } = await axios.get(`${CAIXA_BASE}/megasena/${concurso}`, AXIOS_OPTS);
    res.json({ concurso: data, isVirada: isVirada(data) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cache simples em memória
const cache = new Map();

// Helper para buscar com cache
async function fetchWithCache(numero) {
  if (cache.has(numero)) return cache.get(numero);
  try {
    const { data } = await axios.get(`${CAIXA_BASE}/megasena/${numero}`, AXIOS_OPTS);
    const result = { item: data, isVirada: isVirada(data) };
    cache.set(numero, result);
    return result;
  } catch (e) {
    return null;
  }
}

// Histórico por período: otimizado com busca paralela
app.get("/api/megasena/history", async (req, res) => {
  try {
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setFullYear(defaultFrom.getFullYear() - 2);

    const fromStr = req.query.from; // YYYY-MM-DD
    const toStr = req.query.to; // YYYY-MM-DD

    const from = fromStr ? new Date(fromStr) : defaultFrom;
    const to = toStr ? new Date(toStr) : today;

    const rangeFrom = from.getTime() <= to.getTime() ? from : defaultFrom;
    const rangeTo = to.getTime() >= rangeFrom.getTime() ? to : today;

    // Busca o último para saber o range total
    const { data: latest } = await axios.get(`${CAIXA_BASE}/megasena`, AXIOS_OPTS);
    const current = latest.numero;

    const results = [];
    const latestDate = parseBrDate(latest.dataApuracao);
    if (inRange(latestDate, rangeFrom, rangeTo)) {
      results.push({ item: latest, isVirada: isVirada(latest) });
      cache.set(current, results[0]);
    }

    // Identifica quais números de concurso precisamos buscar
    const queue = [];
    for (let n = current - 1; n > 0 && queue.length < 500; n--) {
        queue.push(n);
    }

    // Processa em lotes para não sobrecarregar
    const BATCH_SIZE = 10;
    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      const batch = queue.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(numero => fetchWithCache(numero)));
      
      let reachedEnd = false;
      for (const res of batchResults) {
        if (!res) continue;
        const d = parseBrDate(res.item?.dataApuracao);
        if (d) {
          if (d.getTime() < rangeFrom.getTime()) {
            reachedEnd = true;
            break;
          }
          if (inRange(d, rangeFrom, rangeTo)) {
            results.push(res);
          }
        }
      }
      if (reachedEnd) break;
    }

    results.sort((a, b) => (b.item?.numero || 0) - (a.item?.numero || 0));
    res.json(results);
  } catch (e) {
    res.status(200).json([]);
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Backend running on port ${port}`));

const parseBrDate = (s) => {
  if (!s || typeof s !== 'string') return null
  const [dd, mm, yyyy] = s.split('/')
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  return isNaN(d.getTime()) ? null : d
}

const inRange = (d, from, to) => {
  const t = d?.getTime?.()
  return t != null && t >= from.getTime() && t <= to.getTime()
}