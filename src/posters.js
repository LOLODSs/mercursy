import { profile, projects } from './config.js'

const INK = '#ecebe6'
function bg(ctx, w, h) {
  ctx.fillStyle = '#060606'; ctx.fillRect(0, 0, w, h)
  const g = ctx.createRadialGradient(w * 0.7, h * 0.35, 0, w * 0.7, h * 0.35, Math.max(w, h) * 0.8)
  g.addColorStop(0, 'rgba(70,70,80,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
}
function iri(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h)
  g.addColorStop(0, '#ff9ad5'); g.addColorStop(0.35, '#9fe8ff'); g.addColorStop(0.7, '#d9ff8a'); g.addColorStop(1, '#ffffff')
  return g
}
/* lines: [{ text, style: 'fill'|'outline'|'iri' }] fitted to box width, capped by box height */
function block(ctx, w, h, box, lines, { gap = 0.06, align = 'left' } = {}) {
  const bx = box.x * w, by = box.y * h, bw = box.w * w, bh = box.h * h
  const base = 100
  const metrics = lines.map((l) => {
    ctx.font = `700 ${base}px Oswald`
    const m = ctx.measureText(l.text)
    return { w: m.width, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent }
  })
  let sizes = metrics.map((m) => (bw / m.w) * base * (lines[0].scale || 1))
  const heights = () => sizes.reduce((a, s, i) => a + ((metrics[i].asc) / base) * s, 0) + gap * bh * (lines.length - 1)
  const hh = heights(); if (hh > bh) { const f = (bh - gap * bh * (lines.length - 1)) / (hh - gap * bh * (lines.length - 1)); sizes = sizes.map((s) => s * f) }
  let y = by + Math.max(0, (bh - heights()) / 2)
  const rows = []
  lines.forEach((l, i) => {
    const s = sizes[i]; ctx.font = `700 ${s}px Oswald`
    const tw = metrics[i].w * s / base, asc = metrics[i].asc * s / base
    const x = align === 'right' ? bx + bw - tw : align === 'center' ? bx + (bw - tw) / 2 : bx
    y += asc
    if (l.style === 'outline') { ctx.lineWidth = Math.max(2, s * 0.012); ctx.strokeStyle = INK; ctx.strokeText(l.text, x, y) }
    else { ctx.fillStyle = l.style === 'iri' ? iri(ctx, x, y - asc, tw, asc) : INK; ctx.fillText(l.text, x, y) }
    rows.push({ x, y, s, tw, asc })
    y += gap * bh
  })
  return rows
}
function label(ctx, text, x, y, size, color = 'rgba(236,235,230,.55)') {
  ctx.font = `600 ${size}px Manrope`; ctx.fillStyle = color; ctx.fillText(text, x, y)
}

export const chapters = [
  { id: 'home', name: 'Главная' },
  { id: 'services', name: 'Услуги' },
  { id: 'works', name: 'Работы' },
  { id: 'process', name: 'Процесс' },
  { id: 'reviews', name: 'Отзывы' },
  { id: 'about', name: 'Обо мне' },
  { id: 'contact', name: 'Контакт' },
]

/* широкие/невысокие экраны (ноутбуки 1366×768): постер чуть ниже, чтобы не наезжать на текст */
const sq = (w, h, m, box) => (!m && w / h > 1.7 ? { ...box, h: box.h * 0.86, y: box.y + 0.025 } : box)
const fsz = (w, m, k = 1) => Math.max(12, w * (m ? 0.03 : 0.011) * k)

