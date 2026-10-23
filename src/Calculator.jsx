import { useState, useEffect, useRef, useCallback } from 'react'
import { playWaterDrop } from './audio.js'
import { useFocusTrap } from './a11y.js'
import { isMobile } from './mq.js'
import { profile, site } from './config.js'

export const ICONS = {
  shop: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  multilang: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  seo_starter: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <path d="m11 8 1.5 3 3 1.5-3 1.5L11 17l-1.5-3-3-1.5 3-1.5L11 8Z" />
    </svg>
  ),
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

export const CORE_TYPES = [
  {
    id: 'website',
    name: 'Сайт / Лендинг',
    basePrice: 60000,
    baseDays: [5, 7],
    icon: ICONS.website,
    desc: 'Адаптивный промо-сайт или лендинг с 3D, плавной анимацией и высокой конверсией',
  },
  {
    id: 'shop',
    name: 'Интернет-магазин',
    basePrice: 110000,
    baseDays: [10, 14],
    icon: ICONS.shop,
    desc: 'Каталог товаров, умная корзина, фильтры, личный кабинет и онлайн-оплата',
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

export const OPTIONS = [
  {
    id: 'graphics3d',
    title: '3D-графика и WebGL',
    price: 25000,
    days: 2,
    icon: ICONS.graphics3d,
    desc: 'Интерактивные 3D-модели товаров, Three.js, жидкие эффекты, кастомный курсор',
    for: ['website', 'shop'],
  },
  {
    id: 'payments',
    title: 'Приём платежей',
    price: 15000,
    days: 1,
    icon: ICONS.payments,
    desc: 'ЮKassa, Telegram Stars, СБП, Robokassa с чеками (54-ФЗ)',
    for: ['website', 'shop', 'bot'],
  },
  {
    id: 'ai',
    title: 'AI-ассистент / Консультант',
    price: 20000,
    days: 2,
    icon: ICONS.ai,
    desc: 'Умный ИИ-ассистент с обучением на данных твоей компании и каталоге',
    for: ['website', 'shop', 'bot', 'automation'],
  },
  {
    id: 'crm',
    title: 'CRM и базы данных',
    price: 15000,
    days: 1,
    icon: ICONS.crm,
    desc: 'AmoCRM, Bitrix24, Notion, PostgreSQL или Telegram-админка',
    for: ['website', 'shop', 'bot', 'automation'],
  },
  {
    id: 'webapp',
    title: 'Telegram Mini App (WebApp)',
    price: 25000,
    days: 2,
    icon: ICONS.webapp,
    desc: 'Полноценный каталог и оформление заказа прямо внутри Telegram',
    for: ['shop', 'bot'],
  },
  {
    id: 'multilang',
    title: 'Мультиязычность и валюты',
    price: 15000,
    days: 1,
    icon: ICONS.multilang,
    desc: 'Переключение языков (RU/EN/UZ/KZ) и мультивалютный расчёт',
    for: ['website', 'shop'],
  },
  {
    id: 'seo_starter',
    title: 'SEO-пакет & Скорость 90+',
    price: 12000,
    days: 1,
    icon: ICONS.seo_starter,
    desc: 'Микроразметка Schema.org, OpenGraph, sitemap, robots и PageSpeed 90+',
    for: ['website', 'shop'],
  },
  {
    id: 'n8n_addon',
    title: 'Автоматизация n8n (доп. модуль)',
    price: 25000,
    days: 2,
    icon: ICONS.n8n_addon,
    desc: 'Подключение сценариев n8n, сбор лидов, авто-воронка и вебхуки',
    for: ['website', 'shop', 'bot'],
    hideIfSelected: 'automation',
  },
  {
    id: 'urgent',
    title: 'Срочный запуск (Турбо)',
    rate: 0.25,
    icon: ICONS.urgent,
    badge: '–40% по сроку',
    desc: 'Приоритетная разработка без выходных в сжатые сроки',
    for: ['website', 'shop', 'bot', 'automation'],
  },
]

// Парсер query/hash параметров для инициализации и шер-ссылок
function parseUrlParams() {
  if (typeof location === 'undefined') return { types: null, opts: null }
  try {
    const rawHash = location.hash.includes('?') ? location.hash.slice(location.hash.indexOf('?') + 1) : ''
    const params = new URLSearchParams(rawHash || location.search)
    const typesStr = params.get('types') || params.get('calc')
    const optsStr = params.get('opts')

    const parsedTypes = typesStr
      ? typesStr.split(',').map((s) => s.trim()).filter((t) => CORE_TYPES.some((x) => x.id === t))
      : null
    const parsedOpts = optsStr
      ? optsStr.split(',').map((s) => s.trim()).filter((o) => OPTIONS.some((x) => x.id === o))
      : null

    return {
      types: parsedTypes && parsedTypes.length > 0 ? new Set(parsedTypes) : null,
      opts: parsedOpts && parsedOpts.length > 0 ? new Set(parsedOpts) : null,
    }
  } catch {
    return { types: null, opts: null }
  }
}

// Копирование в буфер обмена с fallback
async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function Calculator({ onClose, onOrder }) {
  const initParams = useRef(parseUrlParams()).current

  // Выбранные базовые направления (мультиселект: сайт, бот, автоматизация)
  const [selectedTypes, setSelectedTypes] = useState(() => {
    if (initParams.types) return initParams.types
    return new Set(['website'])
  })
  const [selectedOpts, setSelectedOpts] = useState(() => {
    if (initParams.opts) return initParams.opts
    return new Set()
  })

  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

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

  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }, [])

  const isAllSelected = selectedTypes.size === 4
  const isShopCombo = selectedTypes.size === 3 && selectedTypes.has('shop') && selectedTypes.has('bot') && selectedTypes.has('automation')
  const isSiteBotCombo = selectedTypes.size === 2 && selectedTypes.has('website') && selectedTypes.has('bot')

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
      setSelectedTypes(new Set(['website', 'shop', 'bot', 'automation']))
      playWaterDrop('bloop', isMuted())
    }
  }

  const handleSelectShopCombo = () => {
    if (isShopCombo) {
      setSelectedTypes(new Set(['shop']))
      playWaterDrop('pop', isMuted())
    } else {
      setSelectedTypes(new Set(['shop', 'bot', 'automation']))
      setSelectedOpts((prev) => {
        const next = new Set(prev)
        next.add('crm')
        next.add('payments')
        return next
      })
      playWaterDrop('bloop', isMuted())
    }
  }

  const handleSelectSiteBotCombo = () => {
    if (isSiteBotCombo) {
      setSelectedTypes(new Set(['website']))
      playWaterDrop('pop', isMuted())
    } else {
      setSelectedTypes(new Set(['website', 'bot']))
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
    comboDiscount = 10000
    daysScale = 0.85
  } else if (selectedTypes.size === 3) {
    comboDiscount = 18000
    daysScale = 0.75
  } else if (selectedTypes.size >= 4) {
    comboDiscount = 25000
    daysScale = 0.70
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

  // Генерация актуального URL для шеринга
  const getShareUrl = useCallback(() => {
    const isLocal = typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    const base = isLocal ? (location.origin + location.pathname) : (site.url || 'https://lolodss.github.io/mercursy')
    const cleanBase = base.replace(/\/$/, '') + '/'
    const typesParam = [...selectedTypes].join(',')
    const optsParam = [...selectedOpts].join(',')
    let query = `types=${typesParam}`
    if (optsParam) query += `&opts=${optsParam}`
    return `${cleanBase}#calc?${query}`
  }, [selectedTypes, selectedOpts])

  // Генерация отформатированного текста сметы для буфера обмена
  const getFormattedEstimate = useCallback(() => {
    const names = []
    if (selectedTypes.has('website')) names.push('Сайт / Лендинг')
    if (selectedTypes.has('shop')) names.push('Интернет-магазин')
    if (selectedTypes.has('bot')) names.push('Telegram-бот')
    if (selectedTypes.has('automation')) names.push('Автоматизация n8n')
    const typeTitle = names.join(' + ')

    const activeOpts = availableOpts.filter((o) => selectedOpts.has(o.id))
    const shareUrl = getShareUrl()

    const lines = [
      '📋 Смета проекта // mercury digital studio',
      '───────────────────────────────────────',
      `🛠 Направления: ${typeTitle || 'Сайт'}`,
    ]

    if (activeOpts.length > 0) {
      lines.push('⚡ Выбранные опции:')
      activeOpts.forEach((o) => {
        const p = o.rate ? `+${Math.round(o.rate * 100)}%` : `+${o.price.toLocaleString('ru-RU')} ₽`
        lines.push(`   • ${o.title} (${p})`)
      })
    } else {
      lines.push('⚡ Комплектация: Базовая конфигурация')
    }

    lines.push(`⏱ Ориентировочный срок: ${minDays}–${maxDays} дней`)

    if (comboDiscount > 0) {
      lines.push(`💰 Бюджет: ~${finalPrice.toLocaleString('ru-RU')} ₽ (включая комбо-скидку –${comboDiscount.toLocaleString('ru-RU')} ₽)`)
    } else {
      lines.push(`💰 Бюджет: ~${finalPrice.toLocaleString('ru-RU')} ₽`)
    }

    lines.push('───────────────────────────────────────')
    lines.push(`🔗 Открыть этот расчёт онлайн:\n${shareUrl}`)
    lines.push(`💬 Обсудить в Telegram: ${profile.telegram || 'https://t.me/Xitinchik'}`)

    return lines.join('\n')
  }, [selectedTypes, availableOpts, selectedOpts, getShareUrl, minDays, maxDays, comboDiscount, finalPrice])

  // 1. Копирование текстовой сметы
  const handleCopyEstimate = async () => {
    playWaterDrop('pop', isMuted())
    const text = getFormattedEstimate()
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      showToast('Смета скопирована в буфер обмена!')
      setTimeout(() => setCopied(false), 2500)
    }
  }

  // 2. Копирование / шаринг ссылки на смету
  const handleShareLink = async () => {
    const url = getShareUrl()
    const typeNames = []
    if (selectedTypes.has('website')) typeNames.push('Сайт')
    if (selectedTypes.has('shop')) typeNames.push('Магазин')
    if (selectedTypes.has('bot')) typeNames.push('Бот')
    if (selectedTypes.has('automation')) typeNames.push('n8n')

    // На мобилках при поддержке navigator.share открываем нативный диалог
    if (isMobile() && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        playWaterDrop('bloop', isMuted())
        await navigator.share({
          title: 'Смета проекта // mercury digital studio',
          text: `Расчёт: ${typeNames.join(' + ')} (~${finalPrice.toLocaleString('ru-RU')} ₽, ${minDays}–${maxDays} дней)`,
          url,
        })
        showToast('Расчёт отправлен!')
        return
      } catch {
        // Если отменено пользователем — fallback на копирование
      }
    }

    // Десктоп или fallback: копируем URL
    playWaterDrop('bloop', isMuted())
    const ok = await copyToClipboard(url)
    if (ok) {
      setLinkCopied(true)
      showToast('Ссылка на смету скопирована!')
      setTimeout(() => setLinkCopied(false), 2500)
    }
  }

  const handleOrder = () => {
    playWaterDrop('success', isMuted())
    const activeOptTitles = availableOpts
      .filter((o) => selectedOpts.has(o.id))
      .map((o) => o.title)

    const names = []
    if (selectedTypes.has('website')) names.push('Сайт')
    if (selectedTypes.has('shop')) names.push('Интернет-магазин')
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
              <small className="calc-sec-sub">Выбирай любые направления — при комбо скидка до 25 000 ₽</small>
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
            </div>

            {/* Быстрые комбо-пресеты */}
            <div className="calc-presets-bar">
              <span className="calc-presets-label">Готовые комбо:</span>
              <div className="calc-presets-chips">
                <button
                  type="button"
                  className={`calc-preset-chip ${isAllSelected ? 'is-active' : ''}`}
                  onClick={handleSelectAll}
                  data-cursor="комбо"
                  aria-pressed={isAllSelected}
                >
                  <span className="calc-preset-name">💎 Всё под ключ (4-в-1)</span>
                  <span className="calc-preset-save">–25 000 ₽</span>
                </button>
                <button
                  type="button"
                  className={`calc-preset-chip ${isShopCombo ? 'is-active' : ''}`}
                  onClick={handleSelectShopCombo}
                  data-cursor="комбо"
                  aria-pressed={isShopCombo}
                >
                  <span className="calc-preset-name">🛍 E-commerce + Бот + CRM</span>
                  <span className="calc-preset-save">–18 000 ₽</span>
                </button>
                <button
                  type="button"
                  className={`calc-preset-chip ${isSiteBotCombo ? 'is-active' : ''}`}
                  onClick={handleSelectSiteBotCombo}
                  data-cursor="комбо"
                  aria-pressed={isSiteBotCombo}
                >
                  <span className="calc-preset-name">⚡ Сайт + Бот</span>
                  <span className="calc-preset-save">–10 000 ₽</span>
                </button>
              </div>
            </div>

            {/* Плашка активного комбо */}
            {selectedTypes.size === 2 && (
              <div className="calc-combo-alert">
                <span className="calc-alert-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
                <span>Выбрано 2 направления — комбо-скидка <b>–10 000 ₽</b> уже учтена в расчёте!</span>
              </div>
            )}
            {selectedTypes.size === 3 && (
              <div className="calc-combo-alert calc-combo-alert--mid">
                <span className="calc-alert-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m4.5 16.5-1.5 3 3-1.5M12 15l-3-3m7-7-4 4M21 3l-6 1.5L9 10.5 4 12l8 8 1.5-5 6-6L21 3Z" />
                  </svg>
                </span>
                <span>Выбрано 3 направления — комбо-скидка <b>–18 000 ₽</b> уже учтена в расчёте!</span>
              </div>
            )}
            {selectedTypes.size >= 4 && (
              <div className="calc-combo-alert calc-combo-alert--max">
                <span className="calc-alert-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3h12l4 6-10 12L2 9l4-6Z" />
                    <path d="M2 9h20" />
                  </svg>
                </span>
                <span>Выбрана полная экосистема из 4 направлений — максимальная скидка <b>–25 000 ₽</b> уже учтена в расчёте!</span>
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

        {/* Футер с итогом и действиями */}
        <footer className="calc-foot">
          <div className="calc-summary">
            <div className="calc-total">
              <span className="calc-total-lbl">Ориентир бюджета:</span>
              <div className="calc-total-row">
                <b className="calc-total-val">~{finalPrice.toLocaleString('ru-RU')}&nbsp;₽</b>
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
                {minDays}–{maxDays}&nbsp;дней
              </b>
            </div>
          </div>

          <div className="calc-actions">
            <div className="calc-action-aux">
              <button
                type="button"
                className={`btn line calc-btn-aux ${copied ? 'is-copied' : ''}`}
                onClick={handleCopyEstimate}
                title="Скопировать структурированную смету со ссылкой в буфер обмена"
                data-cursor={copied ? 'готово' : 'копия'}
                aria-label="Скопировать смету в буфер"
              >
                {copied ? (
                  <>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#7dff9b' }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Скопировано!</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Скопировать смету</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className={`btn line calc-btn-aux ${linkCopied ? 'is-copied' : ''}`}
                onClick={handleShareLink}
                title="Поделиться прямой ссылкой на этот расчёт"
                data-cursor={linkCopied ? 'готово' : 'ссылка'}
                aria-label="Поделиться ссылкой на расчёт"
              >
                {linkCopied ? (
                  <>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#7dff9b' }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Ссылка скопирована!</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    <span>Поделиться</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              className="btn chrome calc-order-btn"
              onClick={handleOrder}
              data-cursor="заказать"
            >
              <span>Оформить заказ</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

          {toast && (
            <div className="calc-toast" role="status" aria-live="polite">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#7dff9b', flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{toast}</span>
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}
