import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const outDir = path.resolve('qa-adaptive-audit')
fs.mkdirSync(outDir, { recursive: true })

async function runAdaptiveAudit() {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const auditReport = []

  try {
    const viewports = [
      { name: 'iPhone SE (320x568)', w: 320, h: 568, isMobile: true },
      { name: 'iPhone 14 (390x844)', w: 390, h: 844, isMobile: true },
      { name: 'Android Galaxy (360x780)', w: 360, h: 780, isMobile: true },
      { name: 'Landscape Phone (844x390)', w: 844, h: 390, isMobile: true },
      { name: 'iPad Portrait (768x1024)', w: 768, h: 1024, isMobile: false },
      { name: 'Laptop HD (1366x768)', w: 1366, h: 768, isMobile: false },
      { name: 'Desktop Full HD (1920x1080)', w: 1920, h: 1080, isMobile: false }
    ]

    const chapters = ['home', 'services', 'works', 'process', 'reviews', 'about', 'contact']

    for (const vp of viewports) {
      console.log(`Auditing viewport: ${vp.name}...`)
      const page = await browser.newPage()
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.isMobile, hasTouch: vp.isMobile })

      for (const ch of chapters) {
        await page.goto(`http://127.0.0.1:4173/#${ch}`, { waitUntil: 'networkidle2' })
        await page.waitForSelector('.app.ready')
        await pause(250)

        const checks = await page.evaluate((chName) => {
          const bad = []
          // 1. Horizontal overflow of body or chapter
          const docW = document.documentElement.clientWidth
          const scrollW = document.documentElement.scrollWidth
          if (scrollW > docW + 1) bad.push(`Doc horizontal overflow: ${scrollW}px > ${docW}px`)

          // 2. Overlapping text or buttons
          const headings = [...document.querySelectorAll('h1, h2, h3')]
          for (const h of headings) {
            const r = h.getBoundingClientRect()
            if (r.width > docW + 1) bad.push(`Heading ${h.tagName} overflows viewport: ${r.width.toFixed(0)}px > ${docW}px`)
          }

          // 3. Header items bounds
          const logo = document.querySelector('.logo')
          if (logo) {
            const lr = logo.getBoundingClientRect()
            if (lr.left < 0 || lr.right > docW) bad.push(`Logo clipped horizontally: ${lr.left} - ${lr.right}`)
          }

          // 4. Mascot button accessibility
          const mascot = document.querySelector('.mascot')
          if (mascot && getComputedStyle(mascot).display !== 'none') {
            const mr = mascot.getBoundingClientRect()
            if (mr.right > docW || mr.bottom > window.innerHeight) {
              bad.push(`Mascot offscreen: right ${mr.right}, bottom ${mr.bottom}`)
            }
          }

          return {
            docW,
            docH: window.innerHeight,
            bad
          }
        }, ch)

        auditReport.push({
          viewport: vp.name,
          chapter: ch,
          ...checks
        })

        // Screenshot representative cases
        if (['iPhone 14 (390x844)', 'iPad Portrait (768x1024)', 'Landscape Phone (844x390)'].includes(vp.name)) {
          if (['home', 'services', 'works', 'contact'].includes(ch)) {
            await page.screenshot({ path: path.join(outDir, `${vp.w}x${vp.h}-${ch}.png`) })
          }
        }
      }

      // Also audit Calculator on this viewport
      await page.goto('http://127.0.0.1:4173/#calc', { waitUntil: 'networkidle2' })
      await page.waitForSelector('.calc-panel')
      await pause(600)

      const calcChecks = await page.evaluate(() => {
        const panel = document.querySelector('.calc-panel')
        const orderBtn = document.querySelector('.calc-order')
        const bad = []

        if (panel) {
          const pr = panel.getBoundingClientRect()
          if (pr.left < 0 || pr.right > window.innerWidth) bad.push(`Calc panel horizontal clip: ${pr.left} - ${pr.right}`)
          if (pr.bottom > window.innerHeight) bad.push(`Calc panel bottom overflow: ${pr.bottom} > ${window.innerHeight}`)
        }
        if (orderBtn) {
          const or = orderBtn.getBoundingClientRect()
          if (or.width < 50 || or.height < 30) bad.push(`Order button too small: ${or.width}x${or.height}`)
          const midX = or.left + or.width / 2
          const midY = or.top + or.height / 2
          const topEl = document.elementFromPoint(midX, midY)
          if (topEl && !orderBtn.contains(topEl)) bad.push('Order button covered')
        }
        return { bad }
      })

      auditReport.push({
        viewport: vp.name,
        component: 'Calculator',
        ...calcChecks
      })

      if (['iPhone 14 (390x844)', 'iPad Portrait (768x1024)', 'Landscape Phone (844x390)'].includes(vp.name)) {
        await page.screenshot({ path: path.join(outDir, `${vp.w}x${vp.h}-calc.png`) })
      }

      await page.close()
    }

    const issues = auditReport.filter(r => r.bad && r.bad.length > 0)
    console.log(`\n================ ADAPTIVE AUDIT SUMMARY ================`)
    console.log(`Total checks: ${auditReport.length}`)
    console.log(`Issues found: ${issues.length}`)
    if (issues.length > 0) {
      console.log('Issues details:', JSON.stringify(issues, null, 2))
    } else {
      console.log('ALL VIEWPORTS, CHAPTERS & CALCULATOR PASSED WITH ZERO ISSUES! 💯')
    }
    console.log(`========================================================\n`)

    fs.writeFileSync(path.join(outDir, 'audit-results.json'), JSON.stringify({ auditReport, issues }, null, 2))

  } finally {
    await browser.close()
  }
}

runAdaptiveAudit().catch(console.error)