function ambientGlow(ctx, w, h, color1, color2, cx = 0.5, cy = 0.4) {
  const g = ctx.createRadialGradient(w * cx, h * cy, 0, w * cx, h * cy, Math.max(w, h) * 0.75)
  g.addColorStop(0, color1)
  g.addColorStop(0.5, color2)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

export const posterMap = {
  home: (ctx, w, h, m) => {
    bg(ctx, w, h)
    if (m) {
      ambientGlow(ctx, w, h, 'rgba(255, 154, 213, 0.22)', 'rgba(159, 232, 255, 0.08)', 0.7, 0.3)
      return
    }
    const r = block(ctx, w, h, m ? { x: 0.06, y: 0.17, w: 0.88, h: 0.36 } : sq(w, h, m, { x: 0.04, y: 0.15, w: 0.92, h: 0.52 }),
      [{ text: 'ДЕЛАЮ', style: 'fill' }, { text: 'ЖИВОЕ', style: 'iri' }], { gap: 0.085 })
    const fs = fsz(w, m)
    label(ctx, '(01) — digital studio of one', r[0].x + 4, r[0].y - r[0].asc - fs * 0.9, fs)
  },
  services: (ctx, w, h, m) => {
    bg(ctx, w, h)
    if (m) {
      ambientGlow(ctx, w, h, 'rgba(159, 232, 255, 0.24)', 'rgba(70, 130, 200, 0.08)', 0.25, 0.75)
      return
    }
    const r = block(ctx, w, h, m ? { x: 0.06, y: 0.11, w: 0.88, h: 0.2 } : { x: 0.04, y: 0.14, w: 0.52, h: 0.72 },
      [{ text: 'САЙТЫ', style: 'fill' }, { text: 'БОТЫ', style: 'outline' }, { text: 'АВТОМАТИЗАЦИИ', style: 'fill' }], { gap: 0.025 })
    if (m) return
    const fs = fsz(w, m, 0.9)
    r.forEach((row, i) => { const x = row.x + row.tw + fs * 0.6; if (x + fs * 3 < w * 0.6) label(ctx, `(0${i + 1})`, x, row.y - row.asc + fs, fs) })
  },
  works: (ctx, w, h, m) => {
    bg(ctx, w, h)
    if (m) {
      ambientGlow(ctx, w, h, 'rgba(180, 130, 255, 0.25)', 'rgba(110, 70, 220, 0.09)', 0.5, 0.45)
      return
    }
    const r = block(ctx, w, h, m ? { x: 0.06, y: 0.11, w: 0.88, h: 0.17 } : { x: 0.04, y: 0.1, w: 0.92, h: 0.33 },
      [{ text: 'РАБОТЫ', style: 'outline' }])
    const fs = fsz(w, m)
    label(ctx, `(${String(projects.length).padStart(2, '0')}) — избранное`, r[0].x + 4, r[0].y + fs * 1.8, fs)
  },
  process: (ctx, w, h, m) => {
    bg(ctx, w, h)
    if (m) {
      ambientGlow(ctx, w, h, 'rgba(217, 255, 138, 0.22)', 'rgba(255, 190, 80, 0.08)', 0.75, 0.35)
      return
    }
    const r = block(ctx, w, h, m ? { x: 0.06, y: 0.12, w: 0.88, h: 0.2 } : sq(w, h, m, { x: 0.04, y: 0.11, w: 0.56, h: 0.32 }),
      [{ text: 'КАК Я', style: 'outline' }, { text: 'РАБОТАЮ', style: 'iri' }], { gap: 0.04 })
    const fs = fsz(w, m)
    label(ctx, '(04) — без сюрпризов', r[0].x + 4, r[0].y - r[0].asc - fs * 0.9, fs)
  },
  reviews: (ctx, w, h, m) => {
    bg(ctx, w, h)
    if (m) {
      ambientGlow(ctx, w, h, 'rgba(159, 232, 255, 0.20)', 'rgba(217, 255, 138, 0.08)', 0.45, 0.4)
      return
    }
    const r = block(ctx, w, h, m ? { x: 0.06, y: 0.12, w: 0.88, h: 0.22 } : sq(w, h, m, { x: 0.04, y: 0.12, w: 0.58, h: 0.4 }),
      [{ text: 'ГОВОРЯТ', style: 'fill' }, { text: 'КЛИЕНТЫ', style: 'outline' }], { gap: 0.04 })
    const fs = fsz(w, m)
    label(ctx, '(05) — не я, а они', r[0].x + 4, r[0].y - r[0].asc - fs * 0.9, fs)
  },
  about: (ctx, w, h, m) => {
    bg(ctx, w, h)
    if (m) {
      ambientGlow(ctx, w, h, 'rgba(235, 245, 255, 0.20)', 'rgba(160, 180, 210, 0.08)', 0.65, 0.4)
      return
    }
    const r = block(ctx, w, h, m ? { x: 0.06, y: 0.13, w: 0.88, h: 0.28 } : sq(w, h, m, { x: 0.04, y: 0.12, w: 0.62, h: 0.52 }),
      [{ text: 'ЭТО', style: 'outline' }, { text: profile.name.toUpperCase(), style: 'iri' }], { gap: 0.03 })
    const fs = fsz(w, m)
    label(ctx, '(06) — человек за кодом', r[0].x + 4, r[0].y - r[0].asc - fs * 0.9, fs)
  },
  contact: (ctx, w, h, m) => {
    bg(ctx, w, h)
    if (m) {
      ambientGlow(ctx, w, h, 'rgba(255, 154, 213, 0.25)', 'rgba(217, 255, 138, 0.10)', 0.5, 0.5)
      return
    }
    block(ctx, w, h, m ? { x: 0.06, y: 0.13, w: 0.88, h: 0.32 } : { x: 0.04, y: 0.11, w: 0.6, h: 0.46 },
      [{ text: 'НАПИШИ', style: 'fill' }, { text: 'МНЕ', style: 'iri' }], { gap: 0.03, align: 'left' })
  },
}
export const posters = chapters.map((c) => posterMap[c.id])
