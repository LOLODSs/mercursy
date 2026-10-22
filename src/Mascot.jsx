import { useEffect, useId, useRef, useState, useCallback } from 'react'
import { mascot as M, profile, site } from './config.js'
import { useFocusTrap } from './a11y.js'
import { isMobile } from './mq.js'
import { playWaterDrop } from './audio.js'

/* ===== Капля — маскот-ассистент. Собирает бриф и шлёт тебе в Telegram (через M.endpoint) ===== */

const MOUTH_PATHS = {
  idle: 'M45 91 Q50 96 55 91',
  talk: 'M45 91 Q50 96 55 91',
  happy: 'M42 89 Q50 100 58 89',
  wink: 'M44 90 Q50 97 56 90',
  sad: 'M45 95 Q50 89 55 95',
  excited: 'M42 88 Q50 102 58 88',
}

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
        <ellipse className="drop-blush blush-l" cx="29" cy="88" rx="7" ry="4" fill="#ff9ad5" opacity=".35" />
        <ellipse className="drop-blush blush-r" cx="71" cy="88" rx="7" ry="4" fill="#ff9ad5" opacity=".35" />
        <g className="drop-eyes">
          <g className="drop-eye eye-l"><ellipse cx="38" cy="76" rx="6.5" ry="8.5" fill="#0d0e10" /><circle cx="40.4" cy="72.6" r="2.4" fill="#fff" /></g>
          <g className="drop-eye eye-r"><ellipse cx="62" cy="76" rx="6.5" ry="8.5" fill="#0d0e10" /><circle cx="64.4" cy="72.6" r="2.4" fill="#fff" /></g>
        </g>
        <path className="drop-mouth" d={MOUTH_PATHS[mood] || MOUTH_PATHS.idle} fill="none" stroke="#0d0e10" strokeWidth="2.6" strokeLinecap="round" />
        <ellipse className="drop-o" cx="50" cy="93" rx="3.6" ry="4.2" fill="#0d0e10" />
      </g>
    </svg>
  )
}

