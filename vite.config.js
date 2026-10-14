import { defineConfig, loadEnv } from 'vite'
import preact from '@preact/preset-vite'

/* В dev-режиме /api/lead работает локально: заявки реально уходят в Telegram,
   если в .env заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID (см. .env.example) */
const devApi = (env) => ({
  name: 'dev-lead-api',
  configureServer(server) {
    Object.assign(process.env, env)
    server.middlewares.use('/api/lead', async (req, res) => {
      const { default: handler } = await server.ssrLoadModule('/api/lead.js')
      handler(req, res)
    })
  },
})

/* preload шрифтов первого экрана (кириллица Oswald 700 + Manrope 400/600), чтобы лоадер не ждал цепочку CSS → woff2 */
const preloadFonts = () => ({
  name: 'preload-fonts',
  apply: 'build',
  transformIndexHtml: { order: 'post', handler(html, ctx) {
    const want = ctx.filename.endsWith('demo.html') ? [/manrope-cyrillic-800/, /manrope-cyrillic-600/] : [/oswald-cyrillic-700/, /manrope-cyrillic-400/, /manrope-cyrillic-600/]
    const files = Object.keys(ctx.bundle || {}).filter((f) => f.endsWith('.woff2') && want.some((r) => r.test(f)))
    return files.map((f) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `./${f}`, crossorigin: '' }, injectTo: 'head' }))
  } },
})

export default defineConfig(({ mode }) => ({
  plugins: [preact(), preloadFonts(), devApi(loadEnv(mode, process.cwd(), 'TELEGRAM_'))],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: { target: 'es2020', rollupOptions: { input: { main: 'index.html', demo: 'demo.html' } } },
}))
