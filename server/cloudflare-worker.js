/**
 * Mercury Telegram Lead Gateway — Cloudflare Worker
 * 
 * 100% бесплатный серверный шлюз без VPN.
 * Принимает заявку от Капли из любого браузера в РФ и моментально шлёт в Telegram.
 * 
 * ИНСТРУКЦИЯ (займёт ровно 2 минуты):
 * 1. Зайди на https://dash.cloudflare.com/ (вход бесплатный, карта НЕ нужна).
 * 2. Раздел: Workers & Pages → Create Application → Create Worker.
 * 3. Нажми «Deploy» → затем «Edit code».
 * 4. Сотри всё и вставь этот файл целиком → нажми «Save and Deploy».
 * 5. Скопируй полученный адрес (например: https://mercury-lead.xxxx.workers.dev)
 * 6. Вставь его в src/config.js в поле mascot.endpoint!
 */

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors })
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors })
    }

    try {
      const data = await request.json()
      if (data.website) {
        return new Response(JSON.stringify({ ok: true }), { headers: cors })
      }

      const botToken = env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN'
      const chatId = env.TELEGRAM_CHAT_ID || 'YOUR_TELEGRAM_CHAT_ID'

      // Защита от спама и флуда
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

      let tg = null
      const c = contact
      if (/^@?[\w\d_]{4,}$/.test(c) && !/^\d+$/.test(c)) tg = c.replace(/^@/, '')
      else {
        const m = c.match(/(?:t\.me|telegram\.me)\/([\w\d_]{4,})/i)
        if (m) tg = m[1]
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
      if (tg) buttons.push([{ text: '✍️ Ответить клиенту', url: `https://t.me/${tg}` }])
      buttons.push([
        { text: '🟡 В работу', callback_data: 'crm:work:lead' },
        { text: '🟢 Сдан', callback_data: 'crm:done:lead' },
        { text: '⚪ В архив', callback_data: 'crm:archive:lead' },
      ])
      buttons.push([
        { text: '📋 Копировать бриф', callback_data: 'crm:copy:lead' },
      ])

      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: buttons },
        }),
      })

      const tgData = await tgRes.json()
      return new Response(JSON.stringify(tgData), {
        status: tgRes.status,
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
