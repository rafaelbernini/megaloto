import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || '/api/megasena'

function formatNumber(n) { return String(n).padStart(2, '0') }

function computeFrequencies(history) {
  const freq = Array(61).fill(0)
  history.forEach(({ item }) => {
    const dezenas = item?.listaDezenas || []
    dezenas.forEach((d) => {
      const num = parseInt(d, 10)
      if (num >= 1 && num <= 60) freq[num]++
    })
  })
  return freq
}

function weightedPickUnique(freq, k = 6) {
  const picks = new Set()
  const baseWeight = 0.1
  while (picks.size < k) {
    const pool = []
    for (let n = 1; n <= 60; n++) {
      if (picks.has(n)) continue
      const weight = (freq[n] || 0) + baseWeight
      pool.push({ n, w: weight })
    }
    if (pool.length === 0) break
    const sum = pool.reduce((acc, p) => acc + p.w, 0)
    let r = Math.random() * sum
    for (const p of pool) {
      r -= p.w
      if (r <= 0) { picks.add(p.n); break }
    }
  }
  return Array.from(picks).sort((a, b) => a - b)
}

export default function App() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [palpites, setPalpites] = useState([])
  const [qtdPalpites, setQtdPalpites] = useState(1)

  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10) })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))

  const [isMobile, setIsMobile] = useState(false)
  const [mobileDateTemp, setMobileDateTemp] = useState(() => ({ from: fromDate, to: toDate }))
  const [showMobileDateModal, setShowMobileDateModal] = useState(false)

  const freq = useMemo(() => computeFrequencies(history), [history])

  const historyWithViradaFlag = useMemo(() => {
    let seen = false
    return history.map((h) => {
      if (h?.isVirada && !seen) { seen = true; return { ...h, showVirada: true } }
      return { ...h, showVirada: false }
    })
  }, [history])

  async function fetchHistory() {
    setLoading(true); setError('')
    try {
      const qs = new URLSearchParams({ from: fromDate, to: toDate }).toString()
      const res = await fetch(`${API_BASE}/history?${qs}`)
      if (!res.ok) { let msg = `HTTP ${res.status}`; try { const t = await res.text(); if (t) msg += ` - ${t}` } catch (e) { }; setError('Falha ao carregar dados: ' + msg); setHistory([]); return }
      const data = await res.json()
      setHistory(Array.isArray(data) ? data : [])
    } catch (e) { setError('Falha ao carregar dados.') } finally { setLoading(false) }
  }

  useEffect(() => { const check = () => setIsMobile(window.matchMedia('(max-width:720px)').matches); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check) }, [])
  useEffect(() => { fetchHistory() }, [])

  function gerarPalpite() { const n = Math.max(1, Math.min(50, Number(qtdPalpites || 1))); const sets = []; for (let i = 0; i < n; i++) { const picks = weightedPickUnique(freq, 6); sets.push(picks.map(formatNumber)) } setPalpites(sets) }

  const copyToClipboard = (nums) => { navigator.clipboard.writeText(nums.join(' - ')); alert('Números copiados!') }
  const shareNumbers = (nums, platform) => { const text = `Meus palpites da sorte: ${nums.join(' - ')}`; const url = window.location.origin; let shareUrl = ''; switch (platform) { case 'whatsapp': shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`; break; case 'facebook': shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`; break; case 'instagram': copyToClipboard(nums); alert('Números copiados! Abra o Instagram e cole nos seus Stories.'); return } if (shareUrl) window.open(shareUrl, '_blank') }

  const openMobileDateModal = () => { setMobileDateTemp({ from: fromDate, to: toDate }); setShowMobileDateModal(true) }
  const applyMobileDates = () => { setFromDate(mobileDateTemp.from); setToDate(mobileDateTemp.to); setShowMobileDateModal(false); fetchHistory() }

  return (
    <div className="container">
      <header className="header"><h1>Mega Loto da Sorte</h1><p className="subtitle">Atraia a prosperidade com palpites baseados em dados reais.</p></header>
      {error && <div className="error-banner">{error}</div>}

      <section className="controls-card"><div className="controls-grid">
        <div className="control-group"><label>Início do Período</label><button className="input-styled" onClick={openMobileDateModal}>{fromDate.split('-').reverse().join('/')}</button></div>
        <div className="control-group"><label>Fim do Período</label><button className="input-styled" onClick={openMobileDateModal}>{toDate.split('-').reverse().join('/')}</button></div>
        <div className="control-group"><label>Quantidade</label><input type={isMobile ? 'tel' : 'number'} className="input-styled" value={qtdPalpites} onChange={(e) => setQtdPalpites(e.target.value.replace(/[^0-9]/g, ''))} min="1" max="50" inputMode="numeric" pattern="[0-9]*" /></div>
        <button className="btn btn-primary" onClick={gerarPalpite} disabled={loading}>✨ Gerar Sorte</button>
        <button className="btn btn-secondary" onClick={fetchHistory} disabled={loading}>🔄 Atualizar</button>
      </div></section>

      {loading && <div className="loading-overlay"><div className="loading-card"><svg viewBox="0 0 64 64" className="icon-clover" aria-hidden="true"><path d="M32 12c4 0 8 3 8 7s-4 8-8 8-8-4-8-8 4-7 8-7zM16 28c4 0 8 3 8 7s-4 8-8 8-8-4-8-8 4-7 8-7zM48 28c4 0 8 3 8 7s-4 8-8 8-8-4-8-8 4-7 8-7zM32 44c4 0 8 3 8 7s-4 8-8 8-8-4-8-8 4-7 8-7z" fill="#2b7aeb" /></svg><div className="loading-text">Carregando...</div></div></div>}

      {palpites.length > 0 && (
        <section className="palpite-section">
          <h2 className="section-title">🍀 Números da Sorte</h2>
          <div className="palpite-list">
            {palpites.map((set, idx) => (
              <div key={idx} className="palpite-card">
                <div className="palpite-header">
                  <span className="palpite-tag">Jogo #{idx + 1}</span>
                  <div className="palpite-actions">
                    <button
                      className="btn-icon-sm"
                      onClick={() => copyToClipboard(set)}
                      title="Copiar números"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                    <button
                      className="btn-icon-sm btn-whatsapp"
                      onClick={() => shareNumbers(set, 'whatsapp')}
                      title="Compartilhar no WhatsApp"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.634 1.437h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                    </button>
                  </div>
                </div>
                <div className="dezenas-container">
                  {set.map(n => <span key={n} className="ball">{n}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section><h2 className="section-title">📊 Histórico</h2><div className="history-grid">{historyWithViradaFlag.map(({ item, isVirada, showVirada }) => (<div key={item.numero} className={`history-card ${isVirada ? 'virada' : ''}`}><div className="history-top"><span className="concurso-info">Concurso {item.numero}</span>{showVirada && <span className="badge-virada">VIRADA</span>}<span className="concurso-date">{item.dataApuracao}</span></div><div className="dezenas-container">{item.listaDezenas.map(d => <span key={d} className="ball">{d}</span>)}</div></div>))}</div></section>

      {showMobileDateModal && (<div className="modal-overlay" onClick={() => setShowMobileDateModal(false)}><div className="modal-content" onClick={e => e.stopPropagation()}><div className="mobile-date-picker"><label>Início</label><input type="date" value={mobileDateTemp.from} onChange={e => setMobileDateTemp(s => ({ ...s, from: e.target.value }))} className="input-styled" /><label>Fim</label><input type="date" value={mobileDateTemp.to} onChange={e => setMobileDateTemp(s => ({ ...s, to: e.target.value }))} className="input-styled" /><div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button className="btn btn-secondary" onClick={() => setShowMobileDateModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={applyMobileDates}>OK</button></div></div></div></div>)}

    </div>
  )
}

