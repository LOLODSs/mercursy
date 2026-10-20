/**
 * Mercury Telegram Lead Gateway & Cloudflare CRM Worker
 *
 * 1. Принимает заявки с сайта и моментально шлёт в Telegram обоим админам.
 * 2. Полноценная CRM прямо в Telegram:
 *    • 📊 CRM — статистика по проектам и общая касса
 *    • 🟡 В работе — список проектов в разработке
 *    • 📩 Новые — свежие заявки с сайта
 *    • ➕ Добавить сделку — ручное создание проекта в 1 сообщение
 *    • 💰 Финансы — отчёт по доходам, пайплайну и среднему чеку
 *    • 🔍 Поиск — быстрый поиск клиента по имени, @юзернейму или телефону
 * 3. Авто-распознавание сделок: нажатие «🟡 В работу» под ЛЮБЫМ сообщением
 *    (даже старым!) автоматически вносит проект в базу CRM.
 * 4. Хранение в Cloudflare KV (если привязан CRM) + локальный кеш.
 */

const DEFAULT_BOT_TOKEN = '8943025919:AAF8v9ZAxctpJeTu-AAOsg4glTLmNAcBMc4'
const DEFAULT_CHAT_IDS = '1031568361, 1264265361'

const ADMIN_KEYBOARD = {
  keyboard: [
    [{ text: '📊 CRM' }, { text: '🟡 В работе' }, { text: '📩 Новые' }],
    [{ text: '➕ Добавить сделку' }, { text: '💰 Финансы' }, { text: '🔍 Поиск' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
}

// Утилиты форматирования
const esc = (s = '') => String(s ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))
const stripHtml = (s = '') => String(s || '').replace(/<[^>]*>/g, '').trim()

function parseAmount(str) {
  if (!str) return 0
  const clean = String(str).replace(/[^\d]/g, '')
  const val = parseInt(clean, 10)
  return isNaN(val) ? 0 : val
}

function formatRubles(num) {
  if (!num || isNaN(num)) return '0 ₽'
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'
}

function formatDate(isoStr) {
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    })
  } catch {
    return 'Сегодня'
  }
}

function statusBadge(status) {
  switch (status) {
    case 'in_progress': return '🟡 В работе'
    case 'done': return '🟢 Сдан'
    case 'archived': return '⚪ В архиве'
    case 'new': default: return '📩 Новый'
  }
}

