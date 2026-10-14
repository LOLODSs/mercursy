/* Узнать свой TELEGRAM_CHAT_ID: напиши своему боту любое сообщение, затем `npm run tg:chat-id` */
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split('=').map((s) => s.trim())))
const token = env.TELEGRAM_BOT_TOKEN
if (!token) { console.error('Сначала впиши TELEGRAM_BOT_TOKEN в .env'); process.exit(1) }
const r = await (await fetch(`https://api.telegram.org/bot${token}/getUpdates`)).json()
const chats = [...new Map((r.result || []).map((u) => u.message?.chat).filter(Boolean).map((c) => [c.id, c])).values()]
if (!chats.length) console.log('Пусто. Напиши боту любое сообщение и запусти ещё раз.')
chats.forEach((c) => console.log(`TELEGRAM_CHAT_ID=${c.id}   ← ${c.first_name || c.title || ''} ${c.username ? '@' + c.username : ''}`))
