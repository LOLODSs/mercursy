import { useEffect, useRef, useState, useCallback } from 'react'
import { createStage, hasGL } from './stage.js'
import { posters, chapters } from './posters.js'
import { profile, services, projects, process, pricing, reviews, site } from './config.js'
import Mascot from './Mascot.jsx'
import Demo from './demos/index.jsx'
import { useFocusTrap } from './a11y.js'

const IDS = chapters.map((c) => c.id)
const slugOf = (p, i) => p.slug || `slot-${i + 1}`
const parseHash = () => {
  const [ch, sl] = decodeURIComponent(location.hash.slice(1)).split('/')
  return { i: Math.max(0, IDS.indexOf(ch)), slug: sl || null }
}
const Badge = ({ on }) => (on && site.showDemoBadges ? <span className="demo-badge" title="Пример — замени на свой">демо</span> : null)

const Drip = ({ text, delay = 0, className = '' }) => {
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
    const covered = openCase || (chat.open && matchMedia('(max-width: 760px)').matches)
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
      else { const k = projects.findIndex((p, n) => slugOf(p, n) === slug); if (k >= 0) setOpenCase((c) => c || { ...projects[k], idx: k, ox: innerWidth / 2, oy: innerHeight / 2 }) }
      go(i, { fromHash: true })
    }
    addEventListener('popstate', sync)
    return () => removeEventListener('popstate', sync)
  }, [go])

  const showCase = (c) => { history.pushState({ case: 1 }, '', `#works/${slugOf(c, c.idx)}`); setOpenCase(c) }
  const closeCase = () => { if (history.state?.case) history.back(); else { history.replaceState(null, '', `#${IDS[chRef.current]}`); setOpenCase(null) } }
  const openChat = (prefill = null) => { if (openCase) closeCase(); setChat({ open: true, prefill }) }
  const openType = (type) => { const i = projects.findIndex((p) => p.type === type && p.title); if (i >= 0) showCase({ ...projects[i], idx: i, ox: innerWidth / 2, oy: innerHeight / 2 }) }

  /* input */
  useEffect(() => {
    const busy = (e) => overlay || e.target.closest?.('input,textarea,.chat,.case')
    let acc = 0, accT = 0
    const onWheel = (e) => {
      if (busy(e)) return
      if (e.target.closest('.hscroll') && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      const now = performance.now(); if (now - accT > 220) acc = 0; accT = now
      acc += e.deltaY
      if (Math.abs(acc) > 60) { go(chRef.current + Math.sign(acc)); acc = 0 }
    }
    let ty = null, tx = null
    const onTouchStart = (e) => { ty = e.touches[0].clientY; tx = e.touches[0].clientX }
    const onTouchMove = (e) => { liquid.current?.setMouse(e.touches[0].clientX, e.touches[0].clientY) }
    const onTouchEnd = (e) => {
      if (ty == null || busy(e)) return
      const dy = ty - e.changedTouches[0].clientY, dx = tx - e.changedTouches[0].clientX
      if (Math.abs(dy) > 55 && Math.abs(dy) > Math.abs(dx) * 1.3) go(chRef.current + Math.sign(dy))
      ty = null
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { if (openCase) closeCase(); else if (chat.open) setChat((c) => ({ ...c, open: false })) }
      if (busy(e)) return
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

  const splash = (e) => { if (!e.target.closest('a,button,.reel,.case,.chat,.hscroll,input')) { const l = liquid.current; if (l?.lite) l.setMouse(e.clientX, e.clientY); l?.splash(6) } }
  const id = IDS[shown]

  return (
    <div className={`app ${ready ? 'ready' : ''}`} onPointerDown={splash}>
      <div className="stage" ref={stage} aria-hidden="true" />
      <Loader pct={loadPct} done={ready} />

      <header className="top">
        <button className="logo" onClick={() => go(0, { queue: true })}><span className="logo-drop" />{profile.name}</button>
        {profile.availability && <span className="avail"><i />{profile.availability}</span>}
        <nav className="nav" aria-label="Разделы">
          {chapters.map((c, i) => (
            <button key={c.id} className={chapter === i ? 'on' : ''} onClick={() => go(i, { queue: true })} aria-current={chapter === i ? 'step' : undefined}>
              <i>0{i + 1}</i>{c.name}
            </button>
          ))}
        </nav>
        <button className={`fx-toggle ${fx ? 'on' : ''}`} role="switch" aria-checked={fx} disabled={!canGL} onClick={() => toggleFx()}
          title={!canGL ? '3D недоступно на этом устройстве' : fx ? 'Выключить 3D — если сайт тормозит' : 'Включить живую 3D-ртуть'}>
          <span className="fx-track"><span className="fx-knob" /></span>3D
        </button>
        <a className="top-cta" href={profile.telegram} target="_blank" rel="noreferrer">Telegram ↗</a>
      </header>

      <div className="progress" aria-hidden="true"><span style={{ transform: `scaleY(${(chapter + 1) / chapters.length})` }} /></div>
      <div className="counter" aria-hidden="true"><b>0{chapter + 1}</b> / 0{chapters.length}</div>

      <main className={`chapter ch-${id} ${leaving ? 'leaving' : ''} ${ready ? '' : 'wait'}`} key={shown}>
        {id === 'home' && <Home go={go} openChat={openChat} />}
        {id === 'services' && <Services openType={openType} />}
        {id === 'works' && <Works onOpen={showCase} covered={overlay} />}
        {id === 'process' && <Process openChat={openChat} />}
        {id === 'reviews' && <Reviews />}
        {id === 'about' && <About />}
        {id === 'contact' && <Contact openChat={openChat} />}
      </main>

      {chapter < chapters.length - 1 && IDS[chapter] !== 'works' && <button className="next" onClick={() => go(chapter + 1)}><span>листай</span><i /></button>}
      {openCase && <Case data={openCase} onClose={closeCase}
        onNext={() => { const k = (openCase.idx + 1) % projects.length; const c = { ...projects[k], idx: k, ox: innerWidth / 2, oy: innerHeight / 2 }; history.replaceState({ case: 1 }, '', `#works/${slugOf(c, k)}`); setOpenCase(c) }}
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
      {site.customCursor && <Cursor />}
    </div>
  )
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
          <button className="btn line" onClick={() => openChat()}>Обсудить проект</button>
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
    let last = el.scrollLeft, v = 0, raf = 0
    // наклон карточек от скорости скролла; цикл крутится только пока лента движется
    const loop = () => {
      const d = el.scrollLeft - last; last = el.scrollLeft
      v += (d - v) * 0.15
      if (Math.abs(v) < 0.05 && !d) v = 0
      const sk = Math.round(Math.max(-12, Math.min(12, -v * 0.4)) * 4) / 4
      if (sk !== el._sk) { el._sk = sk; el.style.setProperty('--skew', `${sk}deg`) }
      raf = v || sk ? requestAnimationFrame(loop) : 0
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop) }
    el.addEventListener('scroll', kick, { passive: true })
    let down = null
    const pd = (e) => { if (e.pointerType !== 'mouse') return; down = { x: e.clientX, s: el.scrollLeft, moved: false } }
    const pm = (e) => { if (!down) return; const dx = e.clientX - down.x; if (Math.abs(dx) > 5) down.moved = true; el.scrollLeft = down.s - dx }
    const pu = () => { if (down?.moved) { el.dataset.dragged = '1'; setTimeout(() => delete el.dataset.dragged, 50) } down = null }
    el.addEventListener('pointerdown', pd); addEventListener('pointermove', pm); addEventListener('pointerup', pu)
    return () => { cancelAnimationFrame(raf); el.removeEventListener('scroll', kick); el.removeEventListener('pointerdown', pd); removeEventListener('pointermove', pm); removeEventListener('pointerup', pu)}
  }, [])
  const melt = (img) => {
    if (!img) return
    const disp = document.querySelector('#melt feDisplacementMap')
    const t0 = performance.now()
    img.classList.add('melting')
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 900)
      disp.setAttribute('scale', String(70 * (1 - p) * (1 - p)))
      if (p < 1) requestAnimationFrame(step); else img.classList.remove('melting')
    }
    requestAnimationFrame(step)
  }
  return (
    <>
      <h2 className="sr">Работы</h2>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="melt"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.03" numOctaves="2" seed="3" /><feDisplacementMap in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G" /></filter>
      </svg>
      <div className="reel hscroll" ref={reel} data-cursor="тяни">
        {projects.map((p, i) => {
          const empty = !p.title
          return (
            <div key={i} data-i={i} className={`card ${empty ? 'empty' : ''}`} style={{ animationDelay: `${i * 70}ms` }} role="button" tabIndex={0}
              aria-label={empty ? `Свободный слот ${i + 1}` : `Открыть кейс ${p.title}`}
              onPointerEnter={(e) => !p.demo && melt(e.currentTarget.querySelector('.card-media'))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onOpen({ ...p, idx: i, ox: innerWidth / 2, oy: innerHeight / 2 }) } }}
              onClick={(e) => { if (reel.current.dataset.dragged) return; onOpen({ ...p, idx: i, ox: e.clientX, oy: e.clientY }) }}
              data-cursor={empty ? 'слот' : p.demo ? 'потыкать' : 'открыть'}>
              <div className={`card-media ${p.demo ? 'is-demo' : ''} ${p.demo && (covered || !vis.has(i)) ? 'paused' : ''}`}>
                {p.demo ? <Demo kind={p.demo} mini paused={covered || !vis.has(i)} /> : p.video ? <video src={p.video} autoPlay muted loop playsInline /> : <img src={p.image || p.cover} alt="" draggable="false" loading="lazy" />}
                {p.demo && <span className="live-chip"><i />live demo</span>}
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
  useFocusTrap(ref, true, onClose)
  const empty = !data.title
  return (
    <div ref={ref} className={`case ${data.demo ? 'has-demo' : ''}`} role="dialog" aria-modal="true" aria-label={empty ? 'Свободный слот' : data.title} style={{ '--ox': `${data.ox}px`, '--oy': `${data.oy}px` }} key={data.idx}>
      <button className="case-close" onClick={onClose} aria-label="Закрыть"><svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg></button>
      <div className={`case-media ${data.demo ? `demo-${data.demo}` : ''}`}>
        {data.demo ? <Demo kind={data.demo} /> : data.video ? <video src={data.video} autoPlay muted loop playsInline controls /> : <img src={data.image || data.cover} alt="" />}
        {data.demo && <span className="case-try">Это живое демо — потыкай ↓</span>}
      </div>
      <div className="case-info">
        <div className="case-meta"><span>{String(data.idx + 1).padStart(2, '0')}</span><span>{data.type}</span>{data.year && <span>{data.year}</span>}<Badge on={data.isDemo} /></div>
        <h2><Drip text={empty ? 'Этот слот ждёт' : data.title} delay={350} /></h2>
        <p className="case-desc">{empty ? 'Я держу это место под следующий громкий проект. Возможно — под твой. Расскажи задачу, и через пару недель здесь будет кейс.' : data.desc}</p>
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
            <Badge on={r.demo} />
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
    { k: 'GitHub', v: profile.github.replace('https://', ''), href: profile.github },
  ]
  return (
    <>
      <h2 className="sr">Контакт</h2>
      <div className="contact">
        <p className="lead"><Drip text="Есть идея, рутина или бизнес, которому нужен вау-эффект? Отвечаю в течение дня." delay={150} /></p>
        <div className="row">
          <button className="btn chrome big" onClick={() => openChat()}>Бриф за 1 минуту</button>
          <a className="btn line big" href={profile.telegram} target="_blank" rel="noreferrer">Telegram ↗</a>
        </div>
        <div className="links">
          {links.map((l, i) => <a key={l.k} href={l.href} {...(l.href.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noreferrer' })} style={{ animationDelay: `${300 + i * 90}ms` }}><span>{l.k}</span><b>{l.v}</b></a>)}
        </div>
      </div>
      <footer className="copy">© {new Date().getFullYear()} {profile.name}</footer>
    </>
  )
}

function Cursor() {
  const ref = useRef(null)
  const [label, setLabel] = useState('')
  useEffect(() => {
    let x = -100, y = -100, cx = x, cy = y, raf = 0, tgt = null
    // цикл догоняет мышь и засыпает, когда курсор встал; подписи/классы меняем только при смене цели
    const loop = () => {
      cx += (x - cx) * 0.25; cy += (y - cy) * 0.25
      if (Math.abs(x - cx) < 0.1 && Math.abs(y - cy) < 0.1) { cx = x; cy = y; raf = 0 } else raf = requestAnimationFrame(loop)
      if (ref.current) ref.current.style.transform = `translate(${cx}px,${cy}px)`
    }
    const mv = (e) => {
      if (e.pointerType !== 'mouse') return
      x = e.clientX; y = e.clientY
      if (!raf) raf = requestAnimationFrame(loop)
      if (e.target === tgt) return
      tgt = e.target
      const t = e.target.closest?.('[data-cursor],a,button')
      const txt = e.target.closest?.('input,textarea,.chat')
      setLabel(t && !txt ? (t.dataset.cursor || '') : '')
      ref.current?.classList.toggle('hover', !!t && !txt)
      ref.current?.classList.toggle('text', !!txt)
    }
    addEventListener('pointermove', mv)
    return () => { removeEventListener('pointermove', mv); cancelAnimationFrame(raf) }
  }, [])
  return <div className="cursor" ref={ref} aria-hidden="true"><span>{label}</span></div>
}