// Автоматический парсинг сделки из текста Telegram-сообщения
function parseLeadFromMessage(rawText, messageId) {
  if (!rawText) return null
  const clean = stripHtml(rawText)
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean)

  let name = ''
  let contact = ''
  let type = ''
  let task = ''
  let budget = ''
  let deadline = ''

  for (const line of lines) {
    if (line.includes('👤')) {
      name = line.replace(/.*👤\s*(?:Клиент:\s*)?/, '').trim()
    } else if (line.includes('📬')) {
      contact = line.replace(/.*📬\s*(?:Контакт:\s*)?/, '').trim()
    } else if (line.includes('🧩')) {
      type = line.replace(/.*🧩\s*(?:Тип проекта:\s*)?/, '').trim()
    } else if (line.includes('📝')) {
      task = line.replace(/.*📝\s*(?:Задача:\s*)?/, '').trim()
    } else if (line.includes('💰')) {
      budget = line.replace(/.*💰\s*(?:Бюджет:\s*)?/, '').trim()
    } else if (line.includes('⏰')) {
      deadline = line.replace(/.*⏰\s*(?:Сроки:\s*)?/, '').trim()
    }
  }

  if (!name) name = 'Клиент'
  if (!contact) {
    const tgMatch = clean.match(/@([a-zA-Z0-9_]{4,})/)
    if (tgMatch) contact = '@' + tgMatch[1]
    else {
      const ph = clean.match(/(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/)
      contact = ph ? ph[0] : 'Контакт в сообщении'
    }
  }
  if (!type) type = 'Индивидуальный проект'
  if (!task) task = 'Заявка из чата'
  if (!budget) budget = 'По договорённости'
  if (!deadline) deadline = 'По графику'

  const seed = `${contact}_${name}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const id = 'm_' + Math.abs(hash).toString(36)

  return {
    id,
    name,
    contact,
    type,
    task,
    budget,
    deadline,
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    createdBy: 'Telegram Action',
  }
}

// Работа с хранилищем (Cloudflare KV + graceful in-memory fallback)
async function getLeads(env) {
  if (env && env.CRM && typeof env.CRM.get === 'function') {
    try {
      const data = await env.CRM.get('mercury_leads', { type: 'json' })
      if (Array.isArray(data)) return data
    } catch (e) {
      console.warn('KV get error:', e)
    }
  }
  return globalThis.__LOCAL_LEADS__ || []
}

async function saveLeads(env, leads) {
  globalThis.__LOCAL_LEADS__ = leads.slice(0, 150)
  if (env && env.CRM && typeof env.CRM.put === 'function') {
    try {
      await env.CRM.put('mercury_leads', JSON.stringify(leads.slice(0, 200)))
    } catch (e) {
      console.warn('KV put error:', e)
    }
  }
}

async function getAdminState(env, chatId) {
  if (env && env.CRM && typeof env.CRM.get === 'function') {
    try {
      const s = await env.CRM.get(`state:${chatId}`, { type: 'json' })
      if (s) return s
    } catch {}
  }
  globalThis.__ADMIN_STATES__ = globalThis.__ADMIN_STATES__ || {}
  return globalThis.__ADMIN_STATES__[chatId] || null
}

async function setAdminState(env, chatId, state) {
  globalThis.__ADMIN_STATES__ = globalThis.__ADMIN_STATES__ || {}
  if (state === null) {
    delete globalThis.__ADMIN_STATES__[chatId]
    if (env && env.CRM && typeof env.CRM.delete === 'function') {
      try { await env.CRM.delete(`state:${chatId}`) } catch {}
    }
    return
  }
  globalThis.__ADMIN_STATES__[chatId] = state
  if (env && env.CRM && typeof env.CRM.put === 'function') {
    try {
      await env.CRM.put(`state:${chatId}`, JSON.stringify(state), { expirationTtl: 900 })
    } catch {}
  }
}

// Рендереры интерфейса
function renderAdminDashboard(leads, hasKV) {
  const total = leads.length
  const newLeads = leads.filter((l) => l.status === 'new' || !l.status)
  const inWork = leads.filter((l) => l.status === 'in_progress')
  const done = leads.filter((l) => l.status === 'done')
  const archived = leads.filter((l) => l.status === 'archived')

  const inWorkSum = inWork.reduce((acc, l) => acc + parseAmount(l.budget), 0)
  const doneSum = done.reduce((acc, l) => acc + parseAmount(l.budget), 0)

  const text = [
    '📊 <b>Панель управления Mercury CRM</b>',
    hasKV ? '<i>💾 Облачная база KV: подключена</i>' : '<i>⚠️ База KV не подключена (данные во временной памяти)</i>',
    '',
    `• 📩 Новые заявки: <b>${newLeads.length}</b>`,
    `• 🟡 В разработке: <b>${inWork.length}</b> (${formatRubles(inWorkSum)})`,
    `• 🟢 Сдано проектов: <b>${done.length}</b> (${formatRubles(doneSum)})`,
    `• ⚪ В архиве: <b>${archived.length}</b>`,
    `• 📁 Всего в базе: <b>${total}</b>`,
    '',
    `💰 <b>Общая сумма завершённых:</b> <b>${formatRubles(doneSum)}</b>`,
    '',
    'Выбери категорию или действие ниже:',
  ].join('\n')

  const reply_markup = {
    inline_keyboard: [
      [
        { text: `🟡 В работе (${inWork.length})`, callback_data: 'crm:list:in_progress' },
        { text: `📩 Новые (${newLeads.length})`, callback_data: 'crm:list:new' },
      ],
      [
        { text: `🟢 Сданные (${done.length})`, callback_data: 'crm:list:done' },
        { text: `⚪ Архив (${archived.length})`, callback_data: 'crm:list:archived' },
      ],
      [
        { text: '➕ Создать сделку', callback_data: 'crm:add' },
        { text: '💰 Финансы', callback_data: 'crm:finances' },
      ],
      [
        { text: '🔍 Поиск по базе', callback_data: 'crm:search' },
      ],
    ],
  }

  return { text, reply_markup }
}

function renderLeadList(leads, status) {
  const filtered = leads.filter((l) => (status === 'new' ? (l.status === 'new' || !l.status) : l.status === status))
  const title = statusBadge(status)

  if (!filtered.length) {
    const text = [
      `📂 <b>Категория: ${title}</b>`,
      '',
      'Здесь пока нет сделок.',
      status === 'in_progress'
        ? '💡 Чтобы перевести заявку в работу, нажми «🟡 В работу» под карточкой любой заявки в чате или нажми «➕ Создать сделку» ниже.'
        : '',
    ].filter(Boolean).join('\n')

    return {
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Создать сделку', callback_data: 'crm:add' }],
          [{ text: '🔙 В главное меню', callback_data: 'crm:home' }],
        ],
      },
    }
  }

  const lines = [
    `📂 <b>Категория: ${title} (${filtered.length})</b>`,
    '',
    'Нажми на проект ниже, чтобы открыть его карточку:',
    '',
  ]

  filtered.slice(0, 8).forEach((l, idx) => {
    lines.push(`<b>${idx + 1}. ${esc(l.name)}</b> (${esc(l.type || 'Проект')})`)
    lines.push(`• Бюджет: <b>${esc(l.budget || 'По договорённости')}</b> | ${formatDate(l.createdAt)}`)
    lines.push(`• Контакт: <code>${esc(l.contact)}</code>`)
    lines.push('')
  })

  const buttons = filtered.slice(0, 8).map((l, idx) => [
    { text: `${idx + 1}. ${l.name} — ${l.budget || 'По договорённости'}`, callback_data: `crm:view:${l.id}` },
  ])
  buttons.push([
    { text: '➕ Создать сделку', callback_data: 'crm:add' },
    { text: '🔙 В главное меню', callback_data: 'crm:home' },
  ])

  return { text, reply_markup: { inline_keyboard: buttons } }
}

function renderLeadCard(lead) {
  const c = lead.contact || ''
  let tg = null
  let wa = null

  const tgLink = c.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{4,})/i)
  if (tgLink) {
    tg = tgLink[1]
  } else {
    const tgAt = c.match(/(?:^|[^\w.@])@([a-zA-Z0-9_]{4,})\b/)
    if (tgAt) tg = tgAt[1]
    else if (/^[a-zA-Z0-9_]{5,}$/.test(c.trim()) && !/^\d+$/.test(c.trim())) tg = c.trim()
  }

  const digits = c.replace(/\D/g, '')
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    wa = '7' + digits.slice(1)
  } else if (digits.length >= 10 && digits.length <= 15) {
    wa = digits
  }

  const text = [
    `📁 <b>Карточка проекта: ${esc(lead.name)}</b>`,
    `Статус: <b>${statusBadge(lead.status)}</b>`,
    '',
    `👤 <b>Клиент:</b> ${esc(lead.name)}`,
    `📬 <b>Контакт:</b> <code>${esc(lead.contact)}</code>`,
    `🧩 <b>Тип проекта:</b> ${esc(lead.type || 'Не указан')}${lead.ref ? ` (как «${esc(lead.ref)}»)` : ''}`,
    `📝 <b>Задача:</b>\n${esc(lead.task)}`,
    '',
    `💰 <b>Бюджет:</b> <b>${esc(lead.budget || 'По договорённости')}</b>`,
    `⏰ <b>Сроки:</b> ${esc(lead.deadline || 'По графику')}`,
    `📅 <b>Создан:</b> ${formatDate(lead.createdAt)}`,
    lead.updatedBy ? `🔄 <b>Обновил:</b> ${esc(lead.updatedBy)} (${formatDate(lead.updatedAt)})` : '',
    '',
    '⚡ <b>Управление статусом:</b>',
  ].filter(Boolean).join('\n')

  const buttons = []
  const quickRow = []
  if (tg) quickRow.push({ text: `✍️ Написать @${tg}`, url: `https://t.me/${tg}` })
  if (wa) quickRow.push({ text: '💬 WhatsApp', url: `https://wa.me/${wa}` })
  if (quickRow.length) buttons.push(quickRow)

  const statusRow = []
  if (lead.status !== 'in_progress') {
    statusRow.push({ text: '🟡 В работу', callback_data: `crm:status:${lead.id}:in_progress` })
  }
  if (lead.status !== 'done') {
    statusRow.push({ text: '🟢 Сдан', callback_data: `crm:status:${lead.id}:done` })
  }
  if (lead.status !== 'archived') {
    statusRow.push({ text: '⚪ В архив', callback_data: `crm:status:${lead.id}:archived` })
  }
  if (statusRow.length) buttons.push(statusRow)

  buttons.push([
    { text: '📋 Копировать бриф', callback_data: `crm:copy:${lead.id}` },
    { text: '🔙 Назад в список', callback_data: `crm:list:${lead.status || 'in_progress'}` },
  ])

  return { text, reply_markup: { inline_keyboard: buttons } }
}

