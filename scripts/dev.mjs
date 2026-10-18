import { createServer } from 'vite'
import { startBot } from './bot.mjs'
import fs from 'node:fs'

const logFile = new URL('../dev-crash.log', import.meta.url)

function logCrash(err) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${err?.stack || err}\n`)
  } catch {}
}

process.on('uncaughtException', (err) => {
  logCrash(err)
  console.error('[UncaughtException]', err)
})

process.on('unhandledRejection', (reason) => {
  logCrash(reason)
  console.error('[UnhandledRejection]', reason)
})

process.on('exit', (code) => {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] process exit code: ${code}\n`)
  } catch {}
})

// Keep-alive timer ensures the Node event loop never empties
setInterval(() => {}, 60000)

const server = await createServer()
await server.listen()
server.printUrls()

startBot().catch((err) => {
  logCrash(err)
  console.error('[Bot Error]', err)
})
