import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:3001/api/megasena'

function formatNumber(n) {
  return String(n).padStart(2, '0')
}

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
      const weight = freq[n] + baseWeight
      pool.push({ n, w: weight })
    }
    const sum = pool.reduce((acc, p) => acc + p.w, 0)
    let r = Math.random() * sum
    for (const p of pool) {
      r -= p.w
      if (r <= 0) {
        picks.add(p.n)
        break
      }
    }
    if (picks.size < k && pool.length === 0) break
  }
  return Array.from(picks).sort((a, b) => a - b)
}

function App() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [palpites, setPalpites] = useState([])
  const [qtdPalpites, setQtdPalpites] = useState(1)
  const [showCalendar, setShowCalendar] = useState(false)

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))

  const [calDate, setCalDate] = useState(new Date())
  const [activeDateType, setActiveDateType] = useState('from')

  const freq = useMemo(() => computeFrequencies(history), [history])

  async function fetchHistory() {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ from: fromDate, to: toDate }).toString()
      const res = await fetch(`${API_BASE}/history?${qs}`)
      const data = await res.json()
      setHistory(Array.isArray(data) ? data : [])
    } catch (e) {
      setError('Falha ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  function gerarPalpite() {
    const n = Math.max(1, Math.min(50, Number(qtdPalpites || 1)))
    const sets = []
    for (let i = 0; i < n; i++) {
      const picks = weightedPickUnique(freq, 6)
      sets.push(picks.map(formatNumber))
    }
    setPalpites(sets)
  }

  const copyToClipboard = (nums) => {
    const text = nums.join(' - ')
    navigator.clipboard.writeText(text)
    alert('Números copiados!')
  }

  const shareNumbers = (nums, platform) => {
    const text = `Meus palpites da sorte: ${nums.join(' - ')}`
    const url = window.location.origin

    let shareUrl = ''
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`
        break
      case 'instagram':
        copyToClipboard(nums)
        alert('Números copiados! Abra o Instagram e cole nos seus Stories.')
        return
    }
    if (shareUrl) window.open(shareUrl, '_blank')
  }

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const years = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i)

  const monthMatrix = useMemo(() => {
    const y = calDate.getFullYear(), m = calDate.getMonth()
    const firstDay = new Date(y, m, 1).getDay()
    const lastDate = new Date(y, m + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push({ day: null })
    for (let d = 1; d <= lastDate; d++) cells.push({ day: d, date: new Date(y, m, d) })
    return cells
  }, [calDate])

  const handleDateSelect = (date) => {
    const dateStr = date.toISOString().slice(0, 10)
    if (activeDateType === 'from') setFromDate(dateStr)
    else setToDate(dateStr)
    setShowCalendar(false)
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Mega Loto da Sorte</h1>
        <p className="subtitle">Atraia a prosperidade com palpites baseados em dados reais.</p>
      </header>

      <section className="controls-card">
        <div className="controls-grid">
          <div className="control-group">
            <label>Início do Período</label>
            <button className="input-styled" onClick={() => { setActiveDateType('from'); setShowCalendar(true); }}>
              {fromDate.split('-').reverse().join('/')}
            </button>
          </div>
          <div className="control-group">
            <label>Fim do Período</label>
            <button className="input-styled" onClick={() => { setActiveDateType('to'); setShowCalendar(true); }}>
              {toDate.split('-').reverse().join('/')}
            </button>
          </div>
          <div className="control-group">
            <label>Quantidade</label>
            <input
              type="number" className="input-styled" value={qtdPalpites}
              onChange={(e) => setQtdPalpites(e.target.value)} min="1" max="50"
            />
          </div>
          <button className="btn btn-primary" onClick={gerarPalpite} disabled={loading}>
            ✨ Gerar Sorte
          </button>
          <button className="btn btn-secondary" onClick={fetchHistory} disabled={loading}>
            🔄 Atualizar
          </button>
        </div>
      </section>

      {palpites.length > 0 && (
        <section className="palpite-section">
          <h2 className="section-title">🍀 Números da Sorte</h2>
          <div className="palpite-list">
            {palpites.map((set, idx) => (
              <div key={idx} className="palpite-card">
                <div className="palpite-header">
                  <span className="palpite-tag">Jogo #{idx + 1}</span>
                  <div className="palpite-actions">
                    <button className="action-btn" title="Copiar" onClick={() => copyToClipboard(set)}>
                      <i className="fa-solid fa-copy"></i>
                    </button>
                    <button className="action-btn" title="WhatsApp" onClick={() => shareNumbers(set, 'whatsapp')}>
                      <i className="fa-brands fa-whatsapp"></i>
                    </button>
                    <button className="action-btn" title="Facebook" onClick={() => shareNumbers(set, 'facebook')}>
                      <i className="fa-brands fa-facebook"></i>
                    </button>
                    <button className="action-btn" title="Instagram" onClick={() => shareNumbers(set, 'instagram')}>
                      <i className="fa-brands fa-instagram"></i>
                    </button>
                  </div>
                </div>
                <div className="dezenas-container">
                  {set.map(num => <span key={num} className="ball">{num}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">📊 Histórico</h2>
        <div className="history-grid">
          {history.map(({ item, isVirada }) => (
            <div key={item.numero} className={`history-card ${isVirada ? 'virada' : ''}`}>
              <div className="history-top">
                <span className="concurso-info">Concurso {item.numero}</span>
                {isVirada && <span className="badge-virada">VIRADA</span>}
                <span className="concurso-date">{item.dataApuracao}</span>
              </div>
              <div className="dezenas-container">
                {item.listaDezenas.map(d => <span key={d} className="ball">{d}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {showCalendar && (
        <div className="modal-overlay" onClick={() => setShowCalendar(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="calendar-header-styled">
              <select className="select-styled" value={calDate.getMonth()} onChange={e => setCalDate(new Date(calDate.getFullYear(), parseInt(e.target.value), 1))}>
                {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select className="select-styled" value={calDate.getFullYear()} onChange={e => setCalDate(new Date(parseInt(e.target.value), calDate.getMonth(), 1))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="calendar-grid">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => <div key={d} className="weekday-header">{d}</div>)}
              {monthMatrix.map((cell, i) => (
                <button
                  key={i} disabled={!cell.day}
                  className={`day-btn ${!cell.day ? 'not-in-month' : ''} ${(activeDateType === 'from' ? fromDate : toDate) === cell.date?.toISOString().slice(0, 10) ? 'active' : ''}`}
                  onClick={() => cell.day && handleDateSelect(cell.date)}
                >
                  {cell.day}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
