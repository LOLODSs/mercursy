/**
 * Mercury Telegram Bot Engine & Mini-CRM
 * Features:
 *   - Persistent Local Mini-CRM (leads.json storage)
 *   - Financial analytics & Revenue tracker
 *   - Manual Deal Creation (➕ Добавить сделку)
 *   - Notes / Timeline system for projects
 *   - Quick reply templates for clients
 *   - CSV Export directly into Telegram chat
 *   - Lead lists by status: In Progress, New, Done, Archive
 *   - Admin Dashboard (/start, /crm, /admin)
 *   - Client Interactive Assistant (Cases, Calculator, Brief wizard)
 */

import { readFileSync, existsSync } from 'node:fs'
import {
  getAllLeads,
  addLead,
  getLead,
  updateLeadStatus,
  addLeadNote,
  deleteLead,
  getLeadsByStatus,
  getStats,
  getFinancialStats,
  formatRubles,
  parseAmount,
  exportLeadsToCsv,
  updateLeadField,
  searchLeads,
  setLeadPayment,
} from '../server/crm.js'

// Load .env
function loadEnvFile() {
  if (!existsSync('.env')) return {}
  const raw = readFileSync('.env', 'utf8')
  return Object.fromEntries(
    raw.split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const idx = l.indexOf('=')
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
      })
  )
}

const env = { ...process.env, ...loadEnvFile() }
const TOKEN = env.TELEGRAM_BOT_TOKEN
const ADMIN_ID = env.TELEGRAM_CHAT_ID ? String(env.TELEGRAM_CHAT_ID) : null

if (!TOKEN) {
  console.error('[Bot] ❌ TELEGRAM_BOT_TOKEN не задан в .env')
  process.exit(1)
}

const API = `https://api.telegram.org/bot${TOKEN}`

// Telegram API Helper
async function tg(method, body = {}) {
  try {
    const res = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.ok) {
      console.warn(`[Bot] tg.${method} warning:`, data.description)
    }
    return data
  } catch (err) {
    console.error(`[Bot] tg.${method} network failure:`, err.message)
    return { ok: false, error: err.message }
  }
}

// Client notifier (for project status updates & proposal delivery)
async function notifyClient(clientId, text, reply_markup = undefined) {
  if (!clientId) return
  try {
    await tg('sendMessage', {
      chat_id: clientId,
      text,
      parse_mode: 'HTML',
      reply_markup,
    })
  } catch (err) {
    console.warn('[Bot] Не удалось отправить уведомление клиенту:', err.message)
  }
}

// Memory sessions
const clientSessions = new Map() // clientChatId -> { step, data }
const adminSessions = new Map()  // adminChatId -> { type, step, data }

// Persistent bottom reply keyboard for Admin
const ADMIN_KEYBOARD = {
  keyboard: [
    [{ text: '📊 CRM' }, { text: '🟡 В работе' }, { text: '📥 Новые' }],
    [{ text: '☀️ Мой день' }, { text: '💰 Финансы' }, { text: '🔍 Поиск' }],
    [{ text: '➕ Добавить сделку' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
}

// Cases data
const CASES = {
  ava: {
    title: 'AVA · Квартал «Светлый»',
    tag: '3D-сайт · Three.js',
    desc: 'Архитектурный 3D-макет квартала под живым солнцем: 24-часовой световой день, инсоляция и светящиеся окна.',
    metrics: '• 3 412 живых 3D-окон\n• 60 FPS на Three.js + WebGL\n• 24 ч цикл солнца в 3D',
    stack: 'Three.js, WebGL, GSAP, Lenis, Vite',
    type: '3D-сайт',
  },
  nogina: {
    title: '«На Ногина» · Пространство красоты',
    tag: 'Премиум-сайт · Next.js',
    desc: 'Премиальный сайт пространства эстетики: видео-текстуры, интерактивный прайс и онлайн-запись.',
    metrics: '• +42% рост онлайн-записей\n• 1.1 с скорость загрузки\n• 8 бьюти-направлений',
    stack: 'Next.js, React, Tailwind CSS, GSAP',
    type: 'Сайт под ключ',
  },
  mokryi: {
    title: 'Мокрый нос · Книга-раскладушка',
    tag: '3D-сайт · Three.js Pop-up',
    desc: 'Интерактивная 3D-книга ветклиники с поп-ап диорамами, лампой и светящейся краской.',
    metrics: '• 5 3D поп-ап глав\n• 60 FPS на Three.js\n• 2 режима: день и светящаяся ночь',
    stack: 'Three.js, WebGL, 3D Pop-up, Vite',
    type: '3D-сайт',
  },
  barber: {
    title: 'Barber Bot',
    tag: 'Telegram-бот записи 24/7',
    desc: 'Бот записи в барбершоп: выбор услуги, мастера и слота, предоплата и напоминания за 2 часа.',
    metrics: '• −70% неявок клиентов\n• 24/7 приём записей\n• 0 ручной работы администратора',
    stack: 'Node.js, Telegram API, YClients',
    type: 'Telegram-бот',
  },
  leadflow: {
    title: 'Lead Flow',
    tag: 'Автоматизация · n8n + AI',
    desc: 'Заявки с сайта → AI-разбор → сделка в CRM → мгновенный пинг менеджеру в Telegram.',
    metrics: '• 3 мин до первого ответа клиенту\n• 0 потерянных заявок\n• 12 ч/неделю сэкономлено',
    stack: 'n8n, OpenAI, amoCRM, Telegram API',
    type: 'Автоматизация',
  },
  poluden: {
    title: 'ПОЛДЕНЬ. · Пекарня-кофейня',
    tag: 'Атмосферный сайт · React + Vite',
    desc: 'Живое солнце над Москвой, расписание партий выпечки в реальном времени, интерактивное меню и онлайн-бронь столов.',
    metrics: '• 4.9 ★ на картах (800+ отзывов)\n• 100% броней столов онлайн\n• 3+ мин среднее время на сайте',
    stack: 'React, Vite, View Transitions API, SVG Map',
    type: 'Сайт под ключ',
  },
}

function stripHtml(html = '') {
  return html.replace(/<[^>]*>?/gm, '').trim()
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function statusBadge(status) {
  switch (status) {
    case 'in_progress':
      return '🟡 В работе'
    case 'done':
      return '🟢 Завершён'
    case 'archived':
      return '⚪ В архиве'
    case 'new':
    default:
      return '📥 Новая'
  }
}

// -------------------------------------------------------------
// CRM Views
// -------------------------------------------------------------

function renderAdminDashboard() {
  const stats = getStats()
  const fin = getFinancialStats()

  const text = [
    '👑 <b>Мини-CRM mercury</b>',
    '',
    '📊 <b>Проекты:</b>',
    `• 🟡 В работе: <b>${stats.in_progress}</b> (${formatRubles(fin.inProgressSum)})`,
    `• 📥 Новые заявки: <b>${stats.new}</b>`,
    `• 🟢 Завершено: <b>${stats.done}</b> (${formatRubles(fin.doneSum)})`,
    `• ⚪ В архиве: <b>${stats.archived}</b>`,
    `• 📁 Всего в базе: <b>${stats.total}</b>`,
    '',
    'Выбери категорию или действие:',
  ].join('\n')

  const reply_markup = {
    inline_keyboard: [
      [
        { text: `🟡 В работе (${stats.in_progress})`, callback_data: 'crm:list:in_progress' },
        { text: `📥 Новые (${stats.new})`, callback_data: 'crm:list:new' },
      ],
      [
        { text: `🟢 Сданные (${stats.done})`, callback_data: 'crm:list:done' },
        { text: `⚪ Архив (${stats.archived})`, callback_data: 'crm:list:archived' },
      ],
      [
        { text: '☀️ Мой день', callback_data: 'crm:digest' },
        { text: '➕ Добавить сделку', callback_data: 'crm:add_deal' },
      ],
      [
        { text: '💰 Финансы', callback_data: 'crm:finances' },
        { text: '🔍 Поиск по базе', callback_data: 'crm:search' },
      ],
      [
        { text: '📥 Скачать базу (.csv)', callback_data: 'crm:export_csv' },
        { text: '👥 Клиентское меню', callback_data: 'client:menu' },
      ],
      [
        { text: '🧪 Тест-лид', callback_data: 'admin:test_lead' },
      ],
    ],
  }

  return { text, reply_markup }
}

function renderLeadList(status) {
  const leads = getLeadsByStatus(status)
  const title = statusBadge(status)

  if (!leads.length) {
    const text = [
      `📂 <b>Категория: ${title}</b>`,
      '',
      'Здесь пока пусто.',
    ].join('\n')

    return {
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Добавить проект сюда', callback_data: 'crm:add_deal' }],
          [{ text: '🔙 Назад в CRM', callback_data: 'crm:home' }],
        ],
      },
    }
  }

  const lines = [
    `📂 <b>Категория: ${title} (${leads.length})</b>`,
    '',
    'Нажми на проект ниже, чтобы открыть его карточку:',
    '',
  ]

  leads.forEach((l, idx) => {
    lines.push(`<b>${idx + 1}. ${l.name}</b> (${l.type})`)
    lines.push(`• Бюджет: ${l.budget} | ${formatDate(l.updatedAt || l.createdAt)}`)
    lines.push(`• Контакт: ${l.contact}`)
    lines.push('')
  })

  const buttons = leads.slice(0, 8).map((l, idx) => [
    { text: `${idx + 1}. ${l.name} — ${l.budget}`, callback_data: `crm:view:${l.id}` },
  ])
  buttons.push([{ text: '🔙 Назад в CRM', callback_data: 'crm:home' }])

  return { text: lines.join('\n'), reply_markup: { inline_keyboard: buttons } }
}

function renderSearchResults(query) {
  const results = searchLeads(query)
  if (!results.length) {
    return {
      text: [
        `🔍 <b>Поиск по запросу «${stripHtml(query)}»:</b>`,
        '',
        'Ничего не найдено в базе сделок.',
      ].join('\n'),
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Создать сделку', callback_data: 'crm:add_deal' }],
          [{ text: '🔙 В главное меню CRM', callback_data: 'crm:home' }],
        ],
      },
    }
  }

  const lines = [
    `🔍 <b>Результаты поиска по «${stripHtml(query)}» (${results.length}):</b>`,
    '',
  ]
  results.slice(0, 8).forEach((l, idx) => {
    lines.push(`<b>${idx + 1}. ${l.name}</b> (${statusBadge(l.status)})`)
    lines.push(`• Бюджет: ${l.budget} | Сроки: ${l.deadline}`)
    lines.push(`• Контакт: <code>${l.contact}</code>`)
    lines.push('')
  })
  lines.push('Нажми на проект ниже, чтобы открыть карточку:')

  const buttons = results.slice(0, 8).map((l, idx) => [
    { text: `${idx + 1}. ${l.name} — ${l.budget}`, callback_data: `crm:view:${l.id}` },
  ])
  buttons.push([{ text: '🔙 Назад в CRM', callback_data: 'crm:home' }])

  return { text: lines.join('\n'), reply_markup: { inline_keyboard: buttons } }
}

