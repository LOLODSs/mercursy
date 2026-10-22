import { useState, useId, useEffect, useRef } from 'react'
import { playWaterDrop } from './audio.js'
import { useFocusTrap } from './a11y.js'
import { isMobile } from './mq.js'

const TYPES = [
  {
    id: 'website',
    name: 'Сайт / Лендинг',
    basePrice: 40000,
    baseDays: [5, 7],
    icon: '🌐',
    desc: 'Адаптивный сайт с чистым кодом, высокой скоростью и плавной анимацией',
  },
  {
    id: 'bot',
    name: 'Telegram-бот',
    basePrice: 25000,
    baseDays: [3, 5],
    icon: '🤖',
    desc: 'Бот для приёма заявок, продаж, поддержки клиентов и уведомлений',
  },
  {
    id: 'automation',
    name: 'Автоматизация n8n',
    basePrice: 15000,
    baseDays: [2, 4],
    icon: '⚡',
    desc: 'Связка сервисов, авто-обработка заявок, синхронизация с CRM и базами',
  },
  {
    id: 'combo',
    name: 'Сайт + Telegram-бот',
    basePrice: 60000,
    baseDays: [7, 10],
    icon: '🚀',
    badge: 'Экономия 5 000 ₽',
    desc: 'Единая экосистема: сайт привлекает клиентов, бот мгновенно ведёт продажи',
  },
]

const OPTIONS = [
  {
    id: 'graphics3d',
    title: '3D-графика и WebGL',
    price: 15000,
    days: 2,
    icon: '🌌',
    desc: 'Интерактивные 3D-модели (Three.js), жидкие эффекты, кастомный курсор',
    for: ['website', 'combo'],
  },
  {
    id: 'payments',
    title: 'Приём платежей',
    price: 10000,
    days: 1,
    icon: '💳',
    desc: 'ЮKassa, Telegram Stars, СБП, Robokassa с чеками',
    for: ['website', 'bot', 'combo'],
  },
  {
    id: 'ai',
    title: 'AI-ассистент (ChatGPT/Claude)',
    price: 15000,
    days: 2,
    icon: '🧠',
    desc: 'Умный ассистент с обучением на данных твоей компании',
    for: ['website', 'bot', 'automation', 'combo'],
  },
  {
    id: 'crm',
    title: 'CRM и базы данных',
    price: 10000,
    days: 1,
    icon: '📊',
    desc: 'Google Таблицы, Notion, PostgreSQL или Telegram-админка',
    for: ['website', 'bot', 'automation', 'combo'],
  },
  {
    id: 'webapp',
    title: 'Telegram Mini App (WebApp)',
    price: 15000,
    days: 2,
    icon: '📱',
    desc: 'Интерактивное веб-приложение прямо внутри Telegram',
    for: ['bot', 'combo'],
  },
  {
    id: 'urgent',
    title: 'Срочный запуск (Турбо)',
    rate: 0.25,
    icon: '🔥',
    badge: '–40% по сроку',
    desc: 'Приоритетная разработка без выходных в сжатые сроки',
    for: ['website', 'bot', 'automation', 'combo'],
  },
]

