/* Vercel Serverless Function: POST /api/lead → сообщение в Telegram.
   Переменные окружения (Vercel → Settings → Environment Variables):
     TELEGRAM_BOT_TOKEN — токен от @BotFather
     TELEGRAM_CHAT_ID   — твой chat id (npm run tg:chat-id) */

import { addLead } from '../server/crm.js'

const hits = new Map() // простой анти-спам: 5 заявок / 10 минут с одного IP
const esc = (s = '') => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
const cut = (s, n) => String(s ?? '').trim().slice(0, n)

const readBody = (req) => new Promise((ok, fail) => {
  let d = ''; req.on('data', (c) => { d += c; if (d.length > 2e4) req.destroy() }); req.on('end', () => ok(d)); req.on('error', fail)
})

export function formatLead(l, id = null) {
  let tg = null
  const c = String(l.contact || '').trim()
  if (/^@[\w\d_]{4,}$/.test(c)) tg = c.slice(1)
  else if (/^[\w\d_]{4,}$/.test(c) && !/^\d+$/.test(c)) tg = c
  else {
    const m = c.match(/(?:t\.me|telegram\.me)\/([\w\d_]{4,})/i)
    if (m) tg = m[1]
  }
  const text = [
    '🔥 <b>Новая заявка с сайта</b>', '',
    `👤 <b>${esc(l.name)}</b>`,
    `📬 ${esc(l.contact)}`,
    `🧩 ${esc(l.type)}${l.ref ? ` (как «${esc(l.ref)}»)` : ''}`,
    `📝 ${esc(l.task)}`,
    `💰 ${esc(l.budget)}`,
    `⏰ ${esc(l.deadline)}`,
    '', `<i>${esc(l.page)}</i>`,
  ].join('\n')
  const leadKey = id || 'lead'
  const buttons = []
  if (tg) buttons.push([{ text: '✍️ Ответить клиенту', url: `https://t.me/${tg}` }])
  buttons.push([
    { text: '🟡 В работу', callback_data: `crm:work:${leadKey}` },
    { text: '🟢 Сдан', callback_data: `crm:done:${leadKey}` },
    { text: '⚪ В архив', callback_data: `crm:archive:${leadKey}` },
  ])
  buttons.push([
    { text: '📂 Карточка в CRM', callback_data: `crm:view:${leadKey}` },
    { text: '📋 Копировать бриф', callback_data: `crm:copy:${leadKey}` },
  ])
  const reply_markup = { inline_keyboard: buttons }
  return { text, reply_markup }
}

export async function sendLead(raw, env, ip = 'x') {
  if (raw.website) return [200, { ok: true }] // honeypot — бот заполнил скрытое поле
  const now = Date.now(), h = (hits.get(ip) || []).filter((t) => now - t < 6e5)
  if (h.length >= 5) return [429, { error: 'too_many' }]
  hits.set(ip, [...h, now])
  const l = {
    name: cut(raw.name, 80), contact: cut(raw.contact, 120), type: cut(raw.type, 60), ref: cut(raw.ref, 80),
    task: cut(raw.task, 1200), budget: cut(raw.budget, 60), deadline: cut(raw.deadline, 60), page: cut(raw.page, 300),
  }
  if (!l.contact || !l.task) return [400, { error: 'missing_fields' }]
  const botToken = env.TELEGRAM_BOT_TOKEN || '8943025919:AAEgsA7CYUrursO7ihR2sMVd4BoPDG1Gas4'
  const chatId = env.TELEGRAM_CHAT_ID || '1031568361'
  if (!botToken || !chatId) return [503, { error: 'not_configured' }]
  let saved = null
  try { saved = addLead(l) } catch (e) { console.warn('CRM save error', e.message) }
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, parse_mode: 'HTML', disable_web_page_preview: true, ...formatLead(l, saved?.id) }),
  })
  if (!r.ok) { console.error('telegram error', r.status, await r.text()); return [502, { error: 'telegram' }] }
  return [200, { ok: true }]
}

export default async function handler(req, res) {
  const send = ([code, obj]) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
  if (req.method !== 'POST') return send([405, { error: 'method' }])
  let body = req.body
  try { if (!body || typeof body === 'string') body = JSON.parse(typeof body === 'string' ? body : await readBody(req)) } catch { return send([400, { error: 'bad_json' }]) }
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim()
  try { send(await sendLead(body || {}, process.env, ip)) } catch (e) { console.error(e); send([500, { error: 'server' }]) }
}
