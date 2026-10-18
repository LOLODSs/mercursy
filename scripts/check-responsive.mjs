/* Run against `npm run preview -- --host 127.0.0.1 --port 4173`.
   CHROME_PATH=/path/to/chrome npm run check:responsive */
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const executablePath = process.env.CHROME_PATH || [
  '/usr/local/bin/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync)
if (!executablePath) throw new Error('Set CHROME_PATH to an installed Chrome/Chromium executable.')
const base = process.env.QA_URL || 'http://127.0.0.1:4173'
const output = resolve(process.env.QA_OUTPUT || 'qa-responsive')
mkdirSync(output, { recursive: true })
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] })
const errors = [], results = []
try {
  for (const [width, height] of [[320,568],[375,667],[390,844],[768,1024],[844,390],[1024,768],[1366,768],[1440,900]]) {
    const page = await browser.newPage()
    await page.setViewport({ width, height, hasTouch: width <= 1100 })
    page.on('pageerror', (e) => errors.push({ width, height, error: e.message }))
    for (const chapter of ['home','services','works','process','reviews','about','contact']) {
      await page.goto(`${base}/?static&qa=${chapter}#${chapter}`, { waitUntil: 'load' })
      await page.waitForSelector('.app.ready')
      await new Promise(r => setTimeout(r, 1200))
      const checks = await page.evaluate(() => {
        const main = document.querySelector('.chapter'), heading = document.querySelector('.compact-heading')
        const compact = getComputedStyle(heading).display !== 'none'
        if (!compact) return { compact }
        const body = [...main.children].find(e => !e.matches('.sr,.compact-heading') && getComputedStyle(e).display !== 'none')
        const overlaps = (a,b) => a.left < b.right-1 && a.right > b.left+1 && a.top < b.bottom-1 && a.bottom > b.top+1
        const mascot = document.querySelector('.mascot').getBoundingClientRect()
        const visibleHeader = [...document.querySelector('.top').children].filter(e => !e.matches('.nav') && getComputedStyle(e).display !== 'none')
        return {
          compact, horizontalOverflow: main.scrollWidth > main.clientWidth + 1,
          titleOverflow: heading.scrollWidth > heading.clientWidth + 1,
          titleOverlap: body && heading.getBoundingClientRect().bottom > body.getBoundingClientRect().top + 1,
          headerOverflow: visibleHeader.some(e => { const r=e.getBoundingClientRect();return r.left < 0 || r.right > innerWidth + 1 }),
          mascotOverlap: overlaps(mascot,main.getBoundingClientRect()),
          headerOverlap: visibleHeader.some((e,i) => visibleHeader.slice(i+1).some(f => overlaps(e.getBoundingClientRect(),f.getBoundingClientRect())) || overlaps(e.getBoundingClientRect(),mascot)),
          crampedViewport: main.clientHeight < innerHeight * .55,
        }
      })
      results.push({ width, height, chapter, ...checks })
      for (const [check, failed] of Object.entries(checks)) if (check !== 'compact' && failed) errors.push({ width, height, chapter, check })
      if (process.env.QA_SCREENSHOTS === '1') await page.screenshot({ path: `${output}/${width}x${height}-${chapter}.png` })
      // The last action must be reachable after a native scroll, without changing chapter.
      if (chapter === 'services' && checks.compact) {
        await page.$eval('.chapter', e => { e.scrollTop = e.scrollHeight })
        const accessible = await page.$eval('.svc-item:last-child button', e => {
          const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))
        })
        if (!accessible) errors.push({ width, height, chapter, check: 'last action covered' })
        if (await page.evaluate(() => location.hash) !== '#services') errors.push({ width, height, chapter, check: 'scroll changed chapter' })
      }
    }
    await page.close()
  }
  writeFileSync(`${output}/results.json`, JSON.stringify({ results, errors }, null, 2))
  console.log(`Responsive checks: ${results.length}; failures: ${errors.length}. Report: ${output}/results.json`)
  if (errors.length) { console.error(JSON.stringify(errors, null, 2)); process.exitCode = 1 }
} finally { await browser.close() }
