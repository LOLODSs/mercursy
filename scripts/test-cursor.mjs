import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox']
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.goto('http://127.0.0.1:5173/')
await new Promise(r => setTimeout(r, 2000))

const mascot = await page.$('.mascot')
const box = await mascot.boundingBox()
console.log('Mascot box after animation:', box)

// Move mouse to mascot
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await new Promise(r => setTimeout(r, 200))

const overMascot = await page.evaluate(() => {
  const c = document.querySelector('.cursor')
  const el = document.elementFromPoint(window.innerWidth - 50, window.innerHeight - 50)
  return {
    cursorClass: c ? c.className : null,
    cursorOpacity: c ? getComputedStyle(c).opacity : null,
    cursorVisibility: c ? getComputedStyle(c).visibility : null,
    cursorSpan: c?.querySelector('span')?.textContent,
    elUnderMouse: el?.tagName + '.' + el?.className,
    elementCursor: el ? getComputedStyle(el).cursor : null,
    bodyCursor: getComputedStyle(document.body).cursor
  }
})
console.log('Hovering mascot (closed):', overMascot)

// Click mascot to open chat
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
await new Promise(r => setTimeout(r, 600))

const afterOpen = await page.evaluate(() => {
  const c = document.querySelector('.cursor')
  const el = document.elementFromPoint(window.innerWidth - 50, window.innerHeight - 50)
  return {
    cursorClass: c ? c.className : null,
    cursorOpacity: c ? getComputedStyle(c).opacity : null,
    cursorVisibility: c ? getComputedStyle(c).visibility : null,
    cursorSpan: c?.querySelector('span')?.textContent,
    elUnderMouse: el?.tagName + '.' + el?.className,
    elementCursor: el ? getComputedStyle(el).cursor : null,
    bodyCursor: getComputedStyle(document.body).cursor
  }
})
console.log('Hovering mascot (open):', afterOpen)

// Hover over chat window
await page.mouse.move(1920 - 200, 1080 - 300)
await new Promise(r => setTimeout(r, 200))
const inChat = await page.evaluate(() => {
  const c = document.querySelector('.cursor')
  const el = document.elementFromPoint(1920 - 200, 1080 - 300)
  return {
    cursorClass: c ? c.className : null,
    cursorOpacity: c ? getComputedStyle(c).opacity : null,
    cursorVisibility: c ? getComputedStyle(c).visibility : null,
    elUnderMouse: el?.tagName + '.' + el?.className,
    elementCursor: el ? getComputedStyle(el).cursor : null,
    bodyCursor: getComputedStyle(document.body).cursor
  }
})
console.log('Inside chat window:', inChat)

// Hover on body while chat is open
await page.mouse.move(500, 500)
await new Promise(r => setTimeout(r, 200))
const overBodyOpen = await page.evaluate(() => {
  const c = document.querySelector('.cursor')
  const el = document.elementFromPoint(500, 500)
  return {
    cursorClass: c ? c.className : null,
    cursorOpacity: c ? getComputedStyle(c).opacity : null,
    cursorVisibility: c ? getComputedStyle(c).visibility : null,
    elUnderMouse: el?.tagName + '.' + el?.className,
    elementCursor: el ? getComputedStyle(el).cursor : null,
    bodyCursor: getComputedStyle(document.body).cursor
  }
})
console.log('Over body while chat is open:', overBodyOpen)

// Move back to mascot and click to close
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await new Promise(r => setTimeout(r, 200))
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
await new Promise(r => setTimeout(r, 600))

const afterClose = await page.evaluate(() => {
  const c = document.querySelector('.cursor')
  const chat = document.querySelector('.chat')
  return {
    chatOpen: chat?.classList.contains('open'),
    cursorClass: c ? c.className : null,
    cursorOpacity: c ? getComputedStyle(c).opacity : null,
    cursorVisibility: c ? getComputedStyle(c).visibility : null,
    cursorSpan: c?.querySelector('span')?.textContent
  }
})
console.log('After closing mascot:', afterClose)

await page.screenshot({ path: 'scripts/cursor-verified.png' })
await browser.close()