function paymentBadge(lead) {
  const price = lead.price || parseAmount(lead.budget)
  const half = Math.round(price / 2)
  if (lead.paymentStatus === 'paid_full') {
    return `🟢 <b>100% оплачено</b> (${formatRubles(price)})`
  }
  if (lead.paymentStatus === 'advance_50') {
    return `🟡 <b>Аванс 50% внесён</b> (${formatRubles(half)}), остаток: ${formatRubles(half)}`
  }
  return '⚪ <i>Ожидает аванса / не оплачен</i>'
}

function renderLeadCard(lead) {
  const tgHandle = lead.contact.startsWith('@')
    ? lead.contact.slice(1)
    : lead.contact.match(/(?:t\.me|telegram\.me)\/([\w\d_]{4,})/i)?.[1] || null

  const notesList = (lead.notes || []).length
    ? '\n📌 <b>Заметки:</b>\n' + lead.notes.map((n) => `• <i>[${formatDate(n.createdAt)}]</i> ${n.text}`).join('\n')
    : ''

  const text = [
    `📁 <b>Карточка проекта: ${lead.name}</b>`,
    `Статус: <b>${statusBadge(lead.status)}</b>`,
    '',
    `👤 <b>Клиент:</b> ${lead.name}`,
    `📬 <b>Контакт:</b> <code>${lead.contact}</code>`,
    lead.clientId ? `🆔 <b>Telegram ID клиента:</b> <code>${lead.clientId}</code>` : '',
    `🧩 <b>Тип проекта:</b> ${lead.type}${lead.ref ? ` (${lead.ref})` : ''}`,
    `📝 <b>Задача:</b>\n${lead.task}`,
    '',
    `💰 <b>Бюджет:</b> ${lead.budget}`,
    `💳 <b>Оплата:</b> ${paymentBadge(lead)}`,
    `⏰ <b>Сроки:</b> ${lead.deadline}`,
    `📅 <b>Создан:</b> ${formatDate(lead.createdAt)}`,
    lead.updatedAt ? `🔄 <b>Обновлён:</b> ${formatDate(lead.updatedAt)}` : '',
    notesList,
    '',
    '⚡ <b>Управление проектом:</b>',
  ].filter(Boolean).join('\n')

  const buttons = []
  if (tgHandle) {
    buttons.push([{ text: '✍️ Ответить клиенту в Telegram', url: `https://t.me/${tgHandle}` }])
  }

  const statusRow = []
  if (lead.status !== 'in_progress') {
    statusRow.push({ text: '🟡 В работу', callback_data: `crm:set_status:${lead.id}:in_progress` })
  }
  if (lead.status !== 'done') {
    statusRow.push({ text: '🟢 Сдан', callback_data: `crm:set_status:${lead.id}:done` })
  }
  if (lead.status !== 'archived') {
    statusRow.push({ text: '⚪ В архив', callback_data: `crm:set_status:${lead.id}:archived` })
  }
  if (statusRow.length) buttons.push(statusRow)

  // Payment management buttons
  if (lead.paymentStatus === 'paid_full') {
    buttons.push([
      { text: '✅ Оплачено 100%', callback_data: `crm:set_pay:${lead.id}:paid_full` },
      { text: '🔄 Сброс оплаты', callback_data: `crm:set_pay:${lead.id}:unpaid` },
    ])
  } else if (lead.paymentStatus === 'advance_50') {
    buttons.push([
      { text: '💰 Оплачено 100%', callback_data: `crm:set_pay:${lead.id}:paid_full` },
      { text: '🔄 Сброс оплаты', callback_data: `crm:set_pay:${lead.id}:unpaid` },
    ])
  } else {
    buttons.push([
      { text: '💳 Внесено 50%', callback_data: `crm:set_pay:${lead.id}:advance_50` },
      { text: '💰 Оплачено 100%', callback_data: `crm:set_pay:${lead.id}:paid_full` },
    ])
  }

  // Quick edits
  buttons.push([
    { text: '✏️ Бюджет', callback_data: `crm:edit:${lead.id}:budget` },
    { text: '⏰ Сроки', callback_data: `crm:edit:${lead.id}:deadline` },
    { text: '📬 Контакт', callback_data: `crm:edit:${lead.id}:contact` },
  ])

  // Commercial proposal & templates
  buttons.push([
    { text: '📄 Сформировать КП', callback_data: `crm:make_kp:${lead.id}` },
    { text: '💬 Шаблоны ответов', callback_data: `crm:tpl_menu:${lead.id}` },
  ])

  buttons.push([
    { text: '📝 Добавить заметку', callback_data: `crm:add_note:${lead.id}` },
    { text: '📋 Копировать бриф', callback_data: `crm:copy:${lead.id}` },
  ])

  buttons.push([
    { text: '❌ Удалить проект', callback_data: `crm:delete:${lead.id}` },
    { text: `🔙 К списку (${statusBadge(lead.status)})`, callback_data: `crm:list:${lead.status}` },
  ])

  buttons.push([
    { text: '🏠 Меню CRM', callback_data: 'crm:home' },
  ])

  return { text, reply_markup: { inline_keyboard: buttons } }
}

