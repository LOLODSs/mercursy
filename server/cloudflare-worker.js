/**
 * Mercury Telegram Lead Gateway — Cloudflare Worker (с вебхуком и CRM-кнопками)
 * 
 * 1. Принимает заявки с сайта (от Капли) и моментально шлёт в Telegram.
 * 2. Поддерживает несколько получателей (тебе и другу через запятую).
 * 3. Находит Telegram (@ник) и телефон (WhatsApp) даже в длинном тексте и создаёт быстрые кнопки связи.
 * 4. Обрабатывает нажатия на CRM-кнопки («🟡 В работу», «🟢 Сдан», «⚪ В архив», «📋 Копировать бриф»).
 */

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

    const botToken = env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN'
    const rawChatIds = env.TELEGRAM_CHAT_ID || 'YOUR_TELEGRAM_CHAT_ID'
    const chatIds = String(rawChatIds)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    const url = new URL(request.url)

    // Маршрут быстрой привязки вебхука: открой в браузере https://твой-воркер.workers.dev/set-webhook
    if (url.pathname === '/set-webhook') {
      const webhookUrl = url.origin
      const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`)
      const setJson = await setRes.json()
      return new Response(JSON.stringify({ ok: true, webhook: webhookUrl, telegram: setJson }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (request.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, service: 'mercury-gateway' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors })
    }

    try {
      const data = await request.json().catch(() => ({}))

      // -------------------------------------------------------------
      // 1. ОБРАБОТКА НАЖАТИЙ НА КНОПКИ В TELEGRAM (Callback Queries)
      // -------------------------------------------------------------
      if (data.callback_query) {
        const cq = data.callback_query
        const cqData = cq.data || ''
        const user = cq.from.username ? `@${cq.from.username}` : (cq.from.first_name || 'Сотрудник')
        const msg = cq.message

        let toast = 'Действие сохранено'
        let statusBadge = null

        if (cqData.startsWith('crm:work')) {
          toast = `🟡 Взято в работу (${user})`
          statusBadge = `🟡 <b>Статус: В РАБОТЕ</b> (${user})`
        } else if (cqData.startsWith('crm:done')) {
          toast = `🟢 Сдано (${user})`
          statusBadge = `🟢 <b>Статус: СДАН</b> (${user})`
        } else if (cqData.startsWith('crm:archive')) {
          toast = `⚪ В архиве (${user})`
          statusBadge = `⚪ <b>Статус: В АРХИВЕ</b> (${user})`
        } else if (cqData.startsWith('crm:copy')) {
          // Отправка данных заявки в модальном окне Telegram
          const briefText = (msg?.text || 'Данные заявки скопированы').slice(0, 180)
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: '📋 Данные заявки:\n' + briefText,
              show_alert: true,
            }),
          })
          return new Response('OK', { headers: cors })
        }

        // Моментальный ответ Telegram, чтобы на кнопке погас лоадер и вылез тост
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: cq.id,
            text: toast,
          }),
        })

        // Обновляем текст сообщения со статусом
        if (msg && msg.text && statusBadge) {
          let base = msg.text
            .replace(/^(?:🟡|🟢|⚪)\s*Статус:.*$/m, '')
            .replace(/\n\n\n+/g, '\n\n')
            .trim()

          const updated = base.replace(
            /(🔥\s*Новая заявка с сайта)/i,
            `$1\n\n${statusBadge}`
          )

          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: msg.chat.id,
              message_id: msg.message_id,
              text: updated,
              parse_mode: 'HTML',
              reply_markup: msg.reply_markup,
              disable_web_page_preview: true,
            }),
          })
        }

        return new Response('OK', { headers: cors })
      }

      // -------------------------------------------------------------
      // 2. ОБРАБОТКА НОВОЙ ЗАЯВКИ С САЙТА (Mascot Lead)
      // -------------------------------------------------------------
      if (data.website) {
        // Honeypot (спам-бот заполнил скрытое поле)
        return new Response(JSON.stringify({ ok: true }), { headers: cors })
      }

      // Защита от спама и переполнения
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

      const esc = (s = '') => String(s ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))

      // Умный поиск Telegram и WhatsApp контактов
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
        `📬 ${esc(contact)}`,
        `🧩 ${esc(type)}${ref ? ` (как «${esc(ref)}»)` : ''}`,
        `📝 ${esc(task)}`,
        `💰 ${esc(budget)}`,
        `⏰ ${esc(deadline)}`,
        '', `<i>${esc(page)}</i>`,
      ].join('\n')

      const buttons = []
      const quickRow = []
      if (tg) quickRow.push({ text: `✍️ Написать @${tg}`, url: `https://t.me/${tg}` })
      if (wa) quickRow.push({ text: '💬 WhatsApp', url: `https://wa.me/${wa}` })
      if (quickRow.length) buttons.push(quickRow)

      buttons.push([
        { text: '🟡 В работу', callback_data: 'crm:work' },
        { text: '🟢 Сдан', callback_data: 'crm:done' },
        { text: '⚪ В архив', callback_data: 'crm:archive' },
      ])
      buttons.push([
        { text: '📋 Копировать бриф', callback_data: 'crm:copy' },
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

      return new Response(JSON.stringify({ ok: isAnyOk, results }), {
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
