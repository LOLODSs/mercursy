import { useEffect, useId, useRef, useState, useCallback } from 'react'
import { mascot as M, profile, site } from './config.js'
import { useFocusTrap } from './a11y.js'
import { isMobile } from './mq.js'

/* ===== Капля — маскот-ассистент. Собирает бриф и шлёт тебе в Telegram (через M.endpoint) ===== */

export function Drop({ mood = 'idle', className = '' }) {
  const id = useId().replace(/[^\w-]/g, '')
  const ref = useRef(null)
  // моргание: класс на 0.28 с раз в 4.6 с — вне моргания SVG не перерисовывается
  useEffect(() => {
    let t2
    const iv = setInterval(() => { const el = ref.current; if (!el) return; el.classList.add('blinking'); t2 = setTimeout(() => el.classList.remove('blinking'), 300) }, 4600)
    return () => { clearInterval(iv); clearTimeout(t2) }
  }, [])
  return (
    <svg ref={ref} viewBox="0 0 100 112" className={`drop-svg mood-${mood} ${className}`} aria-hidden="true">
      <defs>
        <radialGradient id={`g${id}`} cx="36%" cy="40%" r="78%">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".26" stopColor="#d7dee5" />
          <stop offset=".62" stopColor="#58606a" /><stop offset="1" stopColor="#131518" />
        </radialGradient>
        <linearGradient id={`r${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff9ad5" /><stop offset=".5" stopColor="#9fe8ff" /><stop offset="1" stopColor="#d9ff8a" />
        </linearGradient>
      </defs>
      <g className="drop-body">
        <path d="M50 5 C58 22 91 46 91 73 A41 41 0 0 1 9 73 C9 46 42 22 50 5Z" fill={`url(#g${id})`} stroke={`url(#r${id})`} strokeWidth="2.4" />
        <ellipse cx="33" cy="52" rx="7" ry="13" fill="#fff" opacity=".6" transform="rotate(28 33 52)" />
        <ellipse cx="29" cy="88" rx="7" ry="4" fill="#ff9ad5" opacity=".35" />
        <ellipse cx="71" cy="88" rx="7" ry="4" fill="#ff9ad5" opacity=".35" />
        <g className="drop-eyes">
          <g className="drop-eye"><ellipse cx="38" cy="76" rx="6.5" ry="8.5" fill="#0d0e10" /><circle cx="40.4" cy="72.6" r="2.4" fill="#fff" /></g>
          <g className="drop-eye"><ellipse cx="62" cy="76" rx="6.5" ry="8.5" fill="#0d0e10" /><circle cx="64.4" cy="72.6" r="2.4" fill="#fff" /></g>
        </g>
        <path className="drop-mouth" d="M45 91 Q50 96 55 91" fill="none" stroke="#0d0e10" strokeWidth="2.6" strokeLinecap="round" />
        <ellipse className="drop-o" cx="50" cy="93" rx="3.6" ry="4.2" fill="#0d0e10" />
      </g>
    </svg>
  )
}

const TYPES = ['Хочу сайт', 'Хочу бота', 'Хочу автоматизацию', 'Другое']
const TYPE_NAME = { 'Хочу сайт': 'Сайт', 'Хочу бота': 'Бот', 'Хочу автоматизацию': 'Автоматизация', 'Другое': 'Другое' }
const BUDGETS = ['до 30 000 ₽', '30–80 000 ₽', '80–150 000 ₽', '150 000 ₽+', 'Пока не знаю']
const DEADLINES = ['Срочно (1–3 дня) 🔥', 'До 7 дней', '1–2 недели', 'Не горит']
const FAQ_Q = M.faq.map((f) => f.q)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const validContact = (v) => {
  const s = v.trim()
  return (
    /^@?[\w\d_]{4,}$/.test(s) ||
    /^(https?:\/\/)?(t\.me|telegram\.me)\/[\w\d_]{4,}$/i.test(s) ||
    s.replace(/\D/g, '').length >= 10 ||
    /^\S+@\S+\.\S+$/.test(s)
  )
}

/* шаги брифа: field — куда пишем ответ, chips — быстрые ответы, input — ждём текст */
const STEPS = {
  type: { field: 'type', ask: () => ['Привет! Я Капля 💧 ассистент ' + profile.name + '.', 'Соберу короткий бриф и сразу передам его в Telegram. Займёт минуту. Что нужно?'], chips: [...TYPES, ...FAQ_Q], next: 'task' },
  task: { field: 'task', input: 'Пара предложений о задаче…', ask: (l) => [l.ref ? `Вижу, нужно что-то вроде «${l.ref}» 👀 Опиши задачу в паре предложений — что должно получиться?` : 'Круто! Опиши задачу в паре предложений — что должно получиться?'], next: 'budget', min: 5 },
  budget: { field: 'budget', ask: () => ['Какой бюджет примерно? Это нормально, если пока не знаешь.'], chips: BUDGETS, next: 'deadline' },
  deadline: { field: 'deadline', ask: () => ['Когда нужно запустить?'], chips: DEADLINES, next: 'name' },
  name: { field: 'name', input: 'Имя', ask: () => ['Как к тебе обращаться?'], next: 'contact', min: 2 },
  contact: { field: 'contact', input: '@ник, телефон или почта', ask: (l) => [`Приятно, ${l.name}! Куда ответить? Telegram (@ник), телефон или почта.`], next: 'confirm', validate: validContact, err: 'Хм, не похоже на контакт. Пример: @ivan, +7 999 123-45-67 или mail@site.ru' },
  confirm: { ask: () => ['Проверь, всё верно? 👇'], chips: ['Отправить ✈', 'Заполнить заново'], summary: true },
}

export default function Mascot({ open, setOpen, prefill, chapterId, onGoWorks }) {
  const [msgs, setMsgs] = useState([])
  const [step, setStep] = useState(null)
  const [typing, setTyping] = useState(false)
  const [lead, setLead] = useState({})
  const [text, setText] = useState('')
  const [hint, setHint] = useState(null)
  const [unread, setUnread] = useState(false)
  const [mood, setMood] = useState('idle')
  const [sent, setSent] = useState(null)
  const started = useRef(false), seen = useRef(new Set()), body = useRef(null), panel = useRef(null), launcher = useRef(null), hp = useRef(null), inputRef = useRef(null)
  const leadRef = useRef({}); leadRef.current = lead

  useFocusTrap(panel, open, () => setOpen(false), { trap: isMobile() })

  const say = useCallback(async (lines) => {
    setMood('talk')
    for (const t of lines) {
      setTyping(true); await sleep(380 + Math.min(900, t.length * 9)); setTyping(false)
      setMsgs((m) => [...m, { from: 'bot', ...(typeof t === 'string' ? { text: t } : t) }]); await sleep(120)
    }
    setMood('idle')
  }, [])
  const goStep = useCallback(async (key, l = leadRef.current) => {
    setStep(null)
    await say(STEPS[key].ask(l))
    if (STEPS[key].summary) setMsgs((m) => [...m, { from: 'bot', summary: { ...l } }])
    setStep(key)
  }, [say])

  const start = useCallback(async (pf) => {
    setMsgs([]); setSent(null)
    const base = pf?.type ? { type: pf.type, ref: pf.ref } : {}
    setLead(base); leadRef.current = base
    if (pf?.type) {
      await say(['Привет! Я Капля 💧 Соберу бриф и сразу передам его в Telegram.'])
      setMsgs((m) => [...m, { from: 'me', text: pf.ref ? `Хочу так же, как ${pf.ref}` : `Нужно: ${pf.type}` }])
      goStep('task', base)
    } else goStep('type', base)
  }, [say, goStep])

  // открытие панели
  useEffect(() => {
    if (!open) return
    setHint(null); setUnread(false)
    if (prefill || !started.current) { started.current = true; start(prefill) }
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 450)
  }, [open, prefill])

  // закрытие по клику вне чата
  useEffect(() => {
    if (!open) return
    const onOutside = (e) => {
      if (panel.current?.contains(e.target) || launcher.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onOutside)
    return () => document.removeEventListener('pointerdown', onOutside)
  }, [open, setOpen])

  // подсказки по разделам
  useEffect(() => {
    setHint(null)
    if (open || !M.hints[chapterId] || seen.current.has(chapterId)) return
    const t1 = setTimeout(() => { seen.current.add(chapterId); setHint(M.hints[chapterId]); setUnread(true) }, chapterId === 'home' ? 2600 : 1100)
    const t2 = setTimeout(() => setHint(null), (chapterId === 'home' ? 2600 : 1100) + 5200)
    return () => { clearTimeout(t1); clearTimeout(t2); setHint(null) }
  }, [chapterId, open])

  useEffect(() => { body.current?.scrollTo({ top: 1e6, behavior: 'smooth' }) }, [msgs, typing, step])

  // глаза следят за курсором
  useEffect(() => {
    if (isMobile()) return // на мобильных устройствах нет мыши — экономим обработку pointermove
    // не чаще раза за кадр; позицию капли кешируем (сбрасываем на ресайз), чтобы не дёргать layout
    let r = null, rt = 0, raf = 0, px = 0, py = 0
    const upd = () => {
      raf = 0; const el = launcher.current; if (!el) return
      const now = performance.now()
      if (!r || !r.width || now - rt > 1000) { r = el.getBoundingClientRect(); rt = now }
      const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2)
      const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 300)
      el.style.setProperty('--lx', `${(dx / d) * 3.4 * k}px`); el.style.setProperty('--ly', `${(dy / d) * 3 * k}px`)
    }
    const mv = (e) => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(upd) }
    const rs = () => { r = null }
    addEventListener('pointermove', mv); addEventListener('resize', rs)
    return () => { removeEventListener('pointermove', mv); removeEventListener('resize', rs); cancelAnimationFrame(raf) }
  }, [])

  const answer = async (v) => {
    const s = STEPS[step]; if (!s) return
    v = v.trim(); if (!v) return
    if (FAQ_Q.includes(v)) {
      setMsgs((m) => [...m, { from: 'me', text: v }]); const cur = step; setStep(null)
      await say([M.faq.find((f) => f.q === v).a]); setStep(cur); return
    }
    if (step === 'confirm') {
      setMsgs((m) => [...m, { from: 'me', text: v }])
      if (v.startsWith('Отправить')) return send()
      return start()
    }
    if (s.min && v.length < s.min) { setStep(null); await say(['Чуть подробнее, пожалуйста 🙏']); setStep(step); return }
    if (s.validate && !s.validate(v)) { setMsgs((m) => [...m, { from: 'me', text: v }]); setText(''); setStep(null); await say([s.err]); setStep(step); return }
    setMsgs((m) => [...m, { from: 'me', text: v }]); setText('')
    const val = s.field === 'type' ? (TYPE_NAME[v] || v) : v
    const l = { ...leadRef.current, [s.field]: val }; setLead(l); leadRef.current = l
    goStep(s.next, l)
  }

  const send = async () => {
    setStep(null); setMood('talk'); setTyping(true)
    const payload = { ...leadRef.current, page: location.href, website: hp.current?.value || '', ts: new Date().toISOString() }
    let res = 'error'
    try {
      const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 12000)
      let r = await fetch(M.endpoint, { signal: ac.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if ((r.status === 404 || r.status === 405) && M.endpoint === '/api/lead') {
        const rPhp = await fetch('./api/lead.php', { signal: ac.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => null)
        if (rPhp) r = rPhp
      }
      clearTimeout(to)
      const j = await r.json().catch(() => ({}))
      // демо-режим: бэкенд ещё не подключён и сайт в режиме превью (site.showDemoBadges)
      res = r.ok && j.ok ? 'ok' : (site.showDemoBadges && ([404, 405, 501, 502, 503].includes(r.status) || j.error === 'not_configured')) ? 'demo' : 'error'
    } catch { res = 'error' }
    await sleep(600); setTyping(false)
    setSent(res)
    if (res === 'ok') { setMood('happy'); await say(['Готово! 🚀 Заявка уже в Telegram у ' + profile.name + '.', 'Ответ — в течение дня. А пока можно посмотреть работы.']) }
    else if (res === 'demo') { setMood('happy'); await say(['Демо-режим: Telegram-бот ещё не подключён (см. README).', { text: 'Вот так заявка придёт тебе в Telegram 👇', preview: payload }]) }
    else { setMood('sad'); await say(['Не получилось отправить 😢 Напиши напрямую — бриф я уже скопировала.']); copyBrief(payload) }
    setStep('after')
  }
  const copyBrief = (l) => navigator.clipboard?.writeText(briefText(l)).catch(() => {})

  const s = STEPS[step]
  const chips = step === 'after' ? null : s?.chips
  const canType = !!step && step !== 'after' && step !== 'confirm'

  return (
    <>
      <button ref={launcher} className={`mascot ${open ? 'is-open' : ''} mood-${mood}`} onClick={() => setOpen(!open)}
        aria-label={open ? 'Закрыть чат с Каплей' : 'Открыть чат: оставить заявку'} aria-expanded={open} data-cursor={open ? 'закрыть' : 'бриф'}>
        <Drop mood={open ? 'happy' : mood} />
        {unread && !open && <span className="mascot-dot" />}
      </button>
      {hint && !open && (
        <div className="mascot-hint" onClick={() => setOpen(true)} role="status" tabIndex={0} data-cursor="бриф"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}>
          <span>{hint}</span>
          <i>Ответить →</i>
          <button className="mascot-hint-x" onClick={(e) => { e.stopPropagation(); setHint(null) }} aria-label="Закрыть подсказку" data-cursor="закрыть">×</button>
        </div>
      )}

      <div ref={panel} className={`chat ${open ? 'open' : ''}`} role="dialog" aria-modal="false" aria-label="Бриф с Каплей" aria-hidden={!open} inert={!open}>
        <header className="chat-head">
          <span className="chat-ava"><Drop mood={mood} /></span>
          <div><b>{M.name} · ассистент {profile.name}</b><small><i />{typing ? 'печатает…' : 'онлайн · ответ в течение дня'}</small></div>
          <button className="chat-x" onClick={() => setOpen(false)} aria-label="Закрыть"><svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg></button>
        </header>
        <div className="chat-body" ref={body} aria-live="polite">
          {msgs.map((m, i) => (
            m.summary ? <Summary key={i} l={m.summary} /> :
            m.preview ? <div key={i} className="chat-msg bot">{m.text}<pre className="chat-preview">{briefText(m.preview, true)}</pre></div> :
            <div key={i} className={`chat-msg ${m.from}`}>{m.text}</div>
          ))}
          {typing && <div className="chat-msg bot typing"><span /><span /><span /></div>}
          {chips && <div className="chat-chips">{chips.map((c) => <button key={c} className={FAQ_Q.includes(c) ? 'faq' : ''} onClick={() => answer(c)}>{c}</button>)}</div>}
          {step === 'after' && (
            <div className="chat-chips">
              {sent === 'error' && <a href={profile.telegram} target="_blank" rel="noreferrer">Написать в Telegram ↗</a>}
              <button onClick={() => { setOpen(false); onGoWorks() }}>Смотреть работы</button>
              <button onClick={() => start()}>Новая заявка</button>
            </div>
          )}
        </div>
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); if (canType && text.trim()) answer(text) }}>
          <input ref={hp} name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={600} readOnly={step === 'confirm' || step === 'after'} enterKeyHint="send"
            placeholder={step === 'confirm' ? 'Нажми «Отправить» выше' : step === 'after' ? 'Заявка отправлена ✓' : (s?.input || 'Или напиши свой вариант…')} aria-label="Сообщение" />
          <button type="submit" disabled={!canType || !text.trim()} aria-label="Отправить">↑</button>
        </form>
      </div>
    </>
  )
}

function Summary({ l }) {
  const rows = [['Что нужно', l.type], ['Задача', l.task], ['Бюджет', l.budget], ['Сроки', l.deadline], ['Имя', l.name], ['Контакт', l.contact]]
  return <div className="chat-summary">{rows.map(([k, v]) => <div key={k}><span>{k}</span><b>{v || '—'}</b></div>)}</div>
}

export function briefText(l, short) {
  return [
    '🔥 Новая заявка с сайта', '',
    `👤 ${l.name || '—'}`, `📬 ${l.contact || '—'}`, `🧩 ${l.type || '—'}${l.ref ? ` (как «${l.ref}»)` : ''}`,
    `📝 ${l.task || '—'}`, `💰 ${l.budget || '—'}`, `⏰ ${l.deadline || '—'}`, ...(short ? [] : ['', l.page || '']),
  ].join('\n')
}