export default function Calculator({ onClose, onOrder }) {
  const [selectedType, setSelectedType] = useState('website')
  const [selectedOpts, setSelectedOpts] = useState(new Set())
  const panelRef = useRef(null)

  useFocusTrap(panelRef, true, onClose, { trap: isMobile() })

  // Блокировка фонового скролла при открытом модале
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Закрытие по клавише Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const typeObj = TYPES.find((t) => t.id === selectedType) || TYPES[0]
  const availableOpts = OPTIONS.filter((o) => o.for.includes(selectedType))

  // Расчёт стоимости и сроков
  let baseSum = typeObj.basePrice
  let addDays = 0

  availableOpts.forEach((opt) => {
    if (selectedOpts.has(opt.id)) {
      if (opt.price) baseSum += opt.price
      if (opt.days) addDays += opt.days
    }
  })

  const isUrgent = selectedOpts.has('urgent')
  const finalPrice = Math.round(isUrgent ? baseSum * 1.25 : baseSum)
  const minDays = Math.max(1, Math.round((typeObj.baseDays[0] + addDays) * (isUrgent ? 0.6 : 1)))
  const maxDays = Math.max(2, Math.round((typeObj.baseDays[1] + addDays) * (isUrgent ? 0.6 : 1)))

  const isMuted = () => {
    try { return localStorage.getItem('mercury_sound_muted') === 'true' } catch { return false }
  }

  const handleSelectType = (id) => {
    playWaterDrop('bloop', isMuted())
    setSelectedType(id)
    // убираем опции, не подходящие новому типу
    setSelectedOpts((prev) => {
      const next = new Set()
      const newAvail = OPTIONS.filter((o) => o.for.includes(id)).map((o) => o.id)
      prev.forEach((optId) => {
        if (newAvail.includes(optId)) next.add(optId)
      })
      return next
    })
  }

  const handleToggleOpt = (id) => {
    setSelectedOpts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        playWaterDrop('pop', isMuted())
      } else {
        next.add(id)
        playWaterDrop('bloop', isMuted())
      }
      return next
    })
  }

  const handleOrder = () => {
    playWaterDrop('success', isMuted())
    const activeOptTitles = availableOpts
      .filter((o) => selectedOpts.has(o.id))
      .map((o) => o.title)

    const priceFormatted = `${finalPrice.toLocaleString('ru-RU')} ₽`
    const daysFormatted = `${minDays}–${maxDays} дней`

    const taskDescription = [
      `${typeObj.name} (~${priceFormatted})`,
      activeOptTitles.length > 0 ? `Опции: ${activeOptTitles.join(', ')}` : 'Базовая комплектация',
      `Срок: ${daysFormatted}`,
    ].join(' • ')

    onOrder({
      calc: true,
      type: typeObj.name.includes('Сайт') ? 'Сайт' : typeObj.name.includes('бот') ? 'Бот' : 'Автоматизация',
      budget: `${priceFormatted}`,
      deadline: daysFormatted,
      estimate: priceFormatted,
      task: taskDescription,
      options: activeOptTitles,
    })
  }

  return (
    <div className="calc-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label="Калькулятор стоимости проекта">
      <div className="calc-panel glass" ref={panelRef}>
        <header className="calc-head">
          <div>
            <span className="calc-badge">⚡ Интерактивный расчёт</span>
            <h2>Калькулятор проекта</h2>
            <p>Выбери основу и нужные функции — получи честную вилку цен и сроков за 30 секунд</p>
          </div>
          <button className="calc-x" onClick={onClose} aria-label="Закрыть калькулятор" data-cursor="закрыть">
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="calc-body">
          {/* Шаг 1: Тип проекта */}
          <section className="calc-sec">
            <label className="calc-sec-title">
              <span className="calc-step-num">1</span>
              <span>Что разрабатываем?</span>
            </label>
            <div className="calc-types-grid">
              {TYPES.map((t) => {
                const active = selectedType === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`calc-type-card ${active ? 'is-active' : ''}`}
                    onClick={() => handleSelectType(t.id)}
                    data-cursor="выбрать"
                  >
                    <div className="calc-card-top">
                      <span className="calc-type-icon">{t.icon}</span>
                      {t.badge && <span className="calc-pill-badge">{t.badge}</span>}
                      <b className="calc-type-price">от {t.basePrice.toLocaleString('ru-RU')} ₽</b>
                    </div>
                    <strong className="calc-type-name">{t.name}</strong>
                    <span className="calc-type-desc">{t.desc}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Шаг 2: Дополнительные опции */}
          <section className="calc-sec">
            <label className="calc-sec-title">
              <span className="calc-step-num">2</span>
              <span>Нужные функции и опции</span>
              <small className="calc-sec-sub">Кликни, чтобы добавить в проект</small>
            </label>
            <div className="calc-opts-grid">
              {availableOpts.map((opt) => {
                const active = selectedOpts.has(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`calc-opt-card ${active ? 'is-active' : ''}`}
                    onClick={() => handleToggleOpt(opt.id)}
                    data-cursor="опция"
                  >
                    <div className="calc-opt-check">
                      <span className={`calc-checkbox ${active ? 'checked' : ''}`} aria-hidden="true">
                        {active && (
                          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 8 7 12 13 4" />
                          </svg>
                        )}
                      </span>
                    </div>
                    <div className="calc-opt-info">
                      <div className="calc-opt-head">
                        <span className="calc-opt-icon">{opt.icon}</span>
                        <b className="calc-opt-title">{opt.title}</b>
                        <span className="calc-opt-price">
                          {opt.rate ? `+${Math.round(opt.rate * 100)}%` : `+${opt.price.toLocaleString('ru-RU')} ₽`}
                        </span>
                      </div>
                      <span className="calc-opt-desc">{opt.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        {/* Футер с итогом */}
        <footer className="calc-foot">
          <div className="calc-summary">
            <div className="calc-total">
              <span className="calc-total-lbl">Ориентир бюджета:</span>
              <b className="calc-total-val">~{finalPrice.toLocaleString('ru-RU')} ₽</b>
            </div>
            <div className="calc-time">
              <span className="calc-time-lbl">Срок:</span>
              <b className="calc-time-val">⏱ {minDays}–{maxDays} дней</b>
            </div>
          </div>

          <div className="calc-actions">
            <button
              type="button"
              className="btn chrome calc-order-btn"
              onClick={handleOrder}
              data-cursor="заказать"
            >
              <span>Заказать с этим расчётом</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
