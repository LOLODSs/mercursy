import { isMobile } from './mq.js'
/* Создаёт сцену: живая ртуть на WebGL (чистый WebGL, грузится отдельным чанком),
   а если WebGL нет / включён лёгкий режим — постер на canvas с CSS-каплями. */

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

/* Лёгкий режим: вместо 3D — постер главы на обычном canvas + три «капли ртути» из CSS.
   Всё движение — transform/opacity (видеокарта, без перерисовки страницы): капли перетекают на новое место
   при смене главы, большая тянется к курсору, клик — брызги. Постеры соседних глав готовятся в простое. */
// позиции капель по главам: [x vw, y vh, масштаб] для большой, средней и маленькой
const SPOTS = {
  home: [[62, 22, 1], [80, 60, 0.9], [90, 70, 1]],
  services: [[74, 14, 0.85], [58, 64, 1], [86, 52, 1]],
  works: [[84, 36, 0.75], [60, 40, 0.8], [94, 12, 1]],
  process: [[64, 10, 0.8], [82, 34, 1], [92, 18, 1]],
  reviews: [[72, 16, 0.9], [56, 42, 0.8], [88, 60, 1]],
  about: [[66, 30, 1.1], [84, 18, 0.9], [58, 70, 1]],
  contact: [[60, 26, 1.3], [80, 66, 1], [46, 72, 1]],
}
const SPOTS_M = {
  home: [[52, 12, 0.9], [14, 36, 0.8], [84, 40, 1]],
  services: [[60, 6, 0.75], [10, 30, 0.8], [86, 22, 1]],
  works: [[64, 4, 0.6], [14, 14, 0.7], [88, 16, 1]],
  process: [[58, 6, 0.7], [12, 24, 0.8], [86, 30, 1]],
  reviews: [[60, 8, 0.75], [14, 30, 0.7], [86, 36, 1]],
  about: [[56, 10, 0.85], [12, 34, 0.8], [86, 42, 1]],
  contact: [[50, 14, 1], [12, 46, 0.8], [84, 52, 1]],
}
class LiteStage {
  constructor(el) {
    this.el = el; this.fallback = true; this.lite = true
    el.classList.add('stage-static')
    this.cache = new Map(); this.cur = null
    this.wrap = document.createElement('div'); this.wrap.className = 'lite-posters'; el.appendChild(this.wrap)
    this.drops = document.createElement('div'); this.drops.className = 'static-drops'
    this.drops.innerHTML = '<div class="lq"><div class="lq-m"><i></i></div></div>'.repeat(3)
    el.appendChild(this.drops)
    this.lq = [...this.drops.children]; this.lm = this.lq[0].firstChild
    this.chapter = 'home'; this.mouse = { x: innerWidth / 2, y: innerHeight / 2 }
    let rt; this.resize = () => { clearTimeout(rt); rt = setTimeout(() => { this.cache.clear(); if (this.draw) this.show(this.draw, true); this.place() }, 150) }
    addEventListener('resize', this.resize)
    this.place()
  }
  scale() { return Math.min(devicePixelRatio || 1, 1.5) }
  canvasFor(fn) {
    let c = this.cache.get(fn)
    if (!c) {
      const ts = this.scale(); c = document.createElement('canvas')
      c.width = Math.round(innerWidth * ts); c.height = Math.round(innerHeight * ts)
      fn(c.getContext('2d'), c.width, c.height, isMobile()); this.cache.set(fn, c)
    }
    return c
  }
  show(fn, instant) {
    const c = this.canvasFor(fn), old = this.cur
    if (c === old) return
    this.cur = c; this.wrap.appendChild(c)
    // держим в кеше только текущий постер и соседей (prefetch); остальные выкидываем
    for (const [k, v] of this.cache) if (v !== c && v !== old && !this.keep?.includes(k)) this.cache.delete(k)
    if (instant || !old) { old?.remove(); return }
    c.animate([{ opacity: 0, transform: 'scale(1.04)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' })
      .onfinish = () => { if (this.cur !== old) old.remove() }
  }
  place() {
    const S = (isMobile() ? SPOTS_M : SPOTS)[this.chapter] || SPOTS.home
    this.lq.forEach((d, i) => { const [x, y, k] = S[i]; d.style.transform = `translate3d(${x}vw,${y}vh,0) scale(${k})` })
  }
  setPoster(fn) { this.draw = fn; this.show(fn, true); this.place() }
  transitionTo(fn, id) {
    this.draw = fn; this.chapter = id || this.chapter; this.el.dataset.ch = this.chapter
    this.place(); this.show(fn)
  }
  prefetch(fns) {
    this.keep = fns.filter(Boolean)
    const ric = window.requestIdleCallback || ((f) => setTimeout(f, 200))
    const next = () => { const f = this.keep.find((k) => !this.cache.has(k)); if (f) this.idle = ric(() => { if (this.keep?.includes(f)) this.canvasFor(f); next() }) }
    next()
  }
  setMouse(x, y) {
    this.mouse = { x, y }
    if (this.mr) return
    this.mr = requestAnimationFrame(() => {
      this.mr = 0
      const r = this.lq[0].getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2
      const dx = this.mouse.x - cx, dy = this.mouse.y - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, 260 / d) * 0.12
      this.lm.style.transform = `translate3d(${dx * k}px,${dy * k}px,0)`
    })
  }
  splash(power = 5) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const n = Math.round(4 + power), { x, y } = this.mouse
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i'); s.className = 'lq-spl'
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 14 * power, sz = 6 + Math.random() * 14
      s.style.cssText = `left:${x - sz / 2}px;top:${y - sz / 2}px;width:${sz}px;height:${sz}px`
      this.drops.appendChild(s)
      s.animate([{ transform: 'translate3d(0,0,0) scale(.4)', opacity: 1 },
        { transform: `translate3d(${Math.cos(a) * v}px,${Math.sin(a) * v - 30}px,0) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate3d(${Math.cos(a) * v * 1.3}px,${Math.sin(a) * v + 60}px,0) scale(.2)`, opacity: 0 }],
      { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => s.remove()
    }
  }
  destroy() {
    removeEventListener('resize', this.resize); cancelAnimationFrame(this.mr); window.cancelIdleCallback?.(this.idle)
    this.cache.clear(); this.el.innerHTML = ''; this.el.classList.remove('stage-static'); delete this.el.dataset.ch
  }
}

export const hasGL = hasWebGL
export async function createStage(el, { lite = false } = {}) {
  // ?static в адресе — принудительно лёгкий режим (для проверки)
  const forceStatic = lite || /[?&]static\b/.test(location.search)
  if (hasWebGL() && !forceStatic) {
    try {
      const { Liquid } = await import('./liquid.js')
      return new Liquid(el)
    } catch (e) { console.warn('WebGL не завёлся, включаю статичный режим', e); el.innerHTML = '' }
  }
  return new LiteStage(el)
}