function renderDailyDigest() {
  const inProgress = getLeadsByStatus('in_progress')
  const newLeads = getLeadsByStatus('new')
  const fin = getFinancialStats()

  const todayStr = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const capitalizedToday = todayStr.charAt(0).toUpperCase() + todayStr.slice(1)

  const lines = [
    `☀️ <b>Сводка дня mercury CRM</b>`,
    `📅 <i>${capitalizedToday}</i>`,
    '',
    `🟡 <b>В работе: ${inProgress.length} проектов</b> (${formatRubles(fin.inProgressSum)})`,
  ]

  if (inProgress.length === 0) {
    lines.push('• Нет активных проектов в разработке')
  } else {
    inProgress.forEach((l, idx) => {
      const payIcon = l.paymentStatus === 'paid_full' ? '🟢 100%' : l.paymentStatus === 'advance_50' ? '🟡 50%' : '⚪ без аванса'
      lines.push(`<b>${idx + 1}. ${l.name}</b> — ${l.budget}`)
      lines.push(`   └ ⏰ ${l.deadline} | 💳 ${payIcon} | <code>${l.contact}</code>`)
    })
  }

  lines.push('')
  lines.push(`📥 <b>Новых входящих: ${newLeads.length}</b>`)
  if (newLeads.length > 0) {
    newLeads.slice(0, 3).forEach((l, idx) => {
      lines.push(`• <b>${l.name}</b> (${l.type}): <code>${l.contact}</code>`)
    })
    if (newLeads.length > 3) {
      lines.push(`  <i>...и ещё ${newLeads.length - 3} заявок</i>`)
    }
  }

  lines.push('')
  lines.push('💰 <b>Финансовый пульс:</b>')
  lines.push(`• Авансов получено: <b>${formatRubles(fin.advanceCollected)}</b>`)
  lines.push(`• Остаток к получению: <b>${formatRubles(fin.advanceRemaining)}</b>`)
  lines.push(`• Выручка со сданных: <b>${formatRubles(fin.doneSum)}</b> (${fin.doneCount} проектов)`)

  const buttons = []
  if (inProgress.length > 0) {
    buttons.push(inProgress.slice(0, 4).map((l, idx) => ({
      text: `${idx + 1}. ${l.name}`,
      callback_data: `crm:view:${l.id}`,
    })))
  }
  if (newLeads.length > 0) {
    buttons.push([{ text: `📥 Разобрать новые (${newLeads.length})`, callback_data: 'crm:list:new' }])
  }
  buttons.push([
    { text: '➕ Добавить сделку', callback_data: 'crm:add_deal' },
    { text: '💰 Финансы', callback_data: 'crm:finances' },
  ])
  buttons.push([{ text: '🏠 Меню CRM', callback_data: 'crm:home' }])

  return { text, reply_markup: { inline_keyboard: buttons } }
}

function renderCommercialProposal(lead) {
  const price = lead.budget && lead.budget !== 'Уточняется' ? lead.budget : 'по согласованию'
  const time = lead.deadline && lead.deadline !== 'Уточняется' ? lead.deadline : '5–8 рабочих дней'
  const halfPrice = lead.price ? formatRubles(Math.round(lead.price / 2)) : '50% от суммы'

  const proposalText = [
    `🤝 Коммерческое предложение: ${lead.type || 'Разработка проекта'}`,
    `Для: ${lead.name}`,
    '',
    `1. Задача проекта:`,
    `${lead.task || 'Создание и запуск современного цифрового решения под ключ.'}`,
    '',
    `2. Что входит в реализацию:`,
    `• Индивидуальный концепт и адаптивная вёрстка (Desktop, планшеты, смартфоны)`,
    `• Плавная анимация, интерактив и высокая скорость загрузки`,
    `• Настройка форм сбора заявок с мгновенным оповещением в Telegram`,
    `• Базовая SEO-оптимизация, подключение домена и SSL-сертификата`,
    `• 3 круга правок включено бесплатно (далее — по согласованию)`,
    '',
    `3. Этапы и ориентир по срокам (${time}):`,
    `• Этап 1 (1 день): Согласование структуры и технического задания`,
    `• Этап 2 (2–3 дня): Интерактивный прототип и визуальный дизайн`,
    `• Этап 3 (3–5 дней): Разработка, анимации, интеграции и адаптив`,
    `• Этап 4 (1–2 дня): Тестирование, перенос на ваш хостинг и релиз`,
    '',
    `4. Стоимость и порядок оплаты:`,
    `• Стоимость проекта: ${price}`,
    `• Условия: 50% предоплата перед стартом (${halfPrice}), 50% после демонстрации и приёмки проекта`,
    '',
    `Готовы запустить разработку в ближайшие дни! Напишите, если согласовываем — пришлю реквизиты и начнём. 🚀`,
  ].join('\n')

  const text = [
    `📄 <b>Коммерческое предложение для «${lead.name}»</b>`,
    '',
    `<code>${stripHtml(proposalText)}</code>`,
    '',
    '<i>(Нажми на текст выше, чтобы скопировать готовое КП)</i>',
  ].join('\n')

  const tgHandle = lead.contact.startsWith('@')
    ? lead.contact.slice(1)
    : lead.contact.match(/(?:t\.me|telegram\.me)\/([\w\d_]{4,})/i)?.[1] || null

  const buttons = []
  if (tgHandle) {
    buttons.push([{ text: '✍️ Открыть диалог с клиентом', url: `https://t.me/${tgHandle}` }])
  }
  if (lead.clientId) {
    buttons.push([{ text: '🚀 Отправить КП прямо клиенту в бот', callback_data: `crm:send_kp:${lead.id}` }])
  }
  buttons.push([
    { text: '🔙 Назад в карточку', callback_data: `crm:view:${lead.id}` },
    { text: '🏠 Меню CRM', callback_data: 'crm:home' },
  ])

  return { text, reply_markup: { inline_keyboard: buttons }, proposalText }
}

function renderFinancialDashboard() {
  const fin = getFinancialStats()
  const stats = getStats()

  const text = [
    '💰 <b>Финансовая аналитика mercury</b>',
    '',
    '🟡 <b>В работе прямо сейчас:</b>',
    `• Проектов: <b>${fin.inProgressCount}</b>`,
    `• Сумма в работе: <b>${formatRubles(fin.inProgressSum)}</b>`,
    `• Авансов получено (50%): <b>${formatRubles(fin.advanceCollected)}</b>`,
    `• Ожидает получения: <b>${formatRubles(fin.advanceRemaining)}</b>`,
    '',
    '🟢 <b>Уже заработано (сдано):</b>',
    `• Сдано проектов: <b>${fin.doneCount}</b>`,
    `• Общая выручка: <b>${formatRubles(fin.doneSum)}</b>`,
    '',
    '📈 <b>Метрики эффективности:</b>',
    `• Средний чек проекта: <b>${formatRubles(fin.avgCheck)}</b>`,
    `• Общий пайплайн сделок: <b>${formatRubles(fin.totalPipeline)}</b>`,
    `• Всего заявок обработано: <b>${stats.total}</b>`,
  ].join('\n')

  const reply_markup = {
    inline_keyboard: [
      [{ text: '🟡 Проекты в работе', callback_data: 'crm:list:in_progress' }, { text: '🟢 Сданные', callback_data: 'crm:list:done' }],
      [{ text: '📥 Скачать отчёт в CSV', callback_data: 'crm:export_csv' }],
      [{ text: '🔙 Назад в CRM', callback_data: 'crm:home' }],
    ],
  }

  return { text, reply_markup }
}

function renderTemplatesMenu(lead) {
  const text = [
    `💬 <b>Шаблоны быстрых ответов для: ${lead.name}</b>`,
    '',
    'Выбери шаблон — бот сгенерирует готовый персональный текст для отправки:',
  ].join('\n')

  const reply_markup = {
    inline_keyboard: [
      [{ text: '📄 1. Запрос ТЗ и материалов', callback_data: `crm:show_tpl:${lead.id}:tz` }],
      [{ text: '💳 2. Предоплата и реквизиты', callback_data: `crm:show_tpl:${lead.id}:prepay` }],
      [{ text: '🚀 3. Проект готов на проверку', callback_data: `crm:show_tpl:${lead.id}:review` }],
      [{ text: '⭐ 4. Запрос отзыва после сдачи', callback_data: `crm:show_tpl:${lead.id}:feedback` }],
      [{ text: '🔙 Назад в карточку', callback_data: `crm:view:${lead.id}` }],
    ],
  }

  return { text, reply_markup }
}

