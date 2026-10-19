import { sendLead } from '../../api/lead.js'

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const env = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '8943025919:AAEgsA7CYUrursO7ihR2sMVd4BoPDG1Gas4',
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '1031568361',
    }
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('client-ip') || 'x'
    const [status, data] = await sendLead(body, env, ip)

    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
