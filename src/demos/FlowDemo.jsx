import { useEffect, useRef, useState } from 'react'

/* Демо n8n-воркфлоу: заявка → AI → IF → CRM / Sheets → Telegram.
   🟡 ЗАГЛУШКА — замени на скрин/видео своего воркфлоу или оставь как интерактивную схему */
const NODES = [
  { id: 'hook', x: 20, y: 148, ic: '⚡', c: '#ff6d5a', t: 'Webhook', s: 'заявка с сайта' },
  { id: 'ai', x: 190, y: 148, ic: '✦', c: '#10a37f', t: 'OpenAI', s: 'разбор заявки' },
  { id: 'if', x: 360, y: 148, ic: '◆', c: '#7b61ff', t: 'IF', s: 'бюджет > 50k?' },
  { id: 'crm', x: 540, y: 52, ic: '◎', c: '#2f9bff', t: 'amoCRM', s: 'сделка 🔥' },
  { id: 'sheet', x: 540, y: 244, ic: '▦', c: '#22a565', t: 'Sheets', s: 'в воронку' },
  { id: 'tg', x: 710, y: 148, ic: '✈', c: '#2aabee', t: 'Telegram', s: 'менеджеру' },
]
const W = 150, Hh = 64
const pos = Object.fromEntries(NODES.map((n) => [n.id, n]))
const EDGES = [['hook', 'ai'], ['ai', 'if'], ['if', 'crm'], ['if', 'sheet'], ['crm', 'tg'], ['sheet', 'tg']]
const path = (a, b) => {
  const A = pos[a], B = pos[b], x1 = A.x + W, y1 = A.y + Hh / 2, x2 = B.x, y2 = B.y + Hh / 2, mx = (x1 + x2) / 2
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`
}
const LEADS = [
  { name: 'Мария', type: 'сайт', budget: 80000, msg: 'Нужен сайт для студии йоги' },
  { name: 'Игорь', type: 'бот', budget: 30000, msg: 'Бот для записи в автосервис' },
  { name: 'Света', type: 'автоматизация', budget: 120000, msg: 'Связать сайт, CRM и склад' },
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rub = (n) => n.toLocaleString('ru-RU') + ' ₽'

export default function FlowDemo({ mini = false, paused = false }) {
  const [state, setState] = useState({})
  const [edges, setEdges] = useState({})
  const [log, setLog] = useState([])
  const [toast, setToast] = useState(null)
  const [count, setCount] = useState(127)
  const [running, setRunning] = useState(false)
  const alive = useRef(true), n = useRef(0)

  const run = async () => {
    if (running) return
    setRunning(true); setState({}); setEdges({}); setLog([]); setToast(null)
    const L = LEADS[n.current++ % LEADS.length], hot = L.budget > 50000
    const seq = [
      ['hook', null, `Получена заявка от ${L.name}`, 9],
      ['ai', 'hook-ai', `Тип: ${L.type} · приоритет: ${hot ? 'высокий' : 'обычный'}`, 640],
      ['if', 'ai-if', `Бюджет ${rub(L.budget)} ${hot ? '>' : '<'} 50 000 ₽ → ${hot}`, 2],
      hot ? ['crm', 'if-crm', `Сделка #${4800 + n.current * 7} создана`, 210] : ['sheet', 'if-sheet', 'Строка добавлена в «Воронка»', 180],
      ['tg', hot ? 'crm-tg' : 'sheet-tg', 'Менеджер уведомлён', 95],
    ]
    for (const [id, e, text, ms] of seq) {
      if (!alive.current) return
      if (e) { setEdges((s) => ({ ...s, [e]: 'run' })); await sleep(mini ? 500 : 650); setEdges((s) => ({ ...s, [e]: 'done' })) }
      setState((s) => ({ ...s, [id]: 'run' })); await sleep(mini ? 350 : 500)
      if (!alive.current) return
      setState((s) => ({ ...s, [id]: 'done' })); setLog((l) => [...l, { id, text, ms }])
    }
    setToast(`🔥 ${hot ? 'Горячая' : 'Новая'} заявка: ${L.name} — ${L.type}, ${rub(L.budget)}\n«${L.msg}»`)
    setCount((c) => c + 1); setRunning(false)
  }
  useEffect(() => { alive.current = true; const t = setTimeout(run, 500); return () => { alive.current = false; clearTimeout(t) } }, [])
  useEffect(() => { if (!mini || running || paused) return; const t = setTimeout(run, 2600); return () => clearTimeout(t) }, [running, mini, paused])

  return (
    <div className={`flow ${mini ? 'mini' : ''}`} onPointerDown={(e) => mini || e.stopPropagation()}>
      <div className="flow-top">
        <span className={`flow-status ${running ? 'on' : ''}`}><i />{running ? 'Выполняется…' : 'Активен'}</span>
        <span>Выполнений сегодня: <b>{count}</b></span>
      </div>
      <div className="flow-diagram" tabIndex={mini ? undefined : 0} role={mini ? undefined : "region"} aria-label={mini ? undefined : "Схема: прокрутите вправо, чтобы увидеть все шаги"}>
      <svg viewBox="0 0 880 360" className="flow-svg" aria-label="Схема воркфлоу">
        {EDGES.map(([a, b]) => {
          const k = `${a}-${b}`, st = edges[k]
          return <g key={k} className={`edge ${st || ''}`}>
            <path d={path(a, b)} className="edge-base" />
            {st && <path d={path(a, b)} className="edge-live" pathLength="1" />}
            {st === 'run' && <circle r="6" className="edge-dot"><animateMotion dur={mini ? '0.5s' : '0.65s'} path={path(a, b)} fill="freeze" /></circle>}
          </g>
        })}
        {NODES.map((nd) => (
          <g key={nd.id} className={`node ${state[nd.id] || ''}`} transform={`translate(${nd.x},${nd.y})`} style={{ '--c': nd.c }}>
            <rect width={W} height={Hh} rx="14" className="node-box" />
            <rect x="10" y="12" width="40" height="40" rx="10" className="node-ic" />
            <text x="30" y="39" textAnchor="middle" className="node-ic-t">{nd.ic}</text>
            <text x="60" y="29" className="node-t">{nd.t}</text>
            <text x="60" y="47" className="node-s">{nd.s}</text>
            {state[nd.id] === 'done' && <g transform={`translate(${W - 14},-6)`}><circle r="11" className="node-ok" /><text y="4.5" textAnchor="middle" className="node-ok-t">✓</text></g>}
          </g>
        ))}
      </svg>
      </div>
      {!mini && <p className="flow-scroll-hint">Листай схему вправо, чтобы увидеть все шаги ↔</p>}
      {!mini && (
        <div className="flow-bottom">
          <div className="flow-log">
            {log.map((l, i) => <div key={i}><b>{pos[l.id].t}</b><span>{l.text}</span><i>{l.ms} ms</i></div>)}
            {!log.length && <div className="muted"><span>Ждём заявку…</span></div>}
          </div>
          <div className="flow-side">
            <div className={`flow-toast ${toast ? 'on' : ''}`}><small>Telegram · Менеджер</small>{toast || '…'}</div>
            <button className="btn line" disabled={running} onClick={run}>▶ Новая заявка</button>
          </div>
        </div>
      )}
    </div>
  )
}
