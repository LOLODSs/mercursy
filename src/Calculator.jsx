import { useState, useEffect, useRef } from 'react'
import { playWaterDrop } from './audio.js'
import { useFocusTrap } from './a11y.js'
import { isMobile } from './mq.js'

export const ICONS = {
  website: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="18" rx="4" />
      <path d="M2 9h20" />
      <path d="M6 6h.01M9 6h.01M12 6h.01" />
      <path d="m8 14-2 2 2 2M16 14l2 2-2 2M13 13l-2 6" />
    </svg>
  ),
  bot: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.5 3.5-19 8.5 7.5 3.5 3 6 3-4 5.5 3.5L21.5 3.5Z" />
      <path d="m10 15.5 11.5-12" />
    </svg>
  ),
  automation: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="2" />
      <rect x="15" y="3" width="6" height="6" rx="2" />
      <rect x="9" y="15" width="6" height="6" rx="2" />
      <path d="M6 9v2.5a2.5 2.5 0 0 0 2.5 2.5h1M18 9v2.5a2.5 2.5 0 0 1-2.5 2.5h-1" />
      <path d="M12 11.5v3.5" />
    </svg>
  ),
  combo: (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12l4 6-10 12L2 9l4-6Z" />
      <path d="M2 9h20" />
      <path d="m12 21 3.5-12" />
      <path d="m12 21-3.5-12" />
      <path d="m6 3 2.5 6" />
      <path d="m18 3-2.5 6" />
    </svg>
  ),
  graphics3d: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21 16-9 5-9-5V8l9-5 9 5v8Z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-2.5 6.5L3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5L12 3Z" />
    </svg>
  ),
  crm: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  ),
  webapp: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="3.5" />
      <path d="M10 18h4" />
      <circle cx="9" cy="8" r="1" fill="currentColor" />
      <circle cx="15" cy="8" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  n8n_addon: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m13 2-9 12h8l-2 8 10-13h-8l3-7Z" />
    </svg>
  ),
  urgent: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v4M4.93 4.93l2.83 2.83M2 12h4M19.07 4.93l-2.83 2.83M22 12h-4" />
      <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
      <polyline points="12 9 12 12 14 14" />
    </svg>
  ),
}

const CORE_TYPES = [
  {
    id: 'website',
    name: 'Сайт / Лендинг',
    basePrice: 60000,
    baseDays: [5, 7],
    icon: ICONS.website,
    desc: 'Адаптивный сайт с 3D, плавной анимацией и высокой конверсией',
  },
  {
    id: 'bot',
    name: 'Telegram-бот',
    basePrice: 35000,
    baseDays: [3, 5],
    icon: ICONS.bot,
    desc: 'Бот для приёма заявок, продаж, поддержки клиентов и уведомлений',
  },
  {
    id: 'automation',
    name: 'Автоматизация n8n',
    basePrice: 25000,
    baseDays: [2, 4],
    icon: ICONS.automation,
    desc: 'Связка сервисов, авто-обработка заявок, синхронизация с CRM и базами',
  },
]

const OPTIONS = [
  {
    id: 'graphics3d',
    title: '3D-графика и WebGL',
    price: 25000,
    days: 2,
    icon: ICONS.graphics3d,
    desc: 'Интерактивные 3D-модели (Three.js), жидкие эффекты, кастомный курсор',
    for: ['website'],
  },
  {
    id: 'payments',
    title: 'Приём платежей',
    price: 15000,
    days: 1,
    icon: ICONS.payments,
    desc: 'ЮKassa, Telegram Stars, СБП, Robokassa с чеками',
    for: ['website', 'bot'],
  },
  {
    id: 'ai',
    title: 'AI-ассистент (ChatGPT/Claude)',
    price: 20000,
    days: 2,
    icon: ICONS.ai,
    desc: 'Умный ассистент с обучением на данных твоей компании',
    for: ['website', 'bot', 'automation'],
  },
  {
    id: 'crm',
    title: 'CRM и базы данных',
    price: 15000,
    days: 1,
    icon: ICONS.crm,
    desc: 'Google Таблицы, Notion, PostgreSQL или Telegram-админка',
    for: ['website', 'bot', 'automation'],
  },
  {
    id: 'webapp',
    title: 'Telegram Mini App (WebApp)',
    price: 25000,
    days: 2,
    icon: ICONS.webapp,
    desc: 'Интерактивное веб-приложение прямо внутри Telegram',
    for: ['bot'],
  },
  {
    id: 'n8n_addon',
    title: 'Автоматизация n8n (доп. модуль)',
    price: 25000,
    days: 2,
    icon: ICONS.n8n_addon,
    desc: 'Подключение сценариев n8n, сбор лидов, авто-воронка и вебхуки',
    for: ['website', 'bot'],
    hideIfSelected: 'automation',
  },
  {
    id: 'urgent',
    title: 'Срочный запуск (Турбо)',
    rate: 0.25,
    icon: ICONS.urgent,
    badge: '–40% по сроку',
    desc: 'Приоритетная разработка без выходных в сжатые сроки',
    for: ['website', 'bot', 'automation'],
  },
]