// -------------------------------------------------------------
// Message & Callback Routing
// -------------------------------------------------------------

async function handleStart(chatId, from) {
  const isMe = ADMIN_ID && String(chatId) === ADMIN_ID

  if (isMe) {
    adminSessions.delete(chatId)
    await tg('sendMessage', {
      chat_id: chatId,
      text: '👑 <b>Панель управления mercury CRM</b>\nБыстрые кнопки закреплены внизу экрана 👇',
      parse_mode: 'HTML',
      reply_markup: ADMIN_KEYBOARD,
    })
    const { text, reply_markup } = renderAdminDashboard()
    return tg('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup,
    })
  }

  // Client Welcome
  clientSessions.delete(chatId)
  const clientText = [
    `Привет, <b>${from.first_name || 'друг'}</b>! 👋`,
    '',
    'Я интерактивный ассистент портфолио <b>mercury</b>.',
    'Разрабатываю премиальные <b>3D-сайты</b>, умных <b>Telegram-ботов</b> и автоматизации на <b>n8n</b>.',
    '',
    'Чем могу помочь?',
  ].join('\n')

  const clientMarkup = {
    inline_keyboard: [
      [
        { text: '📂 Кейсы и работы (5 проектов)', callback_data: 'client:cases' },
      ],
      [
        { text: '💰 Рассчитать стоимость проекта', callback_data: 'calc:start' },
      ],
      [
        { text: '📝 Заполнить бриф за 1 минуту', callback_data: 'brief:start' },
      ],
      [
        { text: '💬 Написать лично Даде (@Xitinchik)', url: 'https://t.me/Xitinchik' },
      ],
    ],
  }

  return tg('sendMessage', {
    chat_id: chatId,
    text: clientText,
    parse_mode: 'HTML',
    reply_markup: clientMarkup,
  })
}