const TYPES = ['Хочу сайт', 'Хочу бота', 'Хочу автоматизацию', 'Другое']
const TYPE_NAME = { 'Хочу сайт': 'Сайт', 'Хочу бота': 'Бот', 'Хочу автоматизацию': 'Автоматизация', 'Другое': 'Другое' }
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
  budget: {
    field: 'budget',
    ask: (l) => {
      const t = (l?.type || '').toLowerCase()
      if (t.includes('сайт')) {
        return ['Какой ориентир по бюджету? 💡 Сайты и лендинги у меня обычно от 40 000 ₽. Если пока не уверен — выбери «Пока не знаю», посчитаем точнее.']
      }
      if (t.includes('бот')) {
        return ['Какой ориентир по бюджету? 💡 Telegram-боты обычно от 25 000 ₽ (базовые сценарии от 15 000 ₽). Это нормально, если пока не знаешь.']
      }
      if (t.includes('автоматизац')) {
        return ['Какой ориентир по бюджету? 💡 n8n-автоматизации и интеграции стартуют от 15 000 ₽.']
      }
      return ['Какой ориентир по бюджету? 💡 Сайты — от 40 000 ₽, боты — от 25 000 ₽. Это нормально, если пока не знаешь.']
    },
    chips: (l) => {
      const t = (l?.type || '').toLowerCase()
      if (t.includes('сайт')) {
        return ['40–80 000 ₽', '80–150 000 ₽', '150 000 ₽+', 'Пока не знаю']
      }
      if (t.includes('бот')) {
        return ['до 30 000 ₽', '30–60 000 ₽', '60–120 000 ₽', '120 000 ₽+', 'Пока не знаю']
      }
      if (t.includes('автоматизац')) {
        return ['до 25 000 ₽', '25–50 000 ₽', '50–100 000 ₽', '100 000 ₽+', 'Пока не знаю']
      }
      return ['до 40 000 ₽', '40–80 000 ₽', '80–150 000 ₽', '150 000 ₽+', 'Пока не знаю']
    },
    next: 'deadline'
  },
  deadline: {
    field: 'deadline',
    ask: (l) => {
      const t = (l?.type || '').toLowerCase()
      if (t.includes('сайт')) return ['Когда нужно запустить сайт? ⏰ Обычно укладываюсь в 5–8 дней.']
      if (t.includes('бот')) return ['Когда нужно запустить бота? ⏰ Обычно делаю за 3–6 дней.']
      if (t.includes('автоматизац')) return ['Когда нужно внедрить автоматизацию? ⏰ Обычно занимает 2–4 дня.']
      return ['Когда нужно запустить проект? ⏰']
    },
    chips: DEADLINES,
    next: 'name'
  },
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
  const [launcherMood, setLauncherMood] = useState('idle')
  const [soundMuted, setSoundMuted] = useState(() => {
    try {
      return localStorage.getItem('mercury_sound_muted') === 'true'
    } catch {
      return false
    }
  })

  const toggleSound = () => {
    setSoundMuted((prev) => {
      const next = !prev
      try {
        localStorage.setItem('mercury_sound_muted', next ? 'true' : 'false')
      } catch {}
      if (!next) playWaterDrop('bloop', false)
      return next
    })
  }
  const [sent, setSent] = useState(null)
  const [history, setHistory] = useState([])
  const stepRef = useRef(step); stepRef.current = step
  const historyRef = useRef(history); historyRef.current = history
  const lastPrefillRef = useRef(null)
  const prevOpenRef = useRef(false)
  const started = useRef(false), seen = useRef(new Set()), body = useRef(null), panel = useRef(null), launcher = useRef(null), hp = useRef(null), inputRef = useRef(null)
  const leadRef = useRef({}); leadRef.current = lead

  useFocusTrap(panel, open, () => setOpen(false), { trap: isMobile() })

  const say = useCallback(async (lines, finishMood = 'idle') => {
    setMood('talk')
    for (const t of lines) {
      setTyping(true); await sleep(380 + Math.min(900, t.length * 9)); setTyping(false)
      setMsgs((m) => [...m, { from: 'bot', ...(typeof t === 'string' ? { text: t } : t) }]); await sleep(120)
    }
    setMood(finishMood)
  }, [])
  const goStep = useCallback(async (key, l = leadRef.current, finishMood = 'idle') => {
    setStep(null)
    await say(STEPS[key].ask(l), finishMood)
    if (STEPS[key].summary) setMsgs((m) => [...m, { from: 'bot', summary: { ...l } }])
    setStep(key)
  }, [say])

  const start = useCallback(async (pf) => {
    setMsgs([]); setSent(null); setHistory([])
    if (pf?.calc) {
      const base = {
        type: pf.type,
        ref: pf.ref || 'Калькулятор',
        task: pf.task,
        budget: pf.budget,
        deadline: pf.deadline,
      }
      setLead(base); leadRef.current = base
      setMood('excited')
      await say([
        `Привет! Я Капля 💧 Вижу твой расчёт: ${pf.type} (~${pf.estimate || pf.budget}) 🚀`,
        'Параметры и выбранные функции уже внесены в бриф. Осталось уточнить контакт для связи.'
      ])
      setMsgs((m) => [
        ...m,
        {
          from: 'me',
          text: `📋 Расчёт из калькулятора:\n• ${pf.task}\n• Ориентир бюджета: ${pf.budget}\n• Срок: ${pf.deadline}`
        }
      ])
      setHistory([
        { step: 'type', lead: { type: pf.type }, msgsLength: 0 },
        { step: 'task', lead: { type: pf.type, task: pf.task }, msgsLength: 1 },
        { step: 'budget', lead: { type: pf.type, task: pf.task, budget: pf.budget }, msgsLength: 1 },
        { step: 'deadline', lead: base, msgsLength: 1 },
      ])
      goStep('name', base)
      return
    }

    const base = pf?.type ? { type: pf.type, ref: pf.ref } : {}
    setLead(base); leadRef.current = base
    if (pf?.type) {
      setMood('happy')
      await say(['Привет! Я Капля 💧 Соберу бриф и сразу передам его в Telegram.'])
      setMsgs((m) => [...m, { from: 'me', text: pf.ref ? `Хочу так же, как ${pf.ref}` : `Нужно: ${pf.type}` }])
      setHistory([{ step: 'type', lead: {}, msgsLength: 0 }])
      goStep('task', base)
    } else {
      setMood('wink')
      goStep('type', base)
    }
  }, [say, goStep])

  const goBack = useCallback(() => {
    if (!history.length || typing) return
    playWaterDrop('pop', soundMuted)
    setMood('wink')
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setLead(prev.lead)
    leadRef.current = prev.lead
    if (prev.step === 'type' && prev.msgsLength === 0) {
      setMsgs([])
      goStep('type', {})
      setTimeout(() => setMood('idle'), 600)
      return
    }
    setMsgs((m) => m.slice(0, prev.msgsLength))
    setText('')
    setStep(prev.step)
    setTimeout(() => setMood('idle'), 600)
  }, [history, typing, goStep])

  // открытие и закрытие панели: микро-эмоции без паразитных перезапусков
  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open

    if (!open) {
      if (wasOpen && historyRef.current.length > 0 && stepRef.current !== 'after') {
        setLauncherMood('sad')
        const t = setTimeout(() => setLauncherMood('idle'), 3500)
        return () => clearTimeout(t)
      } else {
        setLauncherMood('idle')
      }
      return
    }

    setHint(null)
    setUnread(false)
    setLauncherMood('wink')
    const tWink = setTimeout(() => setLauncherMood('idle'), 1200)

    const isNewPrefill = prefill && prefill !== lastPrefillRef.current
    if (!started.current || isNewPrefill) {
      started.current = true
      lastPrefillRef.current = prefill
      start(prefill)
    }

    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 450)
    return () => clearTimeout(tWink)
  }, [open, prefill, start])

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

  // подсказки по разделам: приветственное подмигивание
  useEffect(() => {
    setHint(null)
    if (open || !M.hints[chapterId] || seen.current.has(chapterId)) return
    const t1 = setTimeout(() => {
      seen.current.add(chapterId)
      setHint(M.hints[chapterId])
      setUnread(true)
      setLauncherMood('wink')
      setTimeout(() => setLauncherMood('idle'), 1400)
    }, chapterId === 'home' ? 2600 : 1100)
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
    if (v === '← Назад' || v === '← Изменить (Назад)') return goBack()
    playWaterDrop('bloop', soundMuted)
    if (FAQ_Q.includes(v)) {
      setMsgs((m) => [...m, { from: 'me', text: v }]); const cur = step; setStep(null)
      await say([M.faq.find((f) => f.q === v).a]); setStep(cur); return
    }
    if (step === 'confirm') {
      if (v === 'Заполнить заново') return start()
      if (v.startsWith('Отправить')) {
        setMsgs((m) => [...m, { from: 'me', text: v }])
        return send()
      }
      return goBack()
    }
    if (s.min && v.length < s.min) { setStep(null); setMood('sad'); await say(['Чуть подробнее, пожалуйста 🙏']); setStep(step); return }
    if (s.validate && !s.validate(v)) { setMsgs((m) => [...m, { from: 'me', text: v }]); setText(''); setStep(null); setMood('sad'); await say([s.err]); setStep(step); return }

    setHistory((h) => [...h, { step, lead: { ...leadRef.current }, msgsLength: msgs.length }])

    // Микро-эмоции при ответах
    if (step === 'budget' && (v.includes('150 000') || v.includes('120 000') || v.includes('80–150') || v.includes('60–120'))) {
      setMood('excited')
    } else {
      setMood('happy')
    }

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
      const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 8000)
      let r = await fetch(M.endpoint, { signal: ac.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if ((r.status === 404 || r.status === 405) && M.endpoint === '/api/lead') {
        const rPhp = await fetch('./api/lead.php', { signal: ac.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => null)
        if (rPhp) r = rPhp
      }
      clearTimeout(to)
      const j = await r.json().catch(() => ({}))
      if (r.ok && j.ok) res = 'ok'
      else console.warn('[Mascot Lead Error]', r.status, j)
    } catch (e) {
      console.warn('[Mascot Lead Fetch Failed]', e?.message || e)
    }

    await sleep(600); setTyping(false)
    setSent(res)
    if (res === 'ok') {
      playWaterDrop('success', soundMuted)
      await say(['Готово! 🚀 Заявка уже в Telegram у ' + profile.name + '.', 'Ответ — в течение дня. А пока можно посмотреть работы.'], 'happy')
    }
    else if (res === 'demo') { await say(['Демо-режим: Telegram-бот ещё не подключён (см. README).', { text: 'Вот так заявка придёт тебе в Telegram 👇', preview: payload }], 'happy') }
    else { await say(['Не получилось отправить 😢 Напиши напрямую — бриф я уже скопировала.'], 'sad'); copyBrief(payload) }
    setStep('after')
  }
  const copyBrief = (l) => navigator.clipboard?.writeText(briefText(l)).catch(() => {})

  const s = STEPS[step]
  const chips = step === 'after' ? null : (typeof s?.chips === 'function' ? s.chips(lead) : s?.chips)
  const canType = !!step && step !== 'after' && step !== 'confirm'

  return (
    <>
      <button ref={launcher} className={`mascot ${open ? 'is-open' : ''} mood-${launcherMood}`} onClick={() => {
        if (!open) playWaterDrop('bloop', soundMuted)
        setOpen(!open)
      }}
        aria-label={open ? 'Закрыть чат с Каплей' : 'Открыть чат: оставить заявку'} aria-expanded={open} data-cursor={open ? 'закрыть' : 'бриф'}>
        <Drop mood={open ? 'happy' : launcherMood} />
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
          {history.length > 0 && step !== 'after' && (
            <button className="chat-back" onClick={goBack} aria-label="Назад к предыдущему шагу" title="Назад">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <span className="chat-ava"><Drop mood={mood} /></span>
          <div className="chat-head-info">
            <b>{M.name} · ассистент {profile.name}</b>
            <small><i />{typing ? 'печатает…' : 'онлайн · ответ в течение дня'}</small>
          </div>
          <div className="chat-head-actions">
            <button
              type="button"
              className={`chat-sound ${soundMuted ? 'is-muted' : ''}`}
              onClick={toggleSound}
              aria-label={soundMuted ? 'Включить звук Капли' : 'Выключить звук Капли'}
              title={soundMuted ? 'Звук выключен (нажми, чтобы включить)' : 'Звук капли включён (нажми, чтобы выключить)'}
              data-cursor="звук"
            >
              {soundMuted ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>
            <a
              className="chat-tg"
              href={profile.telegram}
              target="_blank"
              rel="noreferrer"
              aria-label={`Написать ${profile.telegramLabel} в Telegram напрямую`}
              title={`Написать напрямую в Telegram (${profile.telegramLabel})`}
              data-cursor="в тг"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                <path d="m21 3-7 18-4-7-7-4L21 3Z" />
                <path d="m10 14 5-5" strokeLinecap="round" />
              </svg>
            </a>
            <button className="chat-x" onClick={() => setOpen(false)} aria-label="Закрыть" data-cursor="закрыть">
              <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </header>
        <div className="chat-body" ref={body} aria-live="polite">
          {msgs.map((m, i) => (
            m.summary ? <Summary key={i} l={m.summary} /> :
            m.preview ? <div key={i} className="chat-msg bot">{m.text}<pre className="chat-preview">{briefText(m.preview, true)}</pre></div> :
            <div key={i} className={`chat-msg ${m.from}`}>{m.text}</div>
          ))}
          {typing && <div className="chat-msg bot typing"><span /><span /><span /></div>}
          {step && step !== 'after' && (chips || history.length > 0) && (
            <div className="chat-chips">
              {chips?.map((c) => <button key={c} className={FAQ_Q.includes(c) ? 'faq' : ''} onClick={() => answer(c)}>{c}</button>)}
              {history.length > 0 && (
                <button className="back" onClick={goBack} title="Вернуться к предыдущему вопросу">
                  ← Назад
                </button>
              )}
            </div>
          )}
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
