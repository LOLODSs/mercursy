import { useEffect, useRef, useState } from 'react'
import './tg.css'

/* Демо Telegram-бота записи. mini = автопроигрывание в карточке, иначе можно тыкать кнопки.
   🟡 ЗАГЛУШКА — сценарий выдуманный, замени на своего бота или видео (video: 'media/bot.mp4' в config) */
const STEPS = {
  start: { field: 'service', bot: () => ['Привет! Я бот Barber Club 💈', 'Запишу тебя за 30 секунд. Что делаем?'], buttons: ['Стрижка · 1 800 ₽', 'Борода · 1 200 ₽', 'Комплекс · 2 600 ₽'], next: 'master' },
  master: { field: 'master', bot: () => ['Отличный выбор. К кому записать?'], buttons: ['Артём', 'Илья', 'Любой свободный'], next: 'time' },
  time: { field: 'time', bot: () => ['Свободные окна на ближайшие дни 👇'], buttons: ['Сегодня 18:00', 'Завтра 12:00', 'Завтра 16:30'], next: 'confirm' },
  confirm: { field: 'pay', bot: (c) => [`Готово ✅\n${c.service}\nМастер: ${c.master}\n${c.time}`, 'Напомню за 2 часа. Оплатить сейчас со скидкой 10%?'], buttons: ['Оплатить −10%', 'Оплачу на месте'], next: (v) => (v.startsWith('Оплатить') ? 'paid' : 'done') },
  paid: { bot: () => ['💳 Оплата прошла, чек — на почте.', 'До встречи! Схема прохода — в закрепе.'], buttons: ['↺ Начать заново'], next: 'start' },
  done: { bot: () => ['Принято! До встречи 👋', 'Если планы изменятся — жми «Перенести» в напоминании.'], buttons: ['↺ Начать заново'], next: 'start' },
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default function BotDemo({ mini = false, paused = false }) {
  const [msgs, setMsgs] = useState([])
  const [typing, setTyping] = useState(false)
  const [step, setStep] = useState(null)
  const [idle, setIdle] = useState(false)
  const ctx = useRef({}), alive = useRef(true), body = useRef(null), busy = useRef(false)

  const run = async (key) => {
    busy.current = true; setStep(null)
    const s = STEPS[key]
    if (key === 'start') { ctx.current = {}; setMsgs([]) }
    for (const t of s.bot(ctx.current)) {
      if (!alive.current) return
      setTyping(true); await sleep(mini ? 700 : 550 + t.length * 8); if (!alive.current) return
      setTyping(false); setMsgs((m) => [...m, { from: 'bot', text: t }]); await sleep(180)
    }
    if (!alive.current) return
    setStep(key); busy.current = false
  }
  const pick = async (v) => {
    if (busy.current || !step) return
    const s = STEPS[step]; setIdle(false)
    if (s.field) ctx.current[s.field] = v.replace(/ · .*/, '')
    setMsgs((m) => [...m, { from: 'me', text: v, key: step }])
    const nx = typeof s.next === 'function' ? s.next(v) : s.next
    await sleep(250); run(nx)
  }

  useEffect(() => { alive.current = true; if (!paused) run('start'); return () => { alive.current = false } }, [paused])
  useEffect(() => { body.current?.scrollTo({ top: 1e5, behavior: 'smooth' }) }, [msgs, typing, step])
  // автопилот в карточке и подсказка в кейсе
  useEffect(() => {
    if (!step || (mini && paused)) return
    const t = setTimeout(() => {
      if (mini) { const b = STEPS[step].buttons; pick(b[Math.floor(Math.random() * b.length)]) } else setIdle(true)
    }, mini ? 1300 : 4500)
    return () => clearTimeout(t)
  }, [step, mini, paused])

  const s = step && STEPS[step]
  return (
    <div className={`tg ${mini ? 'mini' : ''}`} onPointerDown={(e) => mini || e.stopPropagation()}>
      <div className="tg-head">
        <span className="tg-back">‹</span>
        <span className="tg-ava">BC</span>
        <div><b>Barber Club Bot</b><small>{typing ? 'печатает…' : 'бот'}</small></div>
      </div>
      <div className="tg-body" ref={body}>
        <div className="tg-date">сегодня</div>
        {msgs.map((m, i) => <div key={i} className={`tg-msg ${m.from}`}>{m.text}<i>{m.from === 'me' ? '12:0' + (i % 10) + ' ✓✓' : '12:0' + (i % 10)}</i></div>)}
        {typing && <div className="tg-msg bot typing"><span /><span /><span /></div>}
        {s && (
          <div className={`tg-kb ${idle ? 'hint' : ''} ${s.buttons.length > 2 ? 'col' : ''}`}>
            {s.buttons.map((b) => <button key={b} tabIndex={mini ? -1 : 0} onClick={(e) => { e.stopPropagation(); pick(b) }}>{b}</button>)}
          </div>
        )}
      </div>
      <div className="tg-input"><span className="tg-menu">☰ Меню</span><span className="tg-ph">Сообщение</span></div>
    </div>
  )
}