async function handleCallback(cb) {
  const chatId = cb.message?.chat?.id
  const msgId = cb.message?.message_id
  const data = cb.data || ''

  // 1. CRM Dashboard Navigation
  if (data === 'crm:home' || data === 'admin:menu') {
    adminSessions.delete(chatId)
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    const { text, reply_markup } = renderAdminDashboard()
    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup,
    })
  }

  if (data === 'crm:finances') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    const { text, reply_markup } = renderFinancialDashboard()
    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup,
    })
  }

  // 2. Export CSV directly into chat!
  if (data === 'crm:export_csv') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Формирую файл базы...' })
    try {
      const csvData = exportLeadsToCsv()
      const formData = new FormData()
      formData.append('chat_id', chatId)
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' })
      const filename = `mercury_crm_${new Date().toISOString().slice(0, 10)}.csv`
      formData.append('document', blob, filename)
      formData.append('caption', '📊 <b>Выгрузка всех клиентов и сделок из CRM mercury</b>\nФайл готов к открытию в Excel или Google Таблицах.')
      formData.append('parse_mode', 'HTML')

      await fetch(`${API}/sendDocument`, {
        method: 'POST',
        body: formData,
      })
    } catch (err) {
      console.error('[Bot] export_csv error:', err.message)
      await tg('sendMessage', {
        chat_id: chatId,
        text: '❌ Ошибка при отправке файла: ' + err.message,
      })
    }
    return
  }

  // 3. Manual Deal Creation wizard
  if (data === 'crm:add_deal') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    adminSessions.set(chatId, {
      type: 'create_deal',
      step: 'name',
      data: {},
    })

    return tg('sendMessage', {
      chat_id: chatId,
      text: '➕ <b>Создание новой сделки (1 из 5)</b>\n\nКак зовут клиента?',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Отмена', callback_data: 'crm:home' }]],
      },
    })
  }

  // 4. Add Note to lead
  if (data.startsWith('crm:add_note:')) {
    const leadId = data.split(':')[2]
    const lead = getLead(leadId)
    await tg('answerCallbackQuery', { callback_query_id: cb.id })

    adminSessions.set(chatId, {
      type: 'add_note',
      leadId,
    })

    return tg('sendMessage', {
      chat_id: chatId,
      text: `📝 <b>Добавление заметки к проекту «${lead?.name || 'Лид'}»:</b>\n\nНапиши текст заметки (например: <i>«Внёс 50% предоплаты»</i> или <i>«Жду логотип до понедельника»</i>):`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Отмена', callback_data: `crm:view:${leadId}` }]],
      },
    })
  }

  // Search prompt
  if (data === 'crm:search') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    adminSessions.set(chatId, { type: 'search' })
    return tg('sendMessage', {
      chat_id: chatId,
      text: '🔍 <b>Поиск по базе сделок:</b>\n\nВведи имя клиента, контакт (@username, телефон) или слово из задачи:',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Отмена', callback_data: 'crm:home' }]],
      },
    })
  }

  // Quick edits (budget, deadline, contact)
  if (data.startsWith('crm:edit:')) {
    const [, , leadId, field] = data.split(':')
    const lead = getLead(leadId)
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    if (!lead) return

    adminSessions.set(chatId, { type: 'edit_field', leadId, field })
    const prompts = {
      budget: `💰 <b>Изменение бюджета для «${lead.name}»:</b>\n\nТекущий бюджет: <b>${lead.budget}</b>\n\nВведи новую сумму (например: <i>95 000 ₽</i>):`,
      deadline: `⏰ <b>Изменение сроков для «${lead.name}»:</b>\n\nТекущие сроки: <b>${lead.deadline}</b>\n\nВведи новый дедлайн (например: <i>5 дней</i> или <i>до 25 октября</i>):`,
      contact: `📬 <b>Изменение контакта для «${lead.name}»:</b>\n\nТекущий контакт: <code>${lead.contact}</code>\n\nВведи новый контакт (@username, телефон или ссылка):`,
    }

    return tg('sendMessage', {
      chat_id: chatId,
      text: prompts[field] || 'Введи новое значение:',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Отмена', callback_data: `crm:view:${leadId}` }]],
      },
    })
  }

  // 5. Reply Templates
  if (data.startsWith('crm:tpl_menu:')) {
    const leadId = data.split(':')[2]
    const lead = getLead(leadId)
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    if (!lead) return
    const { text, reply_markup } = renderTemplatesMenu(lead)
    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup,
    })
  }

  if (data.startsWith('crm:show_tpl:')) {
    const [, , leadId, tplType] = data.split(':')
    const lead = getLead(leadId)
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    if (!lead) return

    let tplText = ''
    if (tplType === 'tz') {
      tplText = `Здравствуйте, ${lead.name}! 👋\n\nРад познакомиться. Чтобы я мог составить точный план и структуру по вашей задаче («${lead.type}»), подскажите:\n1. Есть ли уже готовые референсы сайтов/ботов, которые нравятся визуально?\n2. Есть ли готовый логотип и фирменные цвета?\n3. Какой дедлайн самый комфортный для релиза?\n\nЖду ответ, и сразу приступаем!`
    } else if (tplType === 'prepay') {
      const halfPrice = lead.price ? formatRubles(Math.round(lead.price / 2)) : '50% стоимости'
      tplText = `Здравствуйте, ${lead.name}! 🤝\n\nВсе детали по проекту зафиксировали. Для официального старта и бронирования спринта вносится 50% предоплаты (${halfPrice}).\n\nРеквизиты для оплаты:\n[Твой банк / СБП / Счёт]\n\nПосле перевода сразу запускаю этап структуры и концепта!`
    } else if (tplType === 'review') {
      tplText = `${lead.name}, добрый день! 🚀\n\nПроект готов к первому ревью! Собрал для вас версию со всей интерактивностью и анимациями:\n[Ссылка на тест / демо]\n\nПосмотрите, покрутите интерактив и дайте обратную связь. Если будут точечные правки — сразу внесу!`
    } else {
      tplText = `${lead.name}, спасибо за совместную работу! 🎉\n\nПроект успешно сдан и работает. Буду очень благодарен, если напишете пару строк честного отзыва — как вам скорость, подход и результат? Это очень поможет мне в развитии!\n\nИ если понадобятся новые доработки или боты — я всегда на связи!`
    }

    const text = [
      `📋 <b>Готовый шаблон для отправки:</b>`,
      '',
      `<code>${stripHtml(tplText)}</code>`,
      '',
      '<i>(Нажми на текст выше, чтобы скопировать его в буфер обмена)</i>',
    ].join('\n')

    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✍️ Открыть диалог с клиентом', url: lead.contact.startsWith('@') ? `https://t.me/${lead.contact.slice(1)}` : 'https://t.me/' }],
          [{ text: '🔙 К шаблонам', callback_data: `crm:tpl_menu:${leadId}` }, { text: '📁 Карточка', callback_data: `crm:view:${leadId}` }],
        ],
      },
    })
  }

  // 6. Lead lists
  if (data.startsWith('crm:list:')) {
    const status = data.split(':')[2]
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    const { text, reply_markup } = renderLeadList(status)
    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup,
    })
  }

  // View specific lead card
  if (data.startsWith('crm:view:')) {
    const leadId = data.split(':')[2]
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    const lead = getLead(leadId)
    if (!lead) {
      return tg('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: 'Лид не найден в базе CRM',
        show_alert: true,
      })
    }
    const { text, reply_markup } = renderLeadCard(lead)
    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup,
    })
  }

  // Change lead status directly
  if (data.startsWith('crm:set_status:')) {
    const [, , leadId, newStatus] = data.split(':')
    const updated = updateLeadStatus(leadId, newStatus)
    const alertMsg = newStatus === 'in_progress' ? '🟡 Взят в работу!' : newStatus === 'done' ? '🟢 Проект сдан!' : '⚪ Перенесён в архив'
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: alertMsg })
    if (updated) {
      if (updated.clientId && newStatus === 'in_progress') {
        await notifyClient(
          updated.clientId,
          `🚀 <b>Ваш проект взят в работу!</b>\n\nПривет, <b>${updated.name}</b>! Мы официально запустили разработку вашей задачи («${updated.type}»).\n\n⏰ Ориентир по срокам: <b>${updated.deadline || '5–8 дней'}</b>\n💬 Если у вас есть материалы или пожелания — присылайте прямо сюда!`
        )
      } else if (updated.clientId && newStatus === 'done') {
        await notifyClient(
          updated.clientId,
          `🎉 <b>Ваш проект успешно завершён и сдан!</b>\n\nВсе работы по «${updated.type}» выполнены. В проект включены 3 круга бесплатных правок.\n\nСпасибо за выбор mercury! Будем рады дальнейшему сотрудничеству.`
        )
      }
      const { text, reply_markup } = renderLeadCard(updated)
      return tg('editMessageText', {
        chat_id: chatId,
        message_id: msgId,
        text,
        parse_mode: 'HTML',
        reply_markup,
      })
    }
  }

  // Payment status
  if (data.startsWith('crm:set_pay:')) {
    const [, , leadId, payStatus] = data.split(':')
    const updated = setLeadPayment(leadId, payStatus)
    const alertMsg = payStatus === 'advance_50'
      ? '💳 Аванс 50% зафиксирован в CRM!'
      : payStatus === 'paid_full'
      ? '💰 Оплата 100% зафиксирована!'
      : '⏳ Статус оплаты сброшен'
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: alertMsg })
    if (updated) {
      const { text, reply_markup } = renderLeadCard(updated)
      return tg('editMessageText', {
        chat_id: chatId,
        message_id: msgId,
        text,
        parse_mode: 'HTML',
        reply_markup,
      })
    }
  }

  // Commercial Proposal (КП)
  if (data.startsWith('crm:make_kp:')) {
    const leadId = data.split(':')[2]
    const lead = getLead(leadId)
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    if (!lead) return
    const { text, reply_markup } = renderCommercialProposal(lead)
    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup,
    })
  }

  if (data.startsWith('crm:send_kp:')) {
    const leadId = data.split(':')[2]
    const lead = getLead(leadId)
    if (!lead || !lead.clientId) {
      return tg('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: 'У лида нет привязанного Telegram-аккаунта клиента',
        show_alert: true,
      })
    }
    const { proposalText } = renderCommercialProposal(lead)
    await notifyClient(
      lead.clientId,
      `🤝 <b>Коммерческое предложение по вашей заявке:</b>\n\n${proposalText}\n\n💬 Если у вас есть вопросы или пожелания — напишите прямо в ответ или Даде (@Xitinchik)!`
    )
    return tg('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: '✅ КП успешно отправлено клиенту прямо в бот!',
      show_alert: true,
    })
  }

  // Daily digest
  if (data === 'crm:digest' || data === 'crm:today') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    const { text, reply_markup } = renderDailyDigest()
    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup,
    })
  }

  // Delete lead
  if (data.startsWith('crm:delete:')) {
    const leadId = data.split(':')[2]
    deleteLead(leadId)
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Проект удалён' })
    const { text, reply_markup } = renderAdminDashboard()
    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup,
    })
  }

  // Direct quick action buttons on incoming notification messages
  if (data.startsWith('crm:work:')) {
    const leadId = data.split(':')[2]
    let lead = getLead(leadId)
    if (lead) {
      lead = updateLeadStatus(leadId, 'in_progress')
      if (lead.clientId) {
        await notifyClient(
          lead.clientId,
          `🚀 <b>Ваш проект взят в работу!</b>\n\nПривет, <b>${lead.name}</b>! Мы официально запустили разработку вашей задачи («${lead.type}»).\n\n⏰ Ориентир по срокам: <b>${lead.deadline || '5–8 дней'}</b>\n💬 Если у вас есть материалы или пожелания — присылайте прямо сюда!`
        )
      }
    }
    await tg('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: '🟡 Проект перенесён в «В работе»! Список: /crm',
      show_alert: true,
    })

    const rawText = (cb.message?.text || '').replace(/^(?:🟡 \[В РАБОТЕ.*?\]|🟢 \[СДАН.*?\]|⚪ \[В АРХИВЕ.*?\])\n\n?/i, '').trim()
    const header = `🟡 <b>[В РАБОТЕ • ${formatDate(new Date().toISOString())}]</b>\n\n`
    const oldRows = cb.message?.reply_markup?.inline_keyboard || []
    const replyBtnRow = oldRows.find((r) => r.some((b) => b.url && b.url.includes('t.me/')))

    const newButtons = [
      ...(replyBtnRow ? [replyBtnRow] : []),
      [
        { text: '🟢 Сдан', callback_data: `crm:done:${leadId}` },
        { text: '⚪ В архив', callback_data: `crm:archive:${leadId}` },
      ],
      [
        { text: '📂 Карточка в CRM', callback_data: `crm:view:${leadId}` },
        { text: '📋 В работе', callback_data: 'crm:list:in_progress' },
      ],
    ]

    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text: header + rawText.split('\n').map((l) => (l.startsWith('Новая заявка') ? `🔥 <b>${l}</b>` : l)).join('\n'),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: newButtons },
    })
  }

  if (data.startsWith('crm:done:')) {
    const leadId = data.split(':')[2]
    let lead = getLead(leadId)
    if (lead) {
      lead = updateLeadStatus(leadId, 'done')
      if (lead.clientId) {
        await notifyClient(
          lead.clientId,
          `🎉 <b>Ваш проект успешно завершён и сдан!</b>\n\nВсе работы по задаче «${lead.type}» выполнены. В проект включены 3 круга бесплатных правок.\n\nСпасибо за выбор mercury! Будем рады дальнейшему сотрудничеству.`
        )
      }
    }
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '🟢 Проект сдан! Посмотреть: /crm' })

    const rawText = (cb.message?.text || '').replace(/^(?:🟡 \[В РАБОТЕ.*?\]|🟢 \[СДАН.*?\]|⚪ \[В АРХИВЕ.*?\])\n\n?/i, '').trim()
    const header = `🟢 <b>[СДАН / ЗАВЕРШЁН • ${formatDate(new Date().toISOString())}]</b>\n\n`
    const oldRows = cb.message?.reply_markup?.inline_keyboard || []
    const replyBtnRow = oldRows.find((r) => r.some((b) => b.url && b.url.includes('t.me/')))

    const newButtons = [
      ...(replyBtnRow ? [replyBtnRow] : []),
      [
        { text: '🟡 Вернуть в работу', callback_data: `crm:work:${leadId}` },
        { text: '⚪ В архив', callback_data: `crm:archive:${leadId}` },
      ],
      [
        { text: '📂 Карточка в CRM', callback_data: `crm:view:${leadId}` },
        { text: '🟢 Сданные', callback_data: 'crm:list:done' },
      ],
    ]

    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text: header + rawText.split('\n').map((l) => (l.startsWith('Новая заявка') ? `🔥 <b>${l}</b>` : l)).join('\n'),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: newButtons },
    })
  }

  if (data.startsWith('crm:archive:')) {
    const leadId = data.split(':')[2]
    let lead = getLead(leadId)
    if (lead) updateLeadStatus(leadId, 'archived')
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: '⚪ Перенесено в архив' })

    const rawText = (cb.message?.text || '').replace(/^(?:🟡 \[В РАБОТЕ.*?\]|🟢 \[СДАН.*?\]|⚪ \[В АРХИВЕ.*?\])\n\n?/i, '').trim()
    const header = `⚪ <b>[В АРХИВЕ • ${formatDate(new Date().toISOString())}]</b>\n\n`
    const oldRows = cb.message?.reply_markup?.inline_keyboard || []
    const replyBtnRow = oldRows.find((r) => r.some((b) => b.url && b.url.includes('t.me/')))

    const newButtons = [
      ...(replyBtnRow ? [replyBtnRow] : []),
      [
        { text: '🟡 В работу', callback_data: `crm:work:${leadId}` },
        { text: '📂 Открыть в CRM', callback_data: `crm:view:${leadId}` },
      ],
    ]

    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text: header + rawText.split('\n').map((l) => (l.startsWith('Новая заявка') ? `🔥 <b>${l}</b>` : l)).join('\n'),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: newButtons },
    })
  }

  if (data.startsWith('crm:copy:')) {
    const leadId = data.split(':')[2]
    const lead = getLead(leadId)
    const textToCopy = lead
      ? `Клиент: ${lead.name}\nКонтакт: ${lead.contact}\nТип: ${lead.type}\nЗадача: ${lead.task}\nБюджет: ${lead.budget}\nСроки: ${lead.deadline}`
      : stripHtml(cb.message?.text || '')

    return tg('answerCallbackQuery', {
      callback_query_id: cb.id,
      text: `📋 Текст брифа:\n\n${textToCopy.slice(0, 180)}`,
      show_alert: true,
    })
  }

  // Admin test lead
  if (data === 'admin:test_lead') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Создаю тестовый лид...' })
    const testLead = addLead({
      name: 'Константин (Тест)',
      contact: '@Xitinchik',
      type: '3D-сайт',
      task: 'Разработка промо-страницы с Three.js и интеграцией Telegram CRM',
      budget: '85 000 ₽',
      deadline: '10 дней',
      page: 'http://127.0.0.1:5173/',
    })

    const testText = [
      '🔥 <b>Новая заявка с сайта</b>',
      '',
      `👤 <b>${testLead.name}</b>`,
      `📬 ${testLead.contact}`,
      `🧩 ${testLead.type}`,
      `📝 ${testLead.task}`,
      `💰 ${testLead.budget}`,
      `⏰ ${testLead.deadline}`,
      '',
      `<i>ID в CRM: ${testLead.id}</i>`,
    ].join('\n')

    return tg('sendMessage', {
      chat_id: ADMIN_ID || chatId,
      text: testText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✍️ Ответить клиенту', url: 'https://t.me/Xitinchik' }],
          [
            { text: '🟡 В работу', callback_data: `crm:work:${testLead.id}` },
            { text: '🟢 Сдан', callback_data: `crm:done:${testLead.id}` },
            { text: '⚪ В архив', callback_data: `crm:archive:${testLead.id}` },
          ],
          [
            { text: '📂 Карточка в CRM', callback_data: `crm:view:${testLead.id}` },
            { text: '📋 Копировать бриф', callback_data: `crm:copy:${testLead.id}` },
          ],
        ],
      },
    })
  }

  // Client menu actions
  if (data === 'client:cases' || data === 'cases:list') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    const text = [
      '📂 <b>Избранные проекты mercury</b>',
      '',
      'Выбери кейс, чтобы изучить подробности, стек и результат:',
    ].join('\n')

    const buttons = Object.entries(CASES).map(([key, item]) => [
      { text: `${item.title} (${item.tag})`, callback_data: `case:${key}` },
    ])
    buttons.push([{ text: '🔙 В главное меню', callback_data: 'client:menu' }])

    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    })
  }

  if (data.startsWith('case:')) {
    const key = data.split(':')[1]
    const item = CASES[key]
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    if (!item) return

    const text = [
      `🏆 <b>${item.title}</b>`,
      `<i>${item.tag}</i>`,
      '',
      `📝 <b>Описание:</b>\n${item.desc}`,
      '',
      `📊 <b>Результаты:</b>\n${item.metrics}`,
      '',
      `🛠 <b>Технологии:</b>\n<code>${item.stack}</code>`,
    ].join('\n')

    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚡ Хочу такой же проект', callback_data: `brief:prefill:${key}` }],
          [{ text: '📂 Другие кейсы', callback_data: 'cases:list' }, { text: '🔙 Меню', callback_data: 'client:menu' }],
        ],
      },
    })
  }

  if (data === 'calc:start') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    const text = [
      '💰 <b>Калькулятор стоимости проекта</b>',
      '',
      'Шаг 1 из 2: <b>Какой тип проекта вас интересует?</b>',
    ].join('\n')

    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Сайт / Лендинг с 3D', callback_data: 'calc:type:site' }],
          [{ text: '🤖 Telegram-бот', callback_data: 'calc:type:bot' }],
          [{ text: '⚡ Автоматизация (n8n + AI)', callback_data: 'calc:type:auto' }],
          [{ text: '🔙 Главное меню', callback_data: 'client:menu' }],
        ],
      },
    })
  }

  if (data.startsWith('calc:type:')) {
    const type = data.split(':')[2]
    await tg('answerCallbackQuery', { callback_query_id: cb.id })

    if (type === 'site') {
      return tg('editMessageText', {
        chat_id: chatId,
        message_id: msgId,
        text: 'Шаг 2 из 2: <b>Какая сложность и формат сайта?</b>',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Промо-лендинг с анимацией (от 40 000 ₽)', callback_data: 'calc:res:site_landing' }],
            [{ text: 'Премиум-сайт с каталогом / сервисом (от 70 000 ₽)', callback_data: 'calc:res:site_corp' }],
            [{ text: '3D/WebGL интерактив (Three.js) (от 100 000 ₽)', callback_data: 'calc:res:site_3d' }],
            [{ text: '🔙 Назад', callback_data: 'calc:start' }],
          ],
        },
      })
    } else if (type === 'bot') {
      return tg('editMessageText', {
        chat_id: chatId,
        message_id: msgId,
        text: 'Шаг 2 из 2: <b>Какие функции нужны в Telegram-боте?</b>',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Бот-визитка / приём заявок (от 25 000 ₽)', callback_data: 'calc:res:bot_leads' }],
            [{ text: 'Онлайн-запись + оплата + каталог (от 45 000 ₽)', callback_data: 'calc:res:bot_shop' }],
            [{ text: 'AI-ассистент / ChatGPT интеграция (от 60 000 ₽)', callback_data: 'calc:res:bot_ai' }],
            [{ text: '🔙 Назад', callback_data: 'calc:start' }],
          ],
        },
      })
    } else {
      return tg('editMessageText', {
        chat_id: chatId,
        message_id: msgId,
        text: 'Шаг 2 из 2: <b>Что требуется автоматизировать?</b>',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Сбор заявок с сайта в CRM и Telegram (от 15 000 ₽)', callback_data: 'calc:res:auto_leads' }],
            [{ text: 'Связка нескольких баз данных и таблиц (от 30 000 ₽)', callback_data: 'calc:res:auto_sync' }],
            [{ text: 'AI-агенты для обработки документов (от 50 000 ₽)', callback_data: 'calc:res:auto_ai' }],
            [{ text: '🔙 Назад', callback_data: 'calc:start' }],
          ],
        },
      })
    }
  }

  if (data.startsWith('calc:res:')) {
    const key = data.split(':')[2]
    await tg('answerCallbackQuery', { callback_query_id: cb.id })

    const PRICING_MAP = {
      site_landing: { name: 'Промо-лендинг с анимацией', price: 'от 40 000 ₽', time: '5–8 дней' },
      site_corp: { name: 'Премиум-сайт с сервисом', price: 'от 70 000 ₽', time: '7–12 дней' },
      site_3d: { name: '3D/WebGL интерактив', price: 'от 100 000 ₽', time: '10–16 дней' },
      bot_leads: { name: 'Бот приёма заявок', price: 'от 25 000 ₽', time: '3–5 дней' },
      bot_shop: { name: 'Бот с записью и оплатой', price: 'от 45 000 ₽', time: '4–7 дней' },
      bot_ai: { name: 'AI-ассистент Telegram', price: 'от 60 000 ₽', time: '6–10 дней' },
      auto_leads: { name: 'Сбор заявок в CRM + TG', price: 'от 15 000 ₽', time: '2–4 дня' },
      auto_sync: { name: 'Синхронизация сервисов на n8n', price: 'от 30 000 ₽', time: '3–6 дней' },
      auto_ai: { name: 'AI-агенты автоматизации', price: 'от 50 000 ₽', time: '5–9 дней' },
    }

    const res = PRICING_MAP[key] || { name: 'Индивидуальный проект', price: 'по договорённости', time: 'от 5 дней' }

    const text = [
      '📊 <b>Предварительный расчёт проекта:</b>',
      '',
      `🎯 <b>Направление:</b> ${res.name}`,
      `💰 <b>Ориентир бюджета:</b> <b>${res.price}</b>`,
      `⏱ <b>Сроки реализации:</b> ${res.time}`,
      '',
      '✅ <i>Включает: адаптив, чистую архитектуру, 3 круга правок бесплатно (дальше — за доплату).</i>',
      '',
      'Готовы зафиксировать задачу и запустить проект?',
    ].join('\n')

    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Оставить заявку по этому расчёту', callback_data: `brief:prefill:${key}` }],
          [{ text: '💬 Обсудить лично с Дадой', url: 'https://t.me/Xitinchik' }],
          [{ text: '🔄 Пересчитать', callback_data: 'calc:start' }, { text: '🔙 Меню', callback_data: 'client:menu' }],
        ],
      },
    })
  }

  if (data === 'brief:start' || data.startsWith('brief:prefill:')) {
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    const ref = data.startsWith('brief:prefill:') ? data.replace('brief:prefill:', '') : null

    clientSessions.set(chatId, {
      step: 'name',
      data: {
        ref: ref || 'Прямая заявка из бота',
        userId: cb.from?.id,
        username: cb.from?.username ? `@${cb.from.username}` : '',
        firstName: cb.from?.first_name || '',
      },
    })

    const text = [
      '📝 <b>Бриф на разработку проекта</b>',
      '',
      'Шаг 1 из 3: <b>Как вас зовут?</b>',
      '<i>(Напишите ваше имя ответным сообщением в чат)</i>',
    ].join('\n')

    return tg('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Отмена', callback_data: 'client:menu' }]],
      },
    })
  }

  if (data === 'client:menu') {
    await tg('answerCallbackQuery', { callback_query_id: cb.id })
    clientSessions.delete(chatId)
    return handleStart(chatId, cb.from)
  }
}

