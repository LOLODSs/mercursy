import puppeteer from 'puppeteer-core'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

// Simple static server for dist
function createServer(distDir, port = 4173) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.mp4': 'video/mp4'
  }

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0].split('#')[0]
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html'
    const filePath = path.join(distDir, reqPath)

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase()
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      })
      fs.createReadStream(filePath).pipe(res)
    } else {
      // SPA fallback
      const indexPath = path.join(distDir, 'index.html')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      fs.createReadStream(indexPath).pipe(res)
    }
  })

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server)
    })
  })
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms))

async function runBenchmark() {
  const distDir = path.resolve('dist')
  if (!fs.existsSync(distDir)) {
    console.error('dist does not exist, run build first!')
    process.exit(1)
  }

  const server = await createServer(distDir, 4173)
  console.log('Static server running on http://127.0.0.1:4173')

  const executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=d3d11', // Real hardware D3D11 on Windows
      '--enable-gpu-rasterization',
      '--enable-zero-copy',
      '--ignore-gpu-blocklist'
    ]
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })

    // Inject PerformanceObserver for Long Tasks and frame recorder
    await page.evaluateOnNewDocument(() => {
      window.__perfData = {
        frameDeltas: [],
        longTasks: [],
        lastFrame: performance.now(),
        recording: false
      }

      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (window.__perfData.recording) {
              window.__perfData.longTasks.push({
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name
              })
            }
          }
        })
        obs.observe({ entryTypes: ['longtask'] })
      } catch (e) {}

      function tick(now) {
        if (window.__perfData.recording) {
          const dt = now - window.__perfData.lastFrame
          window.__perfData.frameDeltas.push(dt)
        }
        window.__perfData.lastFrame = now
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    console.log('Navigating to http://127.0.0.1:4173?debug ...')
    await page.goto('http://127.0.0.1:4173?debug', { waitUntil: 'networkidle2' })
    await page.waitForSelector('.app.ready', { timeout: 10000 })
    await pause(1000)

    console.log('Starting perf recording across user interactions...')
    await page.evaluate(() => {
      window.__perfData.frameDeltas = []
      window.__perfData.longTasks = []
      window.__perfData.recording = true
      window.__perfData.lastFrame = performance.now()
    })

    // 1. Idle home (2 seconds)
    await pause(2000)

    // 2. Flip through all chapters
    const chapters = ['services', 'works', 'process', 'reviews', 'about', 'contact', 'home']
    for (const ch of chapters) {
      await page.evaluate((target) => {
        location.hash = '#' + target
      }, ch)
      await pause(1400) // allow transition animation to complete
    }

    // 3. Carousel scroll test on Works chapter
    await page.evaluate(() => {
      location.hash = '#works'
    })
    await pause(1200)

    // Scroll reel horizontally back and forth
    for (let i = 0; i < 5; i++) {
      await page.evaluate((step) => {
        const reel = document.querySelector('.reel')
        if (reel) reel.scrollLeft += step
      }, 300)
      await pause(150)
    }

    // 4. Open and close Calculator
    await page.evaluate(() => {
      location.hash = '#calc'
    })
    await pause(800)
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.calc-close')
      if (closeBtn) closeBtn.click()
    })
    await pause(600)

    // 5. Move mouse across screen to test raymarching & cursor tracking
    for (let x = 200; x < 1200; x += 150) {
      await page.mouse.move(x, 450)
      await pause(50)
    }

    const data = await page.evaluate(() => {
      window.__perfData.recording = false
      const deltas = window.__perfData.frameDeltas
      const longTasks = window.__perfData.longTasks
      const memory = performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null

      const stageQuality = window.__stage?.quality ?? null

      return { deltas, longTasks, memory, stageQuality }
    })

    const deltas = data.deltas
    if (deltas.length === 0) {
      console.log('No frame deltas collected.')
      return
    }

    const totalFrames = deltas.length
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / totalFrames
    const avgFps = 1000 / avgDelta

    // Sort deltas for percentiles (higher delta = lower fps)
    const sorted = [...deltas].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]
    const maxDelta = sorted[sorted.length - 1]

    // 1% low FPS: 99th percentile frame delta inverted
    const onePctLowFps = 1000 / p99

    const drops16 = deltas.filter((d) => d > 20).length
    const drops33 = deltas.filter((d) => d > 33.3).length
    const drops50 = deltas.filter((d) => d > 50).length

    console.log('\n================ PERF BENCHMARK RESULTS ================')
    console.log(`Total Frames Recorded: ${totalFrames}`)
    console.log(`Average FPS:           ${avgFps.toFixed(1)} fps (avg frame ${avgDelta.toFixed(2)} ms)`)
    console.log(`Median Frame (p50):    ${p50.toFixed(2)} ms (${(1000 / p50).toFixed(1)} fps)`)
    console.log(`95th Percentile (p95): ${p95.toFixed(2)} ms (${(1000 / p95).toFixed(1)} fps)`)
    console.log(`99th Percentile (p99): ${p99.toFixed(2)} ms (1% low: ${onePctLowFps.toFixed(1)} fps)`)
    console.log(`Worst Frame Drop:      ${maxDelta.toFixed(2)} ms`)
    console.log(`Frames > 20ms:         ${drops16} (${((drops16 / totalFrames) * 100).toFixed(1)}%)`)
    console.log(`Frames > 33.3ms:       ${drops33} (${((drops33 / totalFrames) * 100).toFixed(1)}%)`)
    console.log(`Frames > 50ms:         ${drops50} (${((drops50 / totalFrames) * 100).toFixed(1)}%)`)
    console.log(`Long Tasks (>50ms):    ${data.longTasks.length}`)
    if (data.longTasks.length > 0) {
      console.log('Long Tasks details:', data.longTasks)
    }
    console.log(`Stage WebGL Quality:   ${data.stageQuality}`)
    if (data.memory) {
      console.log(`JS Heap Used:          ${(data.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
      console.log(`JS Heap Total:         ${(data.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    }
    console.log('========================================================\n')

    fs.writeFileSync('qa-perf-baseline.json', JSON.stringify({
      totalFrames,
      avgFps,
      p50,
      p95,
      p99,
      onePctLowFps,
      maxDelta,
      drops16,
      drops33,
      drops50,
      longTasks: data.longTasks,
      stageQuality: data.stageQuality,
      memory: data.memory
    }, null, 2))

  } finally {
    await browser.close()
    server.close()
  }
}

runBenchmark().catch((err) => {
  console.error(err)
  process.exit(1)
})