function renderFinancialDashboard(leads) {
  const inWork = leads.filter((l) => l.status === 'in_progress')
  const done = leads.filter((l) => l.status === 'done')

  const inWorkSum = inWork.reduce((acc, l) => acc + parseAmount(l.budget), 0)
  const doneSum = done.reduce((acc, l) => acc + parseAmount(l.budget), 0)
  const totalPipeline = inWorkSum + doneSum

  const avgCheck = done.length ? Math.round(doneSum / done.length) : (inWork.length ? Math.round(inWorkSum / inWork.length) : 0)

  const text = [
    '💰 <b>Финансовая аналитика Mercury CRM</b>',
    '',
    `🟢 <b>Фактически заработано (сдано):</b> <b>${formatRubles(doneSum)}</b> (${done.length} сделок)`,
    `🟡 <b>Пайплайн в работе (ожидается):</b> <b>${formatRubles(inWorkSum)}</b> (${inWork.length} проектов)`,
    `📊 <b>Общий объём воронки:</b> <b>${formatRubles(totalPipeline)}</b>`,
    `🎯 <b>Средний чек сделки:</b> <b>${formatRubles(avgCheck)}</b>`,
    '',
    done.length
      ? '<b>Последние закрытые сделки:</b>\n' + done.slice(0, 5).map((l) => `• ${esc(l.name)}: <b>${esc(l.budget)}</b>`).join('\n')
      : '<i>Пока нет завершённых сделок для отчёта.</i>',
  ].join('\n')

  const reply_markup = {
    inline_keyboard: [
      [
        { text: `🟡 В работе (${inWork.length})`, callback_data: 'crm:list:in_progress' },
        { text: `🟢 Сданные (${done.length})`, callback_data: 'crm:list:done' },
      ],
      [{ text: '🔙 В главное меню', callback_data: 'crm:home' }],
    ],
  }

  return { text, reply_markup }
}