// -------------------------------------------------------------
// Text messages (Brief Steps, Deal Creator, Note Adding)
// -------------------------------------------------------------

async function handleTextMessage(msg) {
  const chatId = msg.chat?.id
  const text = (msg.text || '').trim()
  const isMe = ADMIN_ID && String(chatId) === ADMIN_ID

  if (text.startsWith('/start') || text.startsWith('/crm') || text.startsWith('/admin')) {
    clientSessions.delete(chatId)
    adminSessions.delete(chatId)
    return handleStart(chatId, msg.from)
  }

  // --- ADMIN SESSIONS ---
  if (isMe) {
    const adminSess = adminSessions.get(chatId)

    // Persistent Bottom Keyboard Commands
    if (text === '📊 CRM' || text === '📊 CRM Главная') {
      adminSessions.delete(chatId)
      const { text: dashText, reply_markup: dashMarkup } = renderAdminDashboard()
      return tg('sendMessage', { chat_id: chatId, text: dashText, parse_mode: 'HTML', reply_markup: dashMarkup })
    }
    if (text === '🟡 В работе') {
      adminSessions.delete(chatId)
      const { text: lText, reply_markup: lMarkup } = renderLeadList('in_progress')
      return tg('sendMessage', { chat_id: chatId, text: lText, parse_mode: 'HTML', reply_markup: lMarkup })
    }
    if (text === '📥 Новые') {
      adminSessions.delete(chatId)
      const { text: lText, reply_markup: lMarkup } = renderLeadList('new')
      return tg('sendMessage', { chat_id: chatId, text: lText, parse_mode: 'HTML', reply_markup: lMarkup })
    }
    if (text === '☀️ Мой день' || text === '/today' || text === '/digest') {
      adminSessions.delete(chatId)
      const { text: dText, reply_markup: dMarkup } = renderDailyDigest()
      return tg('sendMessage', { chat_id: chatId, text: dText, parse_mode: 'HTML', reply_markup: dMarkup })
    }
    if (text === '➕ Добавить сделку' || text === '➕ Новая сделка') {
      adminSessions.set(chatId, { type: 'create_deal', step: 'name', data: {} })
      return tg('sendMessage', {
        chat_id: chatId,
        text: '➕ <b>Создание новой сделки (1 из 5)</b>\n\nКак зовут клиента?',
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: 'Отмена', callback_data: 'crm:home' }]] },
      })
    }
    if (text === '💰 Финансы') {
      adminSessions.delete(chatId)
      const { text: finText, reply_markup: finMarkup } = renderFinancialDashboard()
      return tg('sendMessage', { chat_id: chatId, text: finText, parse_mode: 'HTML', reply_markup: finMarkup })
    }
    if (text === '🔍 Поиск' || text.startsWith('/find')) {
      const query = text.startsWith('/find') ? text.slice(5).trim() : ''
      if (query) {
        adminSessions.delete(chatId)
        const { text: sText, reply_markup: sMarkup } = renderSearchResults(query)
        return tg('sendMessage', { chat_id: chatId, text: sText, parse_mode: 'HTML', reply_markup: sMarkup })
      }
      adminSessions.set(chatId, { type: 'search' })
      return tg('sendMessage', {
        chat_id: chatId,
        text: '🔍 <b>Поиск по базе сделок:</b>\n\nВведи имя клиента, контакт (@username, телефон) или слово из задачи:',
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: 'Отмена', callback_data: 'crm:home' }]] },
      })
    }

    // A) Quick Editing Field (budget, deadline, contact)
    if (adminSess && adminSess.type === 'edit_field') {
      const { leadId, field } = adminSess
      adminSessions.delete(chatId)
      const updated = updateLeadField(leadId, field, text)
      const fieldNames = { budget: 'Бюджет', deadline: 'Сроки', contact: 'Контакт' }
      const fName = fieldNames[field] || field

      await tg('sendMessage', {
        chat_id: chatId,
        text: `✅ <b>${fName} успешно обновлён!</b>`,
        parse_mode: 'HTML',
      })
      if (updated) {
        const { text: cardText, reply_markup } = renderLeadCard(updated)
        return tg('sendMessage', {
          chat_id: chatId,
          text: cardText,
          parse_mode: 'HTML',
          reply_markup,
        })
      }
      return
    }

    // B) Search Session
    if (adminSess && adminSess.type === 'search') {
      adminSessions.delete(chatId)
      const { text: sText, reply_markup: sMarkup } = renderSearchResults(text)
      return tg('sendMessage', {
        chat_id: chatId,
        text: sText,
        parse_mode: 'HTML',
        reply_markup: sMarkup,
      })
    }

    // C) Adding Note
    if (adminSess && adminSess.type === 'add_note') {
      const { leadId } = adminSess
      adminSessions.delete(chatId)
      addLeadNote(leadId, text)
      await tg('sendMessage', {
        chat_id: chatId,
        text: '✅ <b>Заметка сохранена!</b>',
        parse_mode: 'HTML',
      })
      const lead = getLead(leadId)
      if (lead) {
        const { text: cardText, reply_markup } = renderLeadCard(lead)
        return tg('sendMessage', {
          chat_id: chatId,
          text: cardText,
          parse_mode: 'HTML',
          reply_markup,
        })
      }
      return
    }

    // B) Creating Deal Wizard
    if (adminSess && adminSess.type === 'create_deal') {
      if (adminSess.step === 'name') {
        adminSess.data.name = text
        adminSess.step = 'contact'
        return tg('sendMessage', {
          chat_id: chatId,
          text: `Клиент: <b>${text}</b>\n\n➕ <b>Шаг 2 из 5: Контакт клиента</b>\n<i>(Telegram @username, ссылка или номер телефона)</i>:`,
          parse_mode: 'HTML',
        })
      }

      if (adminSess.step === 'contact') {
        adminSess.data.contact = text
        adminSess.step = 'type'
        return tg('sendMessage', {
          chat_id: chatId,
          text: '➕ <b>Шаг 3 из 5: Направление проекта</b>\n<i>(Например: «3D-сайт», «Telegram-бот», «Автоматизация n8n»)</i>:',
          parse_mode: 'HTML',
        })
      }

      if (adminSess.step === 'type') {
        adminSess.data.type = text
        adminSess.step = 'task'
        return tg('sendMessage', {
          chat_id: chatId,
          text: '➕ <b>Шаг 4 из 5: Суть задачи</b>\n<i>(Кратко, что делаем)</i>:',
          parse_mode: 'HTML',
        })
      }

      if (adminSess.step === 'task') {
        adminSess.data.task = text
        adminSess.step = 'budget'
        return tg('sendMessage', {
          chat_id: chatId,
          text: '➕ <b>Шаг 5 из 5: Сумма сделки / бюджет</b>\n<i>(Например: «75 000 ₽»)</i>:',
          parse_mode: 'HTML',
        })
      }

      if (adminSess.step === 'budget') {
        adminSess.data.budget = text
        const d = adminSess.data
        adminSessions.delete(chatId)

        const createdLead = addLead({
          name: d.name,
          contact: d.contact,
          type: d.type,
          task: d.task,
          budget: d.budget,
          deadline: 'По графику',
          page: 'Создан вручную в CRM',
          status: 'in_progress',
        })

        await tg('sendMessage', {
          chat_id: chatId,
          text: `🎉 <b>Сделка успешно создана и добавлена в «🟡 В работе»!</b>`,
          parse_mode: 'HTML',
        })

        const { text: cardText, reply_markup } = renderLeadCard(createdLead)
        return tg('sendMessage', {
          chat_id: chatId,
          text: cardText,
          parse_mode: 'HTML',
          reply_markup,
        })
      }
    }

    // Default admin fallback
    return tg('sendMessage', {
      chat_id: chatId,
      text: 'Используйте меню или команду /crm для управления сделками.',
      reply_markup: {
        inline_keyboard: [[{ text: '👑 Открыть CRM', callback_data: 'crm:home' }]],
      },
    })
  }

  // --- CLIENT SESSIONS ---
  const session = clientSessions.get(chatId)
  if (!session) {
    return tg('sendMessage', {
      chat_id: chatId,
      text: 'Я на связи! Нажмите /start или выберите действие в меню:',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📂 Открыть меню', callback_data: 'client:menu' }],
          [{ text: '💬 Написать Даде напрямую', url: 'https://t.me/Xitinchik' }],
        ],
      },
    })
  }

  // Brief multi-step wizard
  if (session.step === 'name') {
    session.data.name = text
    session.step = 'contact'

    return tg('sendMessage', {
      chat_id: chatId,
      text: `Приятно познакомиться, <b>${text}</b>!\n\nШаг 2 из 3: <b>Как с вами связаться?</b>\n<i>(Telegram username, номер телефона или email)</i>`,
      parse_mode: 'HTML',
    })
  }

  if (session.step === 'contact') {
    session.data.contact = text
    session.step = 'task'

    return tg('sendMessage', {
      chat_id: chatId,
      text: 'Шаг 3 из 3: <b>Кратко опишите задачу</b>\n<i>(Что нужно разработать, какие функции или пожелания)</i>',
      parse_mode: 'HTML',
    })
  }

  if (session.step === 'task') {
    session.data.task = text
    const leadData = session.data
    clientSessions.delete(chatId)

    // Save lead to CRM
    const saved = addLead({
      name: leadData.name,
      contact: leadData.contact,
      clientId: leadData.userId || chatId,
      type: leadData.ref || 'Заявка из бота',
      task: leadData.task,
      budget: 'Уточняется',
      deadline: 'Уточняется',
      page: 'Telegram Bot @mercury_lead_bot',
      status: 'new',
    })

    // Send confirmation to client
    await tg('sendMessage', {
      chat_id: chatId,
      text: `🎉 <b>Отлично, ${leadData.name}!</b>\n\nЗаявка уже передана Даде (@Xitinchik). Он свяжется с вами в ближайшее время!\n\nА пока вы можете изучить другие кейсы в меню 👇`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📂 Смотреть кейсы', callback_data: 'client:cases' }],
          [{ text: '💬 Написать лично', url: 'https://t.me/Xitinchik' }],
        ],
      },
    })

    // Forward lead to Admin with CRM buttons!
    const adminText = [
      '🔥 <b>Новая заявка из Telegram-бота!</b>',
      '',
      `👤 <b>${saved.name}</b>`,
      `📬 ${saved.contact} ${leadData.username || ''}`,
      `🧩 ${saved.type}`,
      `📝 ${saved.task}`,
      '',
      `<i>ID в CRM: ${saved.id}</i>`,
    ].join('\n')

    const contactHandle = leadData.username
      ? leadData.username.replace('@', '')
      : saved.contact.startsWith('@')
      ? saved.contact.slice(1)
      : null

    const buttons = []
    if (contactHandle) {
      buttons.push([{ text: '✍️ Ответить клиенту', url: `https://t.me/${contactHandle}` }])
    }
    buttons.push([
      { text: '🟡 В работу', callback_data: `crm:work:${saved.id}` },
      { text: '🟢 Сдан', callback_data: `crm:done:${saved.id}` },
      { text: '⚪ В архив', callback_data: `crm:archive:${saved.id}` },
    ])
    buttons.push([
      { text: '📂 Карточка в CRM', callback_data: `crm:view:${saved.id}` },
      { text: '📋 Копировать бриф', callback_data: `crm:copy:${saved.id}` },
    ])

    return tg('sendMessage', {
      chat_id: ADMIN_ID || chatId,
      text: adminText,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    })
  }
}