export default function Calculator({ onClose, onOrder }) {
  // Выбранные базовые направления (мультиселект: сайт, бот, автоматизация)
  const [selectedTypes, setSelectedTypes] = useState(new Set(['website']))
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

  const isMuted = () => {
    try { return localStorage.getItem('mercury_sound_muted') === 'true' } catch { return false }
  }

  const isAllSelected = selectedTypes.has('website') && selectedTypes.has('bot') && selectedTypes.has('automation')

  const handleToggleType = (id) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size > 1) {
          next.delete(id)
          playWaterDrop('pop', isMuted())
        }
      } else {
        next.add(id)
        playWaterDrop('bloop', isMuted())
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTypes(new Set(['website']))
      playWaterDrop('pop', isMuted())
    } else {
      setSelectedTypes(new Set(['website', 'bot', 'automation']))
      playWaterDrop('bloop', isMuted())
    }
  }

  // Фильтрация доступных опций
  const availableOpts = OPTIONS.filter((o) => {
    if (o.hideIfSelected && selectedTypes.has(o.hideIfSelected)) return false
    return o.for.some((f) => selectedTypes.has(f))
  })

  // Очистка опций, которые больше не подходят выбранным типам
  useEffect(() => {
    setSelectedOpts((prev) => {
      const valid = new Set()
      const availIds = new Set(availableOpts.map((o) => o.id))
      prev.forEach((id) => {
        if (availIds.has(id)) valid.add(id)
      })
      return valid
    })
  }, [selectedTypes])

  // Расчёт базовой суммы и сроков
  let rawBase = 0
  let minDaysSum = 0
  let maxDaysSum = 0

  selectedTypes.forEach((typeId) => {
    const t = CORE_TYPES.find((x) => x.id === typeId)
    if (t) {
      rawBase += t.basePrice
      minDaysSum += t.baseDays[0]
      maxDaysSum += t.baseDays[1]
    }
  })

  // Комбо-скидка и параллельные сроки
  let comboDiscount = 0
  let daysScale = 1
  if (selectedTypes.size === 2) {
    comboDiscount = 7000
    daysScale = 0.8
  } else if (selectedTypes.size >= 3) {
    comboDiscount = 15000
    daysScale = 0.7
  }

  let baseSum = Math.max(0, rawBase - comboDiscount)
  let addDays = 0

  availableOpts.forEach((opt) => {
    if (selectedOpts.has(opt.id)) {
      if (opt.price) baseSum += opt.price
      if (opt.days) addDays += opt.days
    }
  })

  const isUrgent = selectedOpts.has('urgent')
  const finalPrice = Math.round(isUrgent ? baseSum * 1.25 : baseSum)
  const minDays = Math.max(1, Math.round((minDaysSum * daysScale + addDays) * (isUrgent ? 0.6 : 1)))
  const maxDays = Math.max(2, Math.round((maxDaysSum * daysScale + addDays) * (isUrgent ? 0.6 : 1)))

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

    const names = []
    if (selectedTypes.has('website')) names.push('Сайт')
    if (selectedTypes.has('bot')) names.push('Telegram-бот')
    if (selectedTypes.has('automation')) names.push('Автоматизация')
    const typeTitle = names.join(' + ')

    const priceFormatted = `${finalPrice.toLocaleString('ru-RU')} ₽`
    const daysFormatted = `${minDays}–${maxDays} дней`
    const comboNote = comboDiscount > 0 ? ` (скидка комбо –${comboDiscount.toLocaleString('ru-RU')} ₽)` : ''

    const taskDescription = [
      `${typeTitle}${comboNote} (~${priceFormatted})`,
      activeOptTitles.length > 0 ? `Опции: ${activeOptTitles.join(', ')}` : 'Базовая комплектация',
      `Срок: ${daysFormatted}`,
    ].join(' • ')

    onOrder({
      calc: true,
      type: typeTitle,
      budget: priceFormatted,
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
            <span className="calc-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: '5px' }}>
                <path d="m13 2-9 12h8l-2 8 10-13h-8l3-7Z" />
              </svg>
              Интерактивный расчёт
            </span>
            <h2>Калькулятор проекта</h2>
            <p>Выбери одно или несколько направлений — получи честную вилку цен и сроков за 30 секунд</p>
          </div>
          <button className="calc-x" onClick={onClose} aria-label="Закрыть калькулятор" data-cursor="закрыть">
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="calc-body">
          {/* Шаг 1: Направления разработки (мультивыбор) */}
          <section className="calc-sec">
            <label className="calc-sec-title">
              <span className="calc-step-num">1</span>
              <span>Что разрабатываем?</span>
              <small className="calc-sec-sub">Выбирай любые направления — при комбо скидка до 15 000 ₽</small>
            </label>
            <div className="calc-types-grid">
              {CORE_TYPES.map((t) => {
                const active = selectedTypes.has(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`calc-type-card ${active ? 'is-active' : ''}`}
                    onClick={() => handleToggleType(t.id)}
                    data-cursor={active ? 'убрать' : 'выбрать'}
                    aria-pressed={active}
                  >
                    <div className="calc-card-top">
                      <span className="calc-type-icon">{t.icon}</span>
                      <b className="calc-type-price">от {t.basePrice.toLocaleString('ru-RU')} ₽</b>
                      <span className={`calc-checkbox ${active ? 'checked' : ''}`} aria-hidden="true">
                        {active && (
                          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 8 7 12 13 4" />
                          </svg>
                        )}
                      </span>
                    </div>
                    <strong className="calc-type-name">{t.name}</strong>
                    <span className="calc-type-desc">{t.desc}</span>
                  </button>
                )
              })}

              {/* 4-я карточка: Всё под ключ */}
              <button
                type="button"
                className={`calc-type-card calc-type-card--all ${isAllSelected ? 'is-active' : ''}`}
                onClick={handleSelectAll}
                data-cursor="комбо"
                aria-pressed={isAllSelected}
              >
                <div className="calc-card-top">
                  <span className="calc-type-icon">{ICONS.combo}</span>
                  <span className="calc-pill-badge" style={{ color: '#ff9ad5', borderColor: 'rgba(255,154,213,.4)', background: 'rgba(255,154,213,.15)' }}>
                    Выгода 15 000 ₽
                  </span>
                  <b className="calc-type-price">от 105 000 ₽</b>
                  <span className={`calc-checkbox ${isAllSelected ? 'checked' : ''}`} aria-hidden="true">
                    {isAllSelected && (
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 8 7 12 13 4" />
                      </svg>
                    )}
                  </span>
                </div>
                <strong className="calc-type-name">Всё под ключ: Сайт + Бот + n8n</strong>
                <span className="calc-type-desc">Полная экосистема: сайт привлекает лиды, бот их закрывает, n8n рулит CRM и сценариями</span>
              </button>
            </div>

            {/* Плашка активного комбо */}
            {selectedTypes.size === 2 && (
              <div className="calc-combo-alert">
                <span className="calc-alert-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
                <span>Выбрано 2 направления — комбо-скидка <b>–7 000 ₽</b> уже учтена в расчёте!</span>
              </div>
            )}
            {isAllSelected && (
              <div className="calc-combo-alert calc-combo-alert--max">
                <span className="calc-alert-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m4.5 16.5-1.5 3 3-1.5M12 15l-3-3m7-7-4 4M21 3l-6 1.5L9 10.5 4 12l8 8 1.5-5 6-6L21 3Z" />
                  </svg>
                </span>
                <span>Выбрана полная экосистема — максимальная скидка <b>–15 000 ₽</b> уже учтена в расчёте!</span>
              </div>
            )}
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
                    aria-pressed={active}
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
              <div className="calc-total-row">
                <b className="calc-total-val">~{finalPrice.toLocaleString('ru-RU')} ₽</b>
                {comboDiscount > 0 && (
                  <span className="calc-discount-tag">–{comboDiscount.toLocaleString('ru-RU')} ₽ скидка</span>
                )}
              </div>
            </div>
            <div className="calc-time">
              <span className="calc-time-lbl">Срок:</span>
              <b className="calc-time-val">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: '6px', color: '#b8f3ff' }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 15 14" />
                </svg>
                {minDays}–{maxDays} дней
              </b>
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