function renderSearchResults(leads, query) {
  const q = String(query).toLowerCase().trim()
  const results = leads.filter((l) =>
    (l.name && l.name.toLowerCase().includes(q)) ||
    (l.contact && l.contact.toLowerCase().includes(q)) ||
    (l.task && l.task.toLowerCase().includes(q)) ||
    (l.type && l.type.toLowerCase().includes(q))
  )

  if (!results.length) {
    return {
      text: `🔍 <b>Поиск по запросу «${esc(query)}»:</b>\n\nНичего не найдено в базе CRM.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Создать сделку', callback_data: 'crm:add' }],
          [{ text: '🔙 В главное меню', callback_data: 'crm:home' }],
        ],
      },
    }
  }

  const lines = [
    `🔍 <b>Результаты поиска по «${esc(query)}» (${results.length}):</b>`,
    '',
  ]
  results.slice(0, 8).forEach((l, idx) => {
    lines.push(`<b>${idx + 1}. ${esc(l.name)}</b> (${statusBadge(l.status)})`)
    lines.push(`• Бюджет: <b>${esc(l.budget || 'По договорённости')}</b>`)
    lines.push(`• Контакт: <code>${esc(l.contact)}</code>`)
    lines.push('')
  })
  lines.push('Нажми ниже, чтобы открыть карточку:')

  const buttons = results.slice(0, 8).map((l, idx) => [
    { text: `${idx + 1}. ${l.name} (${l.budget || 'открыть'})`, callback_data: `crm:view:${l.id}` },
  ])
  buttons.push([{ text: '🔙 В главное меню', callback_data: 'crm:home' }])

  return { text, reply_markup: { inline_keyboard: buttons } }
}

function parseManualDeal(text) {
  const parts = text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return {
      name: parts[0],
      contact: parts[1],
      budget: parts.length >= 3 ? parts[2] : 'По договорённости',
      task: parts.length >= 4 ? parts.slice(3).join(', ') : 'Индивидуальный проект',
    }
  }
  return {
    name: 'Клиент',
    contact: text.slice(0, 80),
    budget: 'По договорённости',
    task: text,
  }
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors })
    }

    const botToken = env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN
    const rawChatIds = env.TELEGRAM_CHAT_ID || DEFAULT_CHAT_IDS
    const chatIds = String(rawChatIds)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    const url = new URL(request.url)

    // Маршрут привязки вебхука
    if (url.pathname === '/set-webhook') {
      const webhookUrl = url.origin
      const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`)
      const setJson = await setRes.json()
      return new Response(JSON.stringify({ ok: true, webhook: webhookUrl, telegram: setJson }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (request.method === 'GET') {
      const leads = await getLeads(env)
      const hasKV = Boolean(env && env.CRM)
      return new Response(JSON.stringify({ ok: true, service: 'mercury-gateway', crm: true, kvBound: hasKV, leadsCount: leads.length }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors })
    }

    try {
      const data = await request.json().catch(() => ({}))
      const hasKV = Boolean(env && env.CRM)

      // =============================================================
      // 1. ИНТЕРАКТИВНЫЕ ДЕЙСТВИЯ (Callback Queries)
      // =============================================================
      if (data.callback_query) {
        const cq = data.callback_query
        const cqData = cq.data || ''
        const fromUser = cq.from.username ? `@${cq.from.username}` : (cq.from.first_name || 'Сотрудник')
        const msg = cq.message
        const chatId = msg?.chat?.id

        let leads = await getLeads(env)

        // 1.1 Навигация по CRM
        if (cqData === 'crm:home') {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cq.id }),
          })
          const { text, reply_markup } = renderAdminDashboard(leads, hasKV)
          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: msg.message_id,
              text,
              parse_mode: 'HTML',
              reply_markup,
            }),
          })
          return new Response('OK', { headers: cors })
        }

        // 1.2 Списки лидов
        if (cqData.startsWith('crm:list:')) {
          const status = cqData.split(':')[2]
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cq.id }),
          })
          const { text, reply_markup } = renderLeadList(leads, status)
          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: msg.message_id,
              text,
              parse_mode: 'HTML',
              reply_markup,
            }),
          })
          return new Response('OK', { headers: cors })
        }

        // 1.3 Просмотр карточки лида
        if (cqData.startsWith('crm:view:')) {
          const leadId = cqData.split(':')[2]
          const lead = leads.find((l) => l.id === leadId)
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cq.id }),
          })
          if (!lead) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: '⚠️ Сделка не найдена в базе.',
                parse_mode: 'HTML',
              }),
            })
            return new Response('OK', { headers: cors })
          }

          const { text, reply_markup } = renderLeadCard(lead)
          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: msg.message_id,
              text,
              parse_mode: 'HTML',
              reply_markup,
            }),
          })
          return new Response('OK', { headers: cors })
        }

        // 1.4 Смена статуса из карточки проекта
        if (cqData.startsWith('crm:status:')) {
          const [, , leadId, newStatus] = cqData.split(':')
          let lead = leads.find((l) => l.id === leadId)

          // Если лид не найден (например, старое сообщение), пробуем распарсить
          if (!lead && msg && msg.text) {
            lead = parseLeadFromMessage(msg.text, msg.message_id)
            if (lead) {
              const existingIdx = leads.findIndex((l) => l.contact === lead.contact && l.name === lead.name)
              if (existingIdx >= 0) {
                leads[existingIdx].status = newStatus
                leads[existingIdx].updatedAt = new Date().toISOString()
                leads[existingIdx].updatedBy = fromUser
                lead = leads[existingIdx]
              } else {
                lead.status = newStatus
                lead.updatedAt = new Date().toISOString()
                lead.updatedBy = fromUser
                leads.unshift(lead)
              }
              await saveLeads(env, leads)
            }
          } else if (lead) {
            lead.status = newStatus
            lead.updatedAt = new Date().toISOString()
            lead.updatedBy = fromUser
            await saveLeads(env, leads)
          }

          const toast = newStatus === 'in_progress' ? `🟡 В работе (${fromUser})` : newStatus === 'done' ? `🟢 Проект сдан (${fromUser})` : `⚪ В архиве (${fromUser})`
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cq.id, text: toast }),
          })

          if (lead) {
            const { text, reply_markup } = renderLeadCard(lead)
            await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: msg.message_id,
                text,
                parse_mode: 'HTML',
                reply_markup,
              }),
            })
          }
          return new Response('OK', { headers: cors })
        }

        // 1.5 Быстрые кнопки под сообщением с заявкой (🟡 В работу, 🟢 Сдан, ⚪ В архив)
        if (cqData.startsWith('crm:work') || cqData.startsWith('crm:done') || cqData.startsWith('crm:archive')) {
          let targetStatus = 'in_progress'
          let toast = `🟡 Взято в работу (${fromUser})`
          let statusBadgeText = `🟡 <b>Статус: В РАБОТЕ</b> (${fromUser})`

          if (cqData.startsWith('crm:done')) {
            targetStatus = 'done'
            toast = `🟢 Сдано (${fromUser})`
            statusBadgeText = `🟢 <b>Статус: СДАН</b> (${fromUser})`
          } else if (cqData.startsWith('crm:archive')) {
            targetStatus = 'archived'
            toast = `⚪ В архиве (${fromUser})`
            statusBadgeText = `⚪ <b>Статус: В АРХИВЕ</b> (${fromUser})`
          }

          const leadId = cqData.includes(':') ? cqData.split(':')[1] : null
          let lead = leadId ? leads.find((l) => l.id === leadId) : null

          // ВАЖНО: Если заявки ещё нет в базе (старое сообщение или сброс кеша),
          // автоматически парсим её из сообщения и вносим в CRM прямо сейчас!
          if (!lead && msg && msg.text) {
            const parsed = parseLeadFromMessage(msg.text, msg.message_id)
            if (parsed) {
              const existingIdx = leads.findIndex(
                (l) => (parsed.contact && l.contact === parsed.contact) || (parsed.name && l.name === parsed.name)
              )
              if (existingIdx >= 0) {
                leads[existingIdx].status = targetStatus
                leads[existingIdx].updatedAt = new Date().toISOString()
                leads[existingIdx].updatedBy = fromUser
                lead = leads[existingIdx]
              } else {
                parsed.status = targetStatus
                parsed.updatedAt = new Date().toISOString()
                parsed.updatedBy = fromUser
                lead = parsed
                leads.unshift(lead)
              }
              await saveLeads(env, leads)
            }
          } else if (lead) {
            lead.status = targetStatus
            lead.updatedAt = new Date().toISOString()
            lead.updatedBy = fromUser
            await saveLeads(env, leads)
          }

          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cq.id, text: toast + ' и сохранено в CRM!' }),
          })

          if (msg && msg.text) {
            let base = msg.text
              .replace(/^(?:🟡|🟢|⚪)\s*Статус:.*$/m, '')
              .replace(/\n\n\n+/g, '\n\n')
              .trim()

            const updated = base.replace(
              /(🔥\s*Новая заявка с сайта|🎉\s*Новая сделка создана)/i,
              `$1\n\n${statusBadgeText}`
            )

            // Обновляем кнопки сообщения, привязывая ID лида
            const currentRows = msg.reply_markup?.inline_keyboard || []
            const linkRow = currentRows.find((r) => r.some((b) => b.url))
            const newKeyboard = [
              ...(linkRow ? [linkRow] : []),
              [
                { text: targetStatus === 'in_progress' ? '✅ В работе' : '🟡 В работу', callback_data: `crm:status:${lead?.id || 'lead'}:in_progress` },
                { text: targetStatus === 'done' ? '✅ Сдан' : '🟢 Сдан', callback_data: `crm:status:${lead?.id || 'lead'}:done` },
                { text: targetStatus === 'archived' ? '✅ В архив' : '⚪ В архив', callback_data: `crm:status:${lead?.id || 'lead'}:archived` },
              ],
              [
                { text: '📁 Открыть в CRM', callback_data: `crm:view:${lead?.id || 'lead'}` },
                { text: '📋 Копировать бриф', callback_data: `crm:copy:${lead?.id || 'lead'}` },
              ],
            ]

            await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                text: updated,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: newKeyboard },
                disable_web_page_preview: true,
              }),
            })
          }
          return new Response('OK', { headers: cors })
        }

        // 1.6 Копировать бриф
        if (cqData.startsWith('crm:copy')) {
          const leadId = cqData.split(':')[1]
          const lead = leadId ? leads.find((l) => l.id === leadId) : null
          const briefText = lead
            ? `Клиент: ${lead.name}\nКонтакт: ${lead.contact}\nБюджет: ${lead.budget}\nЗадача: ${lead.task}`
            : (stripHtml(msg?.text || '') || 'Данные заявки скопированы')

          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: '📋 Бриф:\n' + briefText.slice(0, 180),
              show_alert: true,
            }),
          })
          return new Response('OK', { headers: cors })
        }

        // 1.7 Финансы
        if (cqData === 'crm:finances') {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cq.id }),
          })
          const { text, reply_markup } = renderFinancialDashboard(leads)
          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: msg.message_id,
              text,
              parse_mode: 'HTML',
              reply_markup,
            }),
          })
          return new Response('OK', { headers: cors })
        }

        // 1.8 Создать сделку
        if (cqData === 'crm:add') {
          await setAdminState(env, chatId, { action: 'add_deal' })
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cq.id }),
          })
          const prompt = [
            '➕ <b>Создание новой сделки</b>',
            '',
            'Пришли мне данные клиента <b>одним сообщением</b> в формате:',
            '<code>Имя, @контакт, Бюджет, Задача</code>',
            '',
            '<b>Пример:</b>',
            '<code>Артем, @artem_design, 85 000 ₽, 3D-сайт для бренда одежды</code>',
            '',
            '<i>(Либо просто отправь контакт или перешли сообщение клиента — бот сам сформирует карточку сделки с кнопками!)</i>',
          ].join('\n')

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: prompt,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'crm:cancel' }]],
              },
            }),
          })
          return new Response('OK', { headers: cors })
        }

        // 1.9 Поиск
        if (cqData === 'crm:search') {
          await setAdminState(env, chatId, { action: 'search' })
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cq.id }),
          })
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '🔍 <b>Поиск по базе CRM</b>\n\nВведи имя клиента, контакт (@никнейм, номер) или слово из задачи:',
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'crm:cancel' }]],
              },
            }),
          })
          return new Response('OK', { headers: cors })
        }

        // 1.10 Отмена действия
        if (cqData === 'crm:cancel') {
          await setAdminState(env, chatId, null)
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cq.id, text: 'Действие отменено' }),
          })
          const { text, reply_markup } = renderAdminDashboard(leads, hasKV)
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: 'HTML',
              reply_markup,
            }),
          })
          return new Response('OK', { headers: cors })
        }

        return new Response('OK', { headers: cors })
      }

      // =============================================================
      // 2. ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ И НИЖНЕЙ КЛАВИАТУРЫ
      // =============================================================
      if (data.message && data.message.text) {
        const msg = data.message
        const fromChatId = msg.chat.id
        const t = (msg.text || '').trim()
        const fromUser = msg.from?.username ? `@${msg.from.username}` : (msg.from?.first_name || 'Админ')

        const state = await getAdminState(env, fromChatId)
        let leads = await getLeads(env)

        // 2.1 Обработка активных сессий (Поиск)
        if (state && state.action === 'search' && !t.startsWith('/')) {
          await setAdminState(env, fromChatId, null)
          const { text: sText, reply_markup: sMarkup } = renderSearchResults(leads, t)
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: fromChatId,
              text: sText,
              parse_mode: 'HTML',
              reply_markup: sMarkup,
            }),
          })
          return new Response('OK', { headers: cors })
        }

        // 2.2 Обработка активных сессий (Создание сделки)
        if (state && state.action === 'add_deal' && !t.startsWith('/')) {
          await setAdminState(env, fromChatId, null)
          const parsed = parseManualDeal(t)

          const newLead = {
            id: 'm_' + Date.now().toString(36),
            name: parsed.name,
            contact: parsed.contact,
            type: 'Индивидуальный заказ',
            task: parsed.task,
            budget: parsed.budget,
            deadline: 'По графику',
            status: 'in_progress',
            createdAt: new Date().toISOString(),
            createdBy: fromUser,
          }

          leads.unshift(newLead)
          await saveLeads(env, leads)

          const cardText = [
            `🎉 <b>Новая сделка создана (${fromUser})!</b>`,
            `🟡 <b>Статус: В РАБОТЕ</b>`,
            '',
            `👤 <b>Клиент:</b> ${esc(newLead.name)}`,
            `📬 <b>Контакт:</b> <code>${esc(newLead.contact)}</code>`,
            `📝 <b>Задача:</b> ${esc(newLead.task)}`,
            `💰 <b>Бюджет:</b> <b>${esc(newLead.budget)}</b>`,
            `⏰ <b>Сроки:</b> ${esc(newLead.deadline)}`,
          ].join('\n')

          // Поиск контактов
          let tg = null
          let wa = null
          const c = newLead.contact
          const tgMatch = c.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{4,})/i) || c.match(/@([a-zA-Z0-9_]{4,})/)
          if (tgMatch) tg = tgMatch[1]
          const digits = c.replace(/\D/g, '')
          if (digits.length >= 10 && digits.length <= 15) {
            wa = digits.length === 11 && digits.startsWith('8') ? '7' + digits.slice(1) : digits
          }

          const buttons = []
          const qRow = []
          if (tg) qRow.push({ text: `✍️ Написать @${tg}`, url: `https://t.me/${tg}` })
          if (wa) qRow.push({ text: '💬 WhatsApp', url: `https://wa.me/${wa}` })
          if (qRow.length) buttons.push(qRow)

          buttons.push([
            { text: '🟢 Сдан', callback_data: `crm:status:${newLead.id}:done` },
            { text: '⚪ В архив', callback_data: `crm:status:${newLead.id}:archived` },
          ])
          buttons.push([
            { text: '📁 Открыть в CRM', callback_data: `crm:view:${newLead.id}` },
            { text: '📋 Копировать', callback_data: `crm:copy:${newLead.id}` },
          ])

          // Рассылка обоим админам
          const notifyTasks = chatIds.map((cid) =>
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: cid,
                text: cardText,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: buttons },
              }),
            })
          )
          await Promise.all(notifyTasks)
          return new Response('OK', { headers: cors })
        }

        // 2.3 Команды нижней клавиатуры
        if (t === '/start' || t === '/admin' || t === '⚡ Меню' || t === '📊 CRM') {
          await setAdminState(env, fromChatId, null)
          const { text, reply_markup } = renderAdminDashboard(leads, hasKV)
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: fromChatId,
              text,
              parse_mode: 'HTML',
              reply_markup,
            }),
          })
          return new Response('OK', { headers: cors })
        }

        if (t.includes('В работе')) {
          await setAdminState(env, fromChatId, null)
          const { text, reply_markup } = renderLeadList(leads, 'in_progress')
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: fromChatId,
              text,
              parse_mode: 'HTML',
              reply_markup,
            }),
          })
          return new Response('OK', { headers: cors })
        }

        if (t.includes('Новые')) {
          await setAdminState(env, fromChatId, null)
          const { text, reply_markup } = renderLeadList(leads, 'new')
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: fromChatId,
              text,
              parse_mode: 'HTML',
              reply_markup,
            }),
          })
          return new Response('OK', { headers: cors })
        }

        if (t.includes('Финансы')) {
          await setAdminState(env, fromChatId, null)
          const { text, reply_markup } = renderFinancialDashboard(leads)
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: fromChatId,
              text,
              parse_mode: 'HTML',
              reply_markup,
            }),
          })
          return new Response('OK', { headers: cors })
        }

        if (t.includes('Добавить сделку')) {
          await setAdminState(env, fromChatId, { action: 'add_deal' })
          const prompt = [
            '➕ <b>Создание новой сделки</b>',
            '',
            'Пришли мне данные клиента <b>одним сообщением</b> в формате:',
            '<code>Имя, @контакт, Бюджет, Задача</code>',
            '',
            '<b>Пример:</b>',
            '<code>Артем, @artem_design, 85 000 ₽, 3D-сайт для бренда одежды</code>',
            '',
            '<i>(Либо просто отправь контакт или перешли сообщение клиента — бот сразу оформит карточку сделки с кнопками!)</i>',
          ].join('\n')

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: fromChatId,
              text: prompt,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'crm:cancel' }]],
              },
            }),
          })
          return new Response('OK', { headers: cors })
        }

        if (t.includes('Поиск')) {
          await setAdminState(env, fromChatId, { action: 'search' })
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: fromChatId,
              text: '🔍 <b>Поиск по базе CRM</b>\n\nВведи имя клиента, контакт (@никнейм, номер) или слово из задачи:',
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'crm:cancel' }]],
              },
            }),
          })
          return new Response('OK', { headers: cors })
        }
      }

      // =============================================================
      // 3. ПРИЁМ НОВОЙ ЗАЯВКИ С САЙТА (Mercury Lead)
      // =============================================================
      if (data.website) {
        // Honeypot (спам-бот заполнил скрытое поле)
        return new Response(JSON.stringify({ ok: true }), { headers: cors })
      }

      const cut = (s, n) => String(s ?? '').trim().slice(0, n)
      const contact = cut(data.contact, 120)
      const task = cut(data.task, 1200)
      if (!contact || !task) {
        return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }), { status: 400, headers: cors })
      }

      const name = cut(data.name, 80) || 'Аноним'
      const type = cut(data.type, 60) || 'Не указан'
      const ref = cut(data.ref, 80)
      const budget = cut(data.budget, 60) || 'Не указан'
      const deadline = cut(data.deadline, 60) || 'Не указан'
      const page = cut(data.page, 300)

      // Сохраняем в CRM
      const newLead = {
        id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        contact,
        type,
        ref,
        task,
        budget,
        deadline,
        page,
        status: 'new',
        createdAt: new Date().toISOString(),
        createdBy: 'Сайт Mercury',
      }

      const leads = await getLeads(env)
      leads.unshift(newLead)
      await saveLeads(env, leads)

      // Умный поиск Telegram и WhatsApp
      let tg = null
      let wa = null
      const c = contact
      const tgLink = c.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{4,})/i)
      if (tgLink) {
        tg = tgLink[1]
      } else {
        const tgAt = c.match(/(?:^|[^\w.@])@([a-zA-Z0-9_]{4,})\b/)
        if (tgAt) tg = tgAt[1]
        else if (/^[a-zA-Z0-9_]{5,}$/.test(c.trim()) && !/^\d+$/.test(c.trim())) tg = c.trim()
      }

      const digits = c.replace(/\D/g, '')
      if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
        wa = '7' + digits.slice(1)
      } else if (digits.length >= 10 && digits.length <= 15) {
        wa = digits
      }

      const text = [
        '🔥 <b>Новая заявка с сайта</b>', '',
        `👤 <b>${esc(name)}</b>`,
        `📬 <code>${esc(contact)}</code>`,
        `🧩 ${esc(type)}${ref ? ` (как «${esc(ref)}»)` : ''}`,
        `📝 ${esc(task)}`,
        `💰 <b>${esc(budget)}</b>`,
        `⏰ ${esc(deadline)}`,
        '',
        `<i>${esc(page)}</i>`,
      ].join('\n')

      const buttons = []
      const quickRow = []
      if (tg) quickRow.push({ text: `✍️ Написать @${tg}`, url: `https://t.me/${tg}` })
      if (wa) quickRow.push({ text: '💬 WhatsApp', url: `https://wa.me/${wa}` })
      if (quickRow.length) buttons.push(quickRow)

      buttons.push([
        { text: '🟡 В работу', callback_data: `crm:status:${newLead.id}:in_progress` },
        { text: '🟢 Сдан', callback_data: `crm:status:${newLead.id}:done` },
        { text: '⚪ В архив', callback_data: `crm:status:${newLead.id}:archived` },
      ])
      buttons.push([
        { text: '📁 Открыть в CRM', callback_data: `crm:view:${newLead.id}` },
        { text: '📋 Копировать бриф', callback_data: `crm:copy:${newLead.id}` },
      ])

      const sendTasks = chatIds.map((id) =>
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: id,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: buttons },
          }),
        }).then((r) => r.json()).catch((err) => ({ ok: false, error: err.message }))
      )

      const results = await Promise.all(sendTasks)
      const isAnyOk = results.some((r) => r && r.ok)

      return new Response(JSON.stringify({ ok: isAnyOk, results, leadId: newLead.id }), {
        status: isAnyOk ? 200 : 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
  },
}
