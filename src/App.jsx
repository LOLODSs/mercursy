import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { createStage, hasGL } from './stage.js'
import { posters, chapters } from './posters.js'
import { profile, services, projects, process, pricing, reviews, site } from './config.js'
import Mascot from './Mascot.jsx'
import Demo from './demos/index.jsx'
import { useFocusTrap } from './a11y.js'
import { isMobile } from './mq.js'

const IDS = chapters.map((c) => c.id)
const slugOf = (p, i) => p.slug || `slot-${i + 1}`
const parseHash = () => {
  const [ch, sl] = decodeURIComponent(location.hash.slice(1)).split('/')
  return { i: Math.max(0, IDS.indexOf(ch)), slug: sl || null }
}
const Badge = ({ on }) => (on && site.showDemoBadges ? <span className="demo-badge" title="Пример — замени на свой">демо</span> : null)

const Drip = ({ text, delay = 0, className = '' }) => {
  if (!text) return null
  const words = text.split(' ')
  const long = text.length > 40
  let n = 0
  return (
    <span className={`drip ${className}`} aria-label={text}>
      {words.map((w, wi) => (
        <span key={wi} className="drip-w" aria-hidden="true">
          {long
            ? <span style={{ animationDelay: `${delay + wi * 45}ms` }}>{w}</span>
            : [...w].map((c, i) => <span key={i} style={{ animationDelay: `${delay + (n++) * 22}ms` }}>{c}</span>)}
          {wi < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
}

/* Узкие экраны: видимые основные разделы + явное раскрытие остальных. */
function ChapterNav({ chapter, go, blocked }) {
  const [expanded, setExpanded] = useState(false)
  const root = useRef(null), more = useRef(null), extra = useRef(null)
  const close = (restore = false) => { setExpanded(false); if (restore) more.current?.focus({ preventScroll: true }) }
  useEffect(() => { setExpanded(false) }, [chapter, blocked])
  useEffect(() => {
    const mq = matchMedia('(max-width:639px)')
    const resize = () => { if (!mq.matches) setExpanded(false) }
    mq.addEventListener('change', resize)
    return () => mq.removeEventListener('change', resize)
  }, [])
  useLayoutEffect(() => {
    if (!expanded) return
    const frame = requestAnimationFrame(() => extra.current?.querySelector('button')?.focus({ preventScroll: true }))
    const outside = e => { if (!root.current?.contains(e.target)) setExpanded(false) }
    const escape = e => { if (e.key === 'Escape') { e.preventDefault(); close(true) } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [expanded])
  const choose = i => { setExpanded(false); go(i, { queue: true }); if (i >= 3) requestAnimationFrame(() => more.current?.focus({ preventScroll: true })) }
  return <nav ref={root} className="nav" aria-label="Разделы">
    {chapters.map((c,i) => <button key={c.id} className={`${chapter === i ? 'on' : ''} ${i >= 3 ? 'nav-secondary' : ''}`} onClick={() => choose(i)} aria-current={chapter === i ? 'step' : undefined}>
      <i aria-hidden="true">0{i + 1}</i><span>{c.name}</span>
    </button>)}
    <button ref={more} className={`nav-more ${chapter >= 3 ? 'on' : ''}`} aria-expanded={expanded} aria-controls="nav-extra" aria-label={chapter >= 3 ? `Ещё разделы. Текущий: ${chapters[chapter].name}` : 'Ещё разделы'} onClick={() => setExpanded(v => !v)}>
      <span>{chapter >= 3 ? chapters[chapter].name : 'Ещё'}</span><svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10"><path d={expanded ? 'm2 3 3 3 3-3' : 'm2 6 3-3 3 3'} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    {expanded && <div ref={extra} className="nav-extra" id="nav-extra" aria-label="Дополнительные разделы">
      {chapters.slice(3).map((c,j) => <button key={c.id} className={chapter === j+3 ? 'on' : ''} aria-current={chapter === j+3 ? 'step' : undefined} onClick={() => choose(j+3)}>{c.name}</button>)}
    </div>}
  </nav>
}

export default function App() {
  const stage = useRef(null)
  const liquid = useRef(null)
  const start = useRef(parseHash())
  const [ready, setReady] = useState(false)
  const [loadPct, setLoadPct] = useState(0)
  const [chapter, setChapter] = useState(start.current.i)
  const [shown, setShown] = useState(start.current.i)
  const [leaving, setLeaving] = useState(false)
  const [openCase, setOpenCase] = useState(null)
  const [chat, setChat] = useState({ open: false, prefill: null })
  const lock = useRef(false)
  const chRef = useRef(start.current.i)
  const overlay = !!openCase
  // тумблер 3D: выбор запоминаем; без WebGL или при «экономии трафика» по умолчанию лёгкий режим
  const canGL = useRef(hasGL()).current
  const [fx, setFx] = useState(() => {
    const v = localStorage.getItem('vg-3d')
    return canGL && !/[?&]static\b/.test(location.search) && (v ? v === 'on' : !navigator.connection?.saveData)
  })
  const [slowAsk, setSlowAsk] = useState(false)
  const fxBusy = useRef(false)
  const bindStage = (st) => {
    liquid.current = st
    if (/[?&]debug\b/.test(location.search)) window.__stage = st // для проверки: __stage.quality, __stage.onSlow()
    document.documentElement.classList.toggle('static-mode', !!st.fallback)
    st.onSlow = () => { if (!sessionStorage.getItem('vg-slow')) setSlowAsk(true) }
    st.chapter = IDS[chRef.current]; st.setPoster(posters[chRef.current]); st.prefetch?.([posters[chRef.current + 1], posters[chRef.current - 1]])
  }
  const toggleFx = async (on = !fx) => {
    if (fxBusy.current || !liquid.current || (on && !canGL)) return
    if (lock.current) { setTimeout(() => toggleFx(on), 300); return } // дождёмся конца перехода главы
    fxBusy.current = true; setSlowAsk(false)
    localStorage.setItem('vg-3d', on ? 'on' : 'off'); setFx(on)
    liquid.current.destroy(); liquid.current = null
    try { bindStage(await createStage(stage.current, { lite: !on })) } finally { fxBusy.current = false }
  }

  /* boot: шрифты + сцена (шейдер грузится отдельным чанком) */
  useEffect(() => {
    let pct = 0, done = false
    const iv = setInterval(() => { pct = Math.min(done ? 100 : 92, pct + 4 + Math.random() * 10); setLoadPct(Math.floor(pct)); if (pct >= 100) clearInterval(iv) }, 50)
    if (site.customCursor) document.documentElement.classList.add('has-cursor')
    const fonts = Promise.all([document.fonts.load('700 100px Oswald', 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ ABC'), document.fonts.load('600 20px Manrope', 'Аб Ab')])
    Promise.all([fonts, createStage(stage.current, { lite: !fx }), new Promise((r) => setTimeout(r, 450))]).then(([, st]) => {
      bindStage(st)
      done = true; pct = 100; setLoadPct(100)
      setTimeout(() => {
        setReady(true)
        const sl = start.current.slug
        if (sl) { const i = projects.findIndex((p, k) => slugOf(p, k) === sl); if (i >= 0) setOpenCase({ ...projects[i], idx: i, ox: innerWidth / 2, oy: innerHeight / 2 }) }
      }, 200)
    })
    return () => { clearInterval(iv); liquid.current?.destroy() }
  }, [])

  /* под открытым кейсом ртуть не видна — останавливаем рендер (после анимации раскрытия) */
  useEffect(() => {
    const l = liquid.current; if (!l?.pause) return
    // на телефоне чат-бриф раскрывается на весь экран — там ртуть тоже не видна
    const covered = openCase || (chat.open && isMobile())
    if (!covered) { l.resume(); return }
    const t = setTimeout(() => l.pause(), openCase ? 1100 : 500)
    return () => clearTimeout(t)
  }, [openCase, chat.open, ready, fx])

  const pending = useRef(null)
  const go = useCallback((i, { fromHash, queue } = {}) => {
    i = Math.max(0, Math.min(chapters.length - 1, i))
    if (!liquid.current) return
    // клик по меню / смена адреса во время анимации — выполним сразу после неё
    if (lock.current) { if (queue || fromHash) pending.current = i; return }
    if (i === chRef.current) { if (!fromHash) history.replaceState(history.state, '', `#${IDS[i]}`); return }
    lock.current = true; chRef.current = i
    setChapter(i); setLeaving(true)
    if (!fromHash) history.replaceState(null, '', `#${IDS[i]}`)
    liquid.current.transitionTo(posters[i], IDS[i])
    liquid.current.prefetch?.([posters[i + 1], posters[i - 1]]) // соседей нарисуем заранее, в простое
    setTimeout(() => { setShown(i); setLeaving(false) }, 650)
    setTimeout(() => {
      lock.current = false
      const q = pending.current; pending.current = null
      if (q != null && q !== chRef.current) go(q, { queue: true })
    }, 1400)
  }, [])

  /* ссылки вида #works и #works/barber-bot, кнопка «назад» */
  useEffect(() => {
    const sync = () => {
      const { i, slug } = parseHash()
      if (!slug) setOpenCase(null)
      else { const k = projects.findIndex((p, n) => slugOf(p, n) === slug); if (k >= 0) setOpenCase((c) => c?.idx === k ? c : { ...projects[k], idx: k, ox: innerWidth / 2, oy: innerHeight / 2 }) }
      go(i, { fromHash: true })
    }
    addEventListener('popstate', sync)
    addEventListener('hashchange', sync)
    return () => { removeEventListener('popstate', sync); removeEventListener('hashchange', sync) }
  }, [go])

  const showCase = (c) => { history.pushState({ case: 1 }, '', `#works/${slugOf(c, c.idx)}`); setOpenCase(c) }
  const closeCase = () => { if (history.state?.case) history.back(); else { history.replaceState(null, '', `#${IDS[chRef.current]}`); setOpenCase(null) } }
  const openChat = (prefill = null) => { if (openCase) closeCase(); setChat({ open: true, prefill }) }
  const openType = (type) => { const q = type.toLowerCase(); const i = projects.findIndex((p) => p.title && (p.type === type || p.type?.toLowerCase().includes(q))); if (i >= 0) showCase({ ...projects[i], idx: i, ox: innerWidth / 2, oy: innerHeight / 2 }) }

  /* input */
  useEffect(() => {
    const busy = (e) => overlay || chat.open || e.target.closest?.('input,textarea,select,.chat,.case')
    let acc = 0, accT = 0
    const onWheel = (e) => {
      if (busy(e) || isMobile()) return // Native chapter scrolling; use the labelled navigation to change chapters.
      const hs = e.target.closest?.('.hscroll')
      if (hs) {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
        const maxScroll = hs.scrollWidth - hs.clientWidth
        if (maxScroll > 10) {
          const atStart = hs.scrollLeft <= 5 && e.deltaY < 0
          const atEnd = hs.scrollLeft >= maxScroll - 5 && e.deltaY > 0
          if (!atStart && !atEnd) {
            if (!hs.classList.contains('reel')) hs.scrollLeft += e.deltaY
            return
          }
        }
      }
      const now = performance.now(); if (now - accT > 220) acc = 0; accT = now
      acc += e.deltaY
      if (Math.abs(acc) > 60) { go(chRef.current + Math.sign(acc)); acc = 0 }
    }
    let ty = null, tx = null
    const onTouchStart = (e) => {
      ty = e.touches[0].clientY; tx = e.touches[0].clientX
      liquid.current?.setMouse(tx, ty)
    }
    const onTouchMove = (e) => {
      if (e.touches?.[0]) liquid.current?.setMouse(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onTouchEnd = (e) => {
      liquid.current?.setMouseActive?.(false)
      if (ty == null || busy(e) || isMobile()) { ty = null; return }
      const dy = ty - e.changedTouches[0].clientY, dx = tx - e.changedTouches[0].clientX
      if (Math.abs(dy) > 55 && Math.abs(dy) > Math.abs(dx) * 1.3) go(chRef.current + Math.sign(dy))
      ty = null
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { if (openCase) closeCase(); else if (chat.open) setChat((c) => ({ ...c, open: false })) }
      if (busy(e) || isMobile()) return
      if (e.key === ' ' && e.target.closest?.('button,a,[role=button]')) return
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(chRef.current + 1) }
      if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); go(chRef.current - 1) }
    }
    const onMove = (e) => liquid.current?.setMouse(e.clientX, e.clientY)
    addEventListener('wheel', onWheel, { passive: true })
    addEventListener('touchstart', onTouchStart, { passive: true })
    addEventListener('touchmove', onTouchMove, { passive: true })
    addEventListener('touchend', onTouchEnd)
    addEventListener('keydown', onKey)
    addEventListener('pointermove', onMove)
    return () => { removeEventListener('wheel', onWheel); removeEventListener('touchstart', onTouchStart); removeEventListener('touchmove', onTouchMove); removeEventListener('touchend', onTouchEnd); removeEventListener('keydown', onKey); removeEventListener('pointermove', onMove) }
  }, [go, openCase, chat.open, overlay])

  useEffect(() => {
    if (!chat.open) return
    const viewport = window.visualViewport
    const update = () => {
      document.documentElement.style.setProperty('--visual-height', `${viewport?.height || innerHeight}px`)
      document.documentElement.style.setProperty('--visual-top', `${viewport?.offsetTop || 0}px`)
      document.documentElement.style.setProperty('--visual-left', `${viewport?.offsetLeft || 0}px`)
      document.documentElement.style.setProperty('--visual-width', `${viewport?.width || innerWidth}px`)
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      for (const name of ['height', 'top', 'left', 'width']) document.documentElement.style.removeProperty(`--visual-${name}`)
    }
  }, [chat.open])

  const splash = (e) => { if (!e.target.closest('a,button,.reel,.case,.chat,.hscroll,input')) { const l = liquid.current; if (l?.lite) l.setMouse(e.clientX, e.clientY); l?.splash(6) } }
  const id = IDS[shown]

  return (
    <div className={`app ${ready ? 'ready' : ''} ${openCase ? 'case-open' : ''} ${chat.open ? 'chat-open' : ''}`} onPointerDown={splash}>
      <div className="stage" ref={stage} aria-hidden="true" />
      <Loader pct={loadPct} done={ready} />

      <header className="top" inert={overlay || chat.open}>
        <button className="logo" onClick={() => go(0, { queue: true })}><span className="logo-drop" />{profile.name}</button>
        {profile.availability && <span className="avail"><i />{profile.availability}</span>}
        <ChapterNav chapter={chapter} go={go} blocked={overlay || chat.open} />
        <button className={`fx-toggle ${fx ? 'on' : ''}`} role="switch" aria-checked={fx} disabled={!canGL} onClick={() => toggleFx()}
          title={!canGL ? '3D недоступно на этом устройстве' : fx ? 'Выключить 3D — если сайт тормозит' : 'Включить живую 3D-ртуть'}>
          <span className="fx-track"><span className="fx-knob" /></span>3D
        </button>
        <a className="top-cta" href={profile.telegram} target="_blank" rel="noreferrer" aria-label="Написать в Telegram">
          <span className="cta-label">Telegram</span>
          <span className="cta-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
              <path d="m21 3-7 18-4-7-7-4L21 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="m10 14 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </span>
        </a>
      </header>

      <div className="progress" aria-hidden="true"><span style={{ transform: `scaleY(${(chapter + 1) / chapters.length})` }} /></div>
      <div className="counter" aria-hidden="true"><b>0{chapter + 1}</b> / 0{chapters.length}</div>

      <main className={`chapter ch-${id} ${leaving ? 'leaving' : ''} ${ready ? '' : 'wait'}`} key={shown} tabIndex={0} aria-label={chapters[shown].name} inert={overlay || chat.open}>
        <ChapterHeading id={id} />
        {id === 'home' && <Home go={go} openChat={openChat} />}
        {id === 'services' && <Services openType={openType} />}
        {id === 'works' && <Works onOpen={showCase} covered={overlay} />}
        {id === 'process' && <Process openChat={openChat} />}
        {id === 'reviews' && <Reviews />}
        {id === 'about' && <About />}
        {id === 'contact' && <Contact openChat={openChat} />}
      </main>

      {chapter < chapters.length - 1 && IDS[chapter] !== 'works'  && <button className="next" onClick={() => go(chapter + 1)}><span>листай</span><i /></button>}
      {openCase && <Case data={openCase} onClose={closeCase}
        onNext={() => { const k = (openCase.idx + 1) % projects.length; const c = { ...projects[k], idx: k, ox: innerWidth / 2, oy: innerHeight / 2 }; history.replaceState(history.state, '', `#works/${slugOf(c, k)}`); setOpenCase(c) }}
        onContact={() => openChat({ type: openCase.type, ref: openCase.title || null })} />}
      {slowAsk && fx && (
        <div className="slow-ask" role="status">
          <span>Кажется, ртуть подтормаживает на&nbsp;этом устройстве.</span>
          <button className="btn chrome sm" onClick={() => toggleFx(false)}>Лёгкий режим</button>
          <button className="slow-x" aria-label="Оставить 3D" onClick={() => { sessionStorage.setItem('vg-slow', '1'); setSlowAsk(false) }}>×</button>
        </div>
      )}
      {ready && <Mascot open={chat.open} prefill={chat.prefill} setOpen={(o) => (o ? openChat(chat.prefill) : setChat({ open: false, prefill: null }))}
        chapterId={IDS[chapter]} onGoWorks={() => go(IDS.indexOf('works'))} />}
      {site.customCursor && <Cursor hidden={overlay} />}
    </div>
  )
}

// Unlike canvas lettering, this heading contributes its actual height to compact layout.
function ChapterHeading({ id }) {
  const headings = {
    home: ['(01) — digital studio of one', ['ДЕЛАЮ', 'ЖИВОЕ']],
    services: ['(02) — что делаю', ['САЙТЫ', 'БОТЫ', 'АВТОМАТИЗАЦИИ']],
    works: [`(${String(projects.length).padStart(2, '0')}) — избранное`, ['РАБОТЫ']],
    process: ['(04) — без сюрпризов', ['КАК Я', 'РАБОТАЮ']],
    reviews: ['(05) — не я, а они', ['ГОВОРЯТ', 'КЛИЕНТЫ']],
    about: ['(06) — человек за кодом', ['ЭТО', profile.name]],
    contact: ['(07) — давай обсудим', ['НАПИШИ', 'МНЕ']],
  }
  const [label, lines] = headings[id]
  const Heading = id === 'home' ? 'h1' : 'h2'
  return <div className={`compact-heading title-${id}`}>
    <p>{label}</p>
    <Heading>{lines.map((text, i) => <span key={text} className={
      (id === 'services' && i === 1) || id === 'works' || (id === 'process' && i === 0) || (id === 'reviews' && i === 1) || (id === 'about' && i === 0)
        ? 'outlined' : i === 1 && id !== 'services' ? 'iridescent' : ''
    }>{text}</span>)}</Heading>
    <div className="scene-slot" data-chapter={id} aria-hidden="true" />
  </div>
}

function Loader({ pct, done }) {
  // после ухода лоадер убираем из DOM: иначе его бесконечный блик перерисовывал бы страницу каждый кадр
  const [gone, setGone] = useState(false)
  useEffect(() => { if (!done) return; const t = setTimeout(() => setGone(true), 1300); return () => clearTimeout(t) }, [done])
  if (gone) return null
  return (
    <div className={`loader ${done ? 'gone' : ''}`}>
      <div className="loader-num">{String(pct).padStart(3, '0')}</div>
      <div className="loader-txt">разогреваю ртуть</div>
    </div>
  )
}

function Home({ go, openChat }) {
  return (
    <>
      <h1 className="sr">Делаю живое — {profile.name}: сайты, Telegram-боты и автоматизации</h1>
      <div className="home-foot">
        <p className="lead"><Drip text={profile.tagline} delay={150} /></p>
        <div className="row">
          <button className="btn chrome" onClick={() => go(IDS.indexOf('works'))}>Смотреть работы</button>
          <button className="btn line btn-discuss" onClick={() => openChat()}>Обсудить проект</button>
        </div>
      </div>
      <p className="touch-hint">Потрогай ртуть курсором.<br />Кликни — расплескаешь.</p>
    </>
  )
}

function Services({ openType }) {
  return (
    <>
      <h2 className="sr">Что делаю</h2>
      <div className="svc">
        {services.map((s, i) => (
          <article key={s.n} className="svc-item glass" style={{ animationDelay: `${120 + i * 120}ms` }}>
            <span className="svc-n">{s.n}</span>
            <h3><Drip text={s.title} delay={200 + i * 120} /></h3>
            <p>{s.text}</p>
            <div className="svc-foot"><b>{s.price}</b><button onClick={() => openType(['Сайт', 'Бот', 'Автоматизация'][i])}>Пример вживую →</button></div>
          </article>
        ))}
      </div>
    </>
  )
}

function Works({ onOpen, covered }) {
  const reel = useRef(null)
  // какие карточки сейчас видны в ленте — живые мини-демо крутятся только у них
  const [vis, setVis] = useState(() => new Set())
  useEffect(() => {
    if (!window.IntersectionObserver) { setVis(new Set(projects.map((_, i) => i))); return }
    const io = new IntersectionObserver((es) => setVis((v) => {
      const n = new Set(v); es.forEach((e) => (e.isIntersecting ? n.add(+e.target.dataset.i) : n.delete(+e.target.dataset.i))); return n
    }), { root: reel.current, rootMargin: '0px 120px' })
    reel.current.querySelectorAll('.card').forEach((c) => io.observe(c))
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    const el = reel.current
    if (!el) return

    let currentX = el.scrollLeft
    let targetX = el.scrollLeft
    let smoothRaf = 0
    let v = 0
    let lastRotY = 0, lastScale = 1, lastShift = 0

    const updateVisuals = (velocity) => {
      const rotY = Math.round(Math.max(-13, Math.min(13, -velocity * 0.35)) * 10) / 10
      const rotZ = Math.round(Math.max(-2, Math.min(2, -velocity * 0.05)) * 10) / 10
      const scale = Math.round(Math.max(0.96, 1 - Math.min(0.04, Math.abs(velocity) * 0.0014)) * 1000) / 1000
      const shift = Math.round(Math.max(-16, Math.min(16, velocity * 0.42)) * 10) / 10
      const lift = Math.round(Math.min(6, Math.abs(velocity) * 0.1) * 10) / 10

      if (rotY !== lastRotY || scale !== lastScale || shift !== lastShift) {
        lastRotY = rotY; lastScale = scale; lastShift = shift
        el.style.setProperty('--rot-y', `${rotY}deg`)
        el.style.setProperty('--rot-z', `${rotZ}deg`)
        el.style.setProperty('--card-scale', `${scale}`)
        el.style.setProperty('--media-shift', `${shift}px`)
        el.style.setProperty('--lift-y', `${-lift}px`)
      }
    }

    const startGlide = () => {
      if (smoothRaf) return
      const glide = () => {
        const maxScroll = el.scrollWidth - el.clientWidth
        targetX = Math.max(0, Math.min(maxScroll, targetX))
        const diff = targetX - currentX

        if (Math.abs(diff) > 0.3) {
          const step = diff * 0.095
          currentX += step
          el.scrollLeft = currentX
          v += (step - v) * 0.2
          updateVisuals(v)
          smoothRaf = requestAnimationFrame(glide)
        } else {
          currentX = targetX
          el.scrollLeft = targetX
          v *= 0.8
          if (Math.abs(v) > 0.04) {
            updateVisuals(v)
            smoothRaf = requestAnimationFrame(glide)
          } else {
            v = 0
            updateVisuals(0)
            smoothRaf = 0
          }
        }
      }
      smoothRaf = requestAnimationFrame(glide)
    }

    // Обработчик колесика мыши над каруселью — плавный lerp вместо дискретных скачков
    const onWheel = (e) => {
      const maxScroll = el.scrollWidth - el.clientWidth
      if (maxScroll <= 5) return

      const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * (e.deltaMode === 1 ? 33 : 1)
      const atStart = currentX <= 4 && delta < 0
      const atEnd = currentX >= maxScroll - 4 && delta > 0

      if (atStart || atEnd) return

      e.preventDefault()
      e.stopPropagation()

      targetX = Math.max(0, Math.min(maxScroll, targetX + delta * 1.15))
      startGlide()
    }

    // Drag мышкой с плавной инерцией
    let down = null, trackX = 0, trackT = 0, dragVel = 0
    const pd = (e) => {
      if (e.pointerType !== 'mouse') return
      cancelAnimationFrame(smoothRaf)
      smoothRaf = 0
      currentX = el.scrollLeft
      targetX = el.scrollLeft
      trackX = e.clientX; trackT = performance.now(); dragVel = 0
      down = { x: e.clientX, s: el.scrollLeft, moved: false }
    }
    const pm = (e) => {
      if (!down) return
      const now = performance.now(), dt = Math.max(1, now - trackT)
      const stepDx = e.clientX - trackX
      dragVel = dragVel * 0.6 + (stepDx / dt) * 0.4
      trackX = e.clientX; trackT = now

      const dx = e.clientX - down.x
      if (Math.abs(dx) > 5) down.moved = true

      const maxScroll = el.scrollWidth - el.clientWidth
      currentX = Math.max(0, Math.min(maxScroll, down.s - dx))
      targetX = currentX
      el.scrollLeft = currentX

      v = v * 0.7 - stepDx * 0.35
      updateVisuals(v)
    }
    const pu = () => {
      if (down?.moved) {
        el.dataset.dragged = '1'
        setTimeout(() => delete el.dataset.dragged, 60)

        if (Math.abs(dragVel) > 0.18) {
          const maxScroll = el.scrollWidth - el.clientWidth
          const coast = -dragVel * 240
          targetX = Math.max(0, Math.min(maxScroll, currentX + coast))
          startGlide()
        } else {
          startGlide()
        }
      }
      down = null
    }

    let nativeLast = el.scrollLeft
    const onScroll = () => {
      if (isMobile()) return
      if (!smoothRaf && !down) {
        const d = el.scrollLeft - nativeLast
        nativeLast = el.scrollLeft
        currentX = targetX = el.scrollLeft
        v += (d - v) * 0.2
        updateVisuals(v)
      } else {
        nativeLast = el.scrollLeft
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('pointerdown', pd)
    addEventListener('pointermove', pm)
    addEventListener('pointerup', pu)
    addEventListener('pointercancel', pu)

    return () => {
      cancelAnimationFrame(smoothRaf)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('pointerdown', pd)
      removeEventListener('pointermove', pm)
      removeEventListener('pointerup', pu)
      removeEventListener('pointercancel', pu)
    }
  }, [])
  return (
    <>
      <h2 className="sr">Работы</h2>
      <div className="reel hscroll" ref={reel} data-cursor="тяни">
        {projects.map((p, i) => {
          const empty = !p.title
          return (
            <div key={i} data-i={i} className={`card ${empty ? 'empty' : ''}`} style={{ animationDelay: `${i * 70}ms` }} role="button" tabIndex={0}
              aria-label={empty ? `Свободный слот ${i + 1}` : `Открыть кейс ${p.title}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpen({ ...p, idx: i, ox: innerWidth / 2, oy: innerHeight / 2 }) } }}
              onClick={(e) => { if (reel.current.dataset.dragged) return; onOpen({ ...p, idx: i, ox: e.clientX, oy: e.clientY }) }}
              data-cursor={empty ? 'слот' : (p.demo || p.iframe) ? 'потыкать' : 'открыть'}>
              <div className={`card-media ${(p.demo || p.iframe || p.video) ? 'is-demo' : ''} ${p.demo && (covered || !vis.has(i)) ? 'paused' : ''}`}>
                {isMobile() ? (
                  <img src={p.image || p.cover} alt={p.title || ''} draggable="false" loading="lazy" />
                ) : p.demo ? (
                  <Demo kind={p.demo} mini paused={covered || !vis.has(i)} />
                ) : p.video ? (
                  <video src={p.video} poster={p.image || p.cover} autoPlay muted loop playsInline />
                ) : (
                  <img src={p.image || p.cover} alt={p.title || ''} draggable="false" loading="lazy" />
                )}
                {(p.demo || p.iframe || p.video) && (
                  <span className="live-chip"><i />{p.chipLabel || (p.type === '3D-сайт' ? '3D проект' : p.iframe ? 'живой сайт' : p.video ? 'видео' : 'интерактив')}</span>
                )}
              </div>
              <div className="card-meta">
                <span>{String(i + 1).padStart(2, '0')} <Badge on={p.isDemo} /></span>
                <span>{p.type}{p.year ? ` · ${p.year}` : ''}</span>
              </div>
              <h3>{empty ? 'Свободный слот' : p.title}</h3>
              <p>{empty ? 'Здесь может быть твой проект.' : p.desc}</p>
            </div>
          )
        })}
        <div className="reel-end">← тяни / листай вбок →</div>
      </div>
    </>
  )
}

function Case({ data, onClose, onContact, onNext }) {
  const ref = useRef(null)
  const isMob = isMobile()
  const isInteractive = Boolean(data.iframe || data.demo)
  const [fullscreenInteractive, setFullscreenInteractive] = useState(isMob && isInteractive)

  useFocusTrap(ref, true, fullscreenInteractive ? () => setFullscreenInteractive(false) : onClose)

  useEffect(() => {
    ref.current?.scrollTo({ top: 0, behavior: 'instant' })
    const info = ref.current?.querySelector('.case-info')
    info?.scrollTo({ top: 0, behavior: 'instant' })
    setFullscreenInteractive(isMobile() && Boolean(data.iframe || data.demo))
  }, [data.idx])

  const empty = !data.title
  return (
    <div ref={ref} className={`case ${data.demo ? 'has-demo' : ''} ${data.iframe ? 'has-iframe' : ''} ${fullscreenInteractive && isMob && isInteractive ? 'is-fullscreen-interactive' : ''}`} role="dialog" aria-modal="true" aria-label={empty ? 'Свободный слот' : data.title} style={{ '--ox': `${data.ox}px`, '--oy': `${data.oy}px` }} key={data.idx}>
      <button className="case-close" onClick={onClose} aria-label="Закрыть"><svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg></button>
      <div className={`case-media ${data.demo ? `demo-${data.demo}` : ''} ${data.iframe ? 'is-iframe' : ''}`}>
        {isMob && isInteractive && fullscreenInteractive && (
          <div className="interactive-exit-bar">
            <button
              type="button"
              className="interactive-exit-btn"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setFullscreenInteractive(false)
              }}
              aria-label="Выйти из интерактива"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
              <span>Выйти из интерактива</span>
            </button>
          </div>
        )}
        {data.iframe ? (
          isMob && !fullscreenInteractive ? (
            <div className="case-iframe-preview">
              <img src={data.image || data.cover} alt={data.title} />
              <button type="button" className="btn chrome case-launch-btn" onClick={() => setFullscreenInteractive(true)}>
                <span>▶ Открыть 3D на весь экран</span>
              </button>
              <span className="case-try">Нажмите, чтобы развернуть интерактив на весь экран</span>
            </div>
          ) : (
            <>
              <iframe
                src={data.iframe}
                title={data.title}
                className="case-iframe"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              />
              {!isMob && <span className="case-try">{data.tryLabel || 'Интерактивный проект — покрути и потыкай ↓'}</span>}
            </>
          )
        ) : data.demo ? (
          isMob && !fullscreenInteractive ? (
            <div className="case-iframe-preview">
              <img src={data.image || data.cover} alt={data.title} />
              <button type="button" className="btn chrome case-launch-btn" onClick={() => setFullscreenInteractive(true)}>
                <span>▶ Запустить интерактив на весь экран</span>
              </button>
              <span className="case-try">Нажмите, чтобы протестировать интерактив на весь экран</span>
            </div>
          ) : (
            <>
              <Demo kind={data.demo} />
              {!isMob && <span className="case-try">{data.tryLabel || 'Интерактивный проект — потыкай ↓'}</span>}
            </>
          )
        ) : data.video ? (
          <video src={data.video} poster={data.image || data.cover} autoPlay muted loop playsInline controls />
        ) : (
          <img src={data.image || data.cover} alt="" />
        )}
      </div>
      <div className="case-info">
        <div className="case-meta"><span>{String(data.idx + 1).padStart(2, '0')}</span><span>{data.type}</span>{data.year && <span>{data.year}</span>}<Badge on={data.isDemo} /></div>
        <h2><Drip text={empty ? 'Этот слот ждёт' : data.title} delay={350} /></h2>
        <p className="case-desc">{empty ? 'Я держу это место под следующий громкий проект. Возможно — под твой. Расскажи задачу, и уже через несколько дней здесь будет кейс.' : data.desc}</p>
        {!empty && (data.task || data.solution || data.result) && (
          <dl className="case-tsr">
            {data.task && <div><dt>Задача</dt><dd>{data.task}</dd></div>}
            {data.solution && <div><dt>Решение</dt><dd>{data.solution}</dd></div>}
            {data.result && <div><dt>Результат</dt><dd>{data.result}</dd></div>}
          </dl>
        )}
        {!empty && data.metrics && <div className="case-metrics">{data.metrics.map(([n, l]) => <div key={l}><b>{n}</b><span>{l}</span></div>)}</div>}
        {!empty && data.tags && <div className="tags">{data.tags.map((t) => <span key={t}>{t}</span>)}</div>}
        <div className="row">
          {!empty && data.link && <a className="btn chrome" href={data.link} target="_blank" rel="noreferrer">{data.linkLabel || 'Открыть проект ↗'}</a>}
          <button className={`btn ${empty || !data.link ? 'chrome' : 'line'}`} onClick={onContact}>{empty ? 'Занять слот' : 'Хочу так же'}</button>
          <button className="btn line" onClick={onNext}>Следующий →</button>
        </div>
      </div>
    </div>
  )
}

function Process({ openChat }) {
  return (
    <>
      <h2 className="sr">Как я работаю</h2>
      <div className="proc">
        <ol className="proc-steps hscroll">
          {process.map((s, i) => (
            <li key={s.n} className="glass" style={{ animationDelay: `${120 + i * 110}ms` }}>
              <div className="proc-top"><span>{s.n}</span><em>{s.time}</em></div>
              <h3>{s.title}</h3><p>{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="proc-bottom">
          <div className="prices">
            {pricing.map((p, i) => (
              <div key={p.title} className="price" style={{ animationDelay: `${520 + i * 90}ms` }}>
                <span>{p.title}</span><b>{p.price}</b><small>{p.time}</small>
              </div>
            ))}
          </div>
          <button className="btn chrome" onClick={() => openChat()}>Пройти бриф за минуту</button>
        </div>
      </div>
    </>
  )
}

function Reviews() {
  return (
    <>
      <h2 className="sr">Отзывы</h2>
      <div className="revs hscroll">
        {reviews.map((r, i) => (
          <figure key={r.name} className="rev glass" style={{ animationDelay: `${150 + i * 120}ms` }}>
            <div className="rev-stars" aria-label={`Оценка ${r.rating || 5} из 5`}>{'★'.repeat(r.rating || 5)}</div>
            <span className="rev-q" aria-hidden="true">“</span>
            <blockquote>{r.text}</blockquote>
            <figcaption><span className="rev-ava">{r.name.split(' ').map((w) => w[0]).join('')}</span><div><b>{r.name}</b><small>{r.role}</small></div></figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}

function About() {
  return (
    <>
      <h2 className="sr">Обо мне</h2>
      <div className="about">
        <div className="about-lead">
          {profile.photo && <img className="about-photo" src={profile.photo} alt={profile.name} />}
          <p className="lead"><Drip text="Я соединяю дизайн, код и автоматизацию. Пишу сайты, которые хочется трогать, ботов, которые продают, и воркфлоу, которые убирают рутину навсегда." delay={150} /></p>
        </div>
        <div className="stats">
          {profile.stats.map(([n, l], i) => (
            <div key={l} className="stat" style={{ animationDelay: `${300 + i * 120}ms` }}><b>{n}</b><span>{l}</span></div>
          ))}
        </div>
        <div className="stack">{profile.stack.map((s) => <span key={s}>{s}</span>)}</div>
      </div>
    </>
  )
}

function Contact({ openChat }) {
  const links = [
    { k: 'Telegram', v: profile.telegramLabel, href: profile.telegram },
    { k: 'Email', v: profile.email, href: `mailto:${profile.email}` },
    profile.github ? { k: 'GitHub', v: profile.github.replace('https://', ''), href: profile.github } : null,
  ].filter(Boolean)
  return (
    <>
      <h2 className="sr">Контакт</h2>
      <div className="contact">
        <p className="lead"><Drip text="Есть идея, рутина или бизнес, которому нужен вау-эффект? Отвечаю в течение дня." delay={150} /></p>
        <div className="row">
          <button className="btn chrome big" onClick={() => openChat()}>Бриф за 1 минуту</button>
          <a className="btn line big btn-tg" href={profile.telegram} target="_blank" rel="noreferrer">
            <span>Telegram</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
              <path d="m21 3-7 18-4-7-7-4L21 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="m10 14 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </a>
        </div>
        <div className="links">
          {links.map((l, i) => <a key={l.k} href={l.href} {...(l.href.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noreferrer' })} style={{ animationDelay: `${300 + i * 90}ms` }}><span>{l.k}</span><b>{l.v}</b></a>)}
        </div>
      </div>
      <footer className="copy">© {new Date().getFullYear()} {profile.name}</footer>
    </>
  )
}

function Cursor({ hidden }) {
  const ref = useRef(null)
  const spanRef = useRef(null)

  useEffect(() => {
    if (hidden) {
      ref.current?.classList.add('hidden')
      if (spanRef.current) spanRef.current.textContent = ''
    }
  }, [hidden])

  useEffect(() => {
    let x = -100, y = -100, cx = x, cy = y, raf = 0
    const loop = () => {
      cx += (x - cx) * 0.25; cy += (y - cy) * 0.25
      if (Math.abs(x - cx) < 0.1 && Math.abs(y - cy) < 0.1) { cx = x; cy = y; raf = 0 } else raf = requestAnimationFrame(loop)
      if (ref.current) ref.current.style.transform = `translate(${cx}px,${cy}px)`
    }
    const updateTarget = (el) => {
      if (!el) return
      // Когда открыт кейс (особенно с 3D/iframe), чат или поле ввода — скрываем кастомный шарик
      if (hidden || el.closest?.('.case, .chat, iframe, input, textarea')) {
        ref.current?.classList.add('hidden')
        if (spanRef.current) spanRef.current.textContent = ''
        return
      }

      ref.current?.classList.remove('hidden')
      const t = el.closest?.('[data-cursor],a,button')
      const txt = el.closest?.('input,textarea,.chat')
      const label = t && !txt ? (t.dataset.cursor || '') : ''
      if (spanRef.current && spanRef.current.textContent !== label) spanRef.current.textContent = label
      ref.current?.classList.toggle('has-label', !!label)
      ref.current?.classList.toggle('hover', !!t && !txt)
      ref.current?.classList.toggle('text', !!txt)
    }

    const mv = (e) => {
      if (e.pointerType !== 'mouse') return
      x = e.clientX; y = e.clientY
      if (!raf) raf = requestAnimationFrame(loop)
      updateTarget(e.target)
    }

    const refresh = () => {
      if (x >= 0 && y >= 0) {
        requestAnimationFrame(() => {
          const el = document.elementFromPoint(x, y)
          if (el) updateTarget(el)
        })
      }
    }

    const onLeave = () => { ref.current?.classList.add('hidden') }
    const onBlur = () => { ref.current?.classList.add('hidden') }

    addEventListener('pointermove', mv)
    addEventListener('click', refresh)
    document.addEventListener('mouseleave', onLeave)
    window.addEventListener('blur', onBlur)
    return () => {
      removeEventListener('pointermove', mv)
      removeEventListener('click', refresh)
      document.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('blur', onBlur)
      cancelAnimationFrame(raf)
    }
  }, [hidden])

  return (
    <div className={`cursor ${hidden ? 'hidden' : ''}`} ref={ref} aria-hidden="true">
      <span ref={spanRef} />
    </div>
  )
}
