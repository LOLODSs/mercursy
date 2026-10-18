/**
 * Mercury Production Node.js Server
 * - Serves static files from ./dist
 * - Handles /api/lead for Mascot chat
 * - Runs Telegram Bot & Mini-CRM Engine in background
 * 
 * Usage:
 *   node server.js
 * Or:
 *   npm start
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sendLead } from './api/lead.js'
import { startBot } from './scripts/bot.mjs'

// Load .env
function loadEnv() {
  if (!fs.existsSync('.env')) return {}
  const raw = fs.readFileSync('.env', 'utf8')
  return Object.fromEntries(
    raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const idx = l.indexOf('=')
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
      })
  )
}

const env = { ...process.env, ...loadEnv() }
const PORT = Number(env.PORT || 3000)
const HOST = env.HOST || '0.0.0.0'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
}

const readBody = (req) =>
  new Promise((ok, fail) => {
    let d = ''
    req.on('data', (c) => {
      d += c
      if (d.length > 3e4) req.destroy()
    })
    req.on('end', () => ok(d))
    req.on('error', fail)
  })

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  // API Route: /api/lead
  if (url.pathname === '/api/lead' || url.pathname === '/api/lead.php') {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'method' }))
    }
    let body = {}
    try {
      const raw = await readBody(req)
      body = JSON.parse(raw || '{}')
    } catch {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'bad_json' }))
    }

    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x')
      .split(',')[0]
      .trim()

    try {
      const [code, result] = await sendLead(body, env, ip)
      res.statusCode = code
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify(result))
    } catch (err) {
      console.error('[API Lead Error]', err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ error: 'server' }))
    }
  }

  // Static File Serving
  let pathname = decodeURIComponent(url.pathname)
  let filePath = path.join(DIST, pathname)

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
    }

    fs.stat(filePath, (err2, stats2) => {
      if (err2 || !stats2.isFile()) {
        // SPA Fallback to index.html
        const fallback = path.join(DIST, 'index.html')
        fs.readFile(fallback, (err3, data) => {
          if (err3) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            return res.end('Файлы не найдены. Сначала выполните: npm run build')
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(data)
        })
        return
      }

      const ext = path.extname(filePath).toLowerCase()
      const contentType = MIME[ext] || 'application/octet-stream'
      res.setHeader('Content-Type', contentType)

      if (['.woff2', '.webp', '.jpg', '.png', '.mp4'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      }

      fs.createReadStream(filePath).pipe(res)
    })
  })
})

server.listen(PORT, HOST, () => {
  console.log(`[Mercury] 🌐 Сервер запущен на http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`)
  console.log(`[Mercury] 📬 Эндпоинт заявок: /api/lead активен`)

  if (env.TELEGRAM_BOT_TOKEN) {
    startBot().catch((err) => console.error('[Bot Engine Error]', err))
  } else {
    console.warn('[Mercury] ⚠️ TELEGRAM_BOT_TOKEN не найден в .env')
  }
})
