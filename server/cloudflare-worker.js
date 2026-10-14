/* Альтернатива Vercel: Cloudflare Worker (бесплатно).
   1) npm i -g wrangler && wrangler init lead-bot  2) вставь этот файл как src/index.js
   3) wrangler secret put TELEGRAM_BOT_TOKEN && wrangler secret put TELEGRAM_CHAT_ID
   4) wrangler deploy → в src/config.js: mascot.endpoint = 'https://lead-bot.<ты>.workers.dev'
   ALLOWED_ORIGIN — домен сайта, чтобы чужие сайты не слали тебе спам. */
import { sendLead } from '../api/lead.js'

const ALLOWED_ORIGIN = 'https://vaganito.ru' // 🟡 ЗАГЛУШКА

export default {
  async fetch(req, env) {
    const cors = { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (req.method !== 'POST') return new Response('{"error":"method"}', { status: 405, headers: cors })
    let body; try { body = await req.json() } catch { return new Response('{"error":"bad_json"}', { status: 400, headers: cors }) }
    const [code, obj] = await sendLead(body, env, req.headers.get('cf-connecting-ip') || 'x')
    return new Response(JSON.stringify(obj), { status: code, headers: { ...cors, 'Content-Type': 'application/json' } })
  },
}