// -------------------------------------------------------------
// Long-Polling Engine
// -------------------------------------------------------------

let isRunning = false

export async function startBot() {
  if (isRunning) return
  isRunning = true

  console.log('[Bot] 🚀 Запуск Telegram Bot & Pro CRM Engine...')

  // RESET Menu Button to default (removes persistent "Портфолио" Web App button)
  try {
    await tg('setChatMenuButton', {
      menu_button: { type: 'default' },
    })
  } catch (e) {
    console.warn('[Bot] setChatMenuButton warning:', e.message)
  }

  let offset = 0

  while (isRunning) {
    try {
      const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=25`)
      const data = await res.json()

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1
          try {
            if (update.message) {
              await handleTextMessage(update.message)
            } else if (update.callback_query) {
              await handleCallback(update.callback_query)
            }
          } catch (handlerErr) {
            console.warn('[Bot] Update handler warning:', handlerErr?.message || handlerErr)
          }
        }
      } else if (!data.ok) {
        if (data.error_code === 409) {
          console.warn('[Bot] ⚠️ Конфликт getUpdates: другой экземпляр бота уже запущен. Пауза 5 сек...')
          await new Promise((r) => setTimeout(r, 5000))
        } else {
          console.warn('[Bot] getUpdates error:', data.description)
          await new Promise((r) => setTimeout(r, 2000))
        }
      }
    } catch (loopErr) {
      // Network hiccup or fetch abort, wait and retry
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
}

// If executed directly: node scripts/bot.mjs
if (process.argv[1] && process.argv[1].endsWith('bot.mjs')) {
  startBot()
}
