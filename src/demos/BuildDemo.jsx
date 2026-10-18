import { useEffect, useRef, useState } from 'react'
import House from './House.jsx'
import { brand } from './brand.js'
import './tg.css'
import './build.css'

/* Демо для строительных компаний: калькулятор → бот → фотоотчёты → панель руководителя.
   Всё связано: заявка из калькулятора или бота сразу появляется в панели и «прилетает в Telegram».
   Бренд/цены под клиента — параметрами ссылки, см. brand.js. Данные из форм никуда не отправляются. */
const MAT = { 'Газобетон': 1, 'Кирпич': 1.25, 'Брус': 0.92, 'Каркас': 0.78 }
const FIN = { 'Коробка': 0.55, 'Тёплый контур': 0.8, 'Под ключ': 1 }
const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽'
const mln = (n) => (n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн ₽'
const calcPrice = ({ area, floors, mat, fin, garage, terrace }) => area * brand.m2 * MAT[mat] * FIN[fin] * (floors === 2 ? 0.94 : 1) + (garage ? 950000 : 0) + (terrace ? 420000 : 0)
const months = ({ area, fin }) => Math.max(3, Math.round(area / 38 + (fin === 'Под ключ' ? 2 : fin === 'Тёплый контур' ? 1 : 0)))
const now = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
const day = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function useCount(target, ms = 600) {
  const [v, setV] = useState(target); const cur = useRef(target)
  useEffect(() => {
    const from = cur.current, t0 = performance.now(); let raf
    const step = (t) => { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); cur.current = from + (target - from) * e; setV(cur.current); if (p < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf)
  }, [target])
  return v
}

const TABS = [['calc', 'Калькулятор'], ['bot', 'Бот'], ['site', 'Моя стройка'], ['panel', 'Панель']]
const SOURCES = ['Авито', 'Сайт', 'Директ', 'Звонок', 'Бот', 'Калькулятор']
const SEED = [
  { id: 1, t: '09:12', name: 'Ирина К.', src: 'Авито', req: 'Дом 120 м², газобетон', st: 'Выезд', ans: '2 мин' },
  { id: 2, t: '10:40', name: 'Павел', src: 'Директ', req: 'Баня + гостевой дом', st: 'В работе', ans: '4 мин' },
  { id: 3, t: '11:05', name: 'Марина', src: 'Звонок', req: 'Каркас 90 м², ипотека', st: 'Новая', late: true },
  { id: 4, t: '11:58', name: 'Олег Д.', src: 'Сайт', req: 'Кирпич 2 эт., 180 м²', st: 'Договор', ans: '1 мин' },
]
const RANDOM = [['Денис', 'Дом 150 м², под ключ'], ['Светлана', 'Фундамент + коробка'], ['Артур', 'Дом из бруса 110 м²'], ['Наталья', 'Перепланировка проекта'], ['Виктор', 'Гараж к дому']]

export default function BuildDemo({ mini = false, full = false, paused = false }) {
  const [tab, setTab] = useState('calc')
  const [leads, setLeads] = useState(SEED)
  const [unseen, setUnseen] = useState(0)
  const [push, setPush] = useState(null)
  const pt = useRef(), tabRef = useRef(tab); tabRef.current = tab
  const addLead = (l) => {
    const x = { id: Date.now() + Math.random(), t: now(), st: 'Новая', fresh: true, ...l }
    setLeads((ls) => [x, ...ls].slice(0, 9))
    if (tabRef.current !== 'panel') setUnseen((n) => n + 1)
    setPush(`${x.src}: ${x.req}`); clearTimeout(pt.current); pt.current = setTimeout(() => setPush(null), 3600)
  }
  useEffect(() => () => clearTimeout(pt.current), [])
  useEffect(() => { if (tab === 'panel') setUnseen(0) }, [tab])
  const style = { '--bd-c': brand.color }
  return (
    <div className={`bd ${mini ? 'mini' : ''} ${full ? 'full' : ''}`} style={style} onPointerDown={(e) => mini || e.stopPropagation()}>
      <header className="bd-top">
        <span className="bd-logo"><i>{brand.initials}</i><b>{brand.name}</b></span>
        <nav className="bd-tabs" role="tablist" aria-label="Разделы демо">
          {TABS.map(([k, n]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} tabIndex={mini ? -1 : 0} onClick={() => setTab(k)}>
              {n}{k === 'panel' && unseen > 0 && <em>{unseen}</em>}
            </button>
          ))}
        </nav>
        <span className="bd-phone">{brand.phone}</span>
      </header>
      <div className="bd-body">
        {tab === 'calc' && <Calc mini={mini} paused={paused} onLead={addLead} />}
        {tab === 'bot' && <Bot onLead={addLead} goSite={() => setTab('site')} />}
        {tab === 'site' && <Site />}
        {tab === 'panel' && <Panel leads={leads} setLeads={setLeads} addLead={addLead} />}
      </div>
      <div className={`bd-push ${push ? 'on' : ''}`} role="status"><span className="bd-push-ico"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M21.5 3.5L2.8 10.7c-.9.4-.9 1.6.1 1.9l4.6 1.5 1.8 5.6c.3.8 1.3 1 1.8.4l2.6-2.6 4.8 3.5c.7.5 1.6.1 1.8-.7L23 4.8c.2-1-.7-1.7-1.5-1.3zM9.6 14.2l8.6-7.4-6.9 8.6-.3 3-1.4-4.2z" fill="#fff"/></svg></span><div><b>Telegram · {brand.name} заявки</b><span>{push}</span></div></div>
    </div>
  )
}

/* ——— 1. Калькулятор ——— */
function Calc({ mini, paused, onLead }) {
  const [c, setC] = useState({ area: 140, floors: 1, mat: 'Газобетон', fin: 'Под ключ', garage: false, terrace: true })
  const [form, setForm] = useState({ name: '', phone: '' })
  const [sent, setSent] = useState(false)
  const set = (k, v) => setC((s) => ({ ...s, [k]: v }))
  const price = calcPrice(c), shown = useCount(price)
  // автопилот в карточке портфолио
  useEffect(() => {
    if (!mini || paused) return
    const seq = [{ area: 180, floors: 2 }, { mat: 'Кирпич' }, { garage: true }, { mat: 'Брус', area: 110, floors: 1 }, { fin: 'Тёплый контур', garage: false }, { mat: 'Газобетон', fin: 'Под ключ', area: 140, terrace: true }]
    let i = 0; const iv = setInterval(() => setC((s) => ({ ...s, ...seq[i++ % seq.length] })), 1700)
    return () => clearInterval(iv)
  }, [mini, paused])
  const submit = (e) => {
    e.preventDefault(); if (!form.phone.trim()) return
    setSent(true)
    onLead({ name: form.name.trim() || 'Без имени', src: 'Калькулятор', req: `${c.area} м², ${c.floors} эт., ${c.mat.toLowerCase()}, ${c.fin.toLowerCase()} · ${mln(price)}` })
  }
  const ti = mini ? -1 : 0
  return (
    <div className="bd-calc">
      {!mini && <div className="bd-calc-l">
        <h4>Сколько стоит ваш дом?</h4>
        <div className="bd-sub">Цена за минуту — без звонков. {brand.city}.</div>
        <label className="bd-range"><span>Площадь <b>{c.area} м²</b></span>
          <input type="range" min="60" max="300" step="5" value={c.area} tabIndex={ti} onInput={(e) => set('area', +e.currentTarget.value)} style={{ '--p': `${((c.area - 60) / 240) * 100}%` }} /></label>
        <Seg label="Этажей" opts={[1, 2]} v={c.floors} on={(v) => set('floors', v)} ti={ti} />
        <Seg label="Стены" opts={Object.keys(MAT)} v={c.mat} on={(v) => set('mat', v)} ti={ti} />
        <Seg label="Готовность" opts={Object.keys(FIN)} v={c.fin} on={(v) => set('fin', v)} ti={ti} />
        <div className="bd-checks">
          <label><input type="checkbox" checked={c.terrace} tabIndex={ti} onChange={(e) => set('terrace', e.currentTarget.checked)} />Терраса</label>
          <label><input type="checkbox" checked={c.garage} tabIndex={ti} onChange={(e) => set('garage', e.currentTarget.checked)} />Гараж</label>
        </div>
        <ul className="bd-trust"><li>Цена фиксируется в договоре</li><li>Оплата по этапам — по актам</li><li>Гарантия на конструктив 10 лет</li><li>Фотоотчёт после каждого этапа</li></ul>
      </div>}
      <div className="bd-calc-r">
        <div className="bd-house"><House floors={c.floors} material={c.mat} garage={c.garage} terrace={c.terrace} stage={c.fin === 'Коробка' ? 3 : 5} uid="calc" /></div>
        {mini && <div className="bd-chips"><span>{c.area} м²</span><span>{c.floors} эт.</span><span>{c.mat}</span><span>{c.fin}</span>{c.garage && <span>гараж</span>}</div>}
        <div className="bd-price">
          <small>Ориентировочно</small>
          <b>{rub(Math.round(shown / 1000) * 1000)}</b>
          <span>срок ~{months(c)} мес · цена фиксируется в договоре</span>
        </div>
        {mini ? null : !sent ? (
          <form className="bd-form" onSubmit={submit}>
            <input placeholder="Имя" value={form.name} tabIndex={ti} onInput={(e) => setForm({ ...form, name: e.currentTarget.value })} aria-label="Имя" />
            <input placeholder="Телефон" inputMode="tel" required value={form.phone} tabIndex={ti} onInput={(e) => setForm({ ...form, phone: e.currentTarget.value })} aria-label="Телефон" />
            <button className="bd-btn" tabIndex={ti}>Получить смету</button>
          </form>
        ) : (
          <div className="bd-ok">✅ Готово! Смета придёт в течение 15 минут.<small>Заявка уже у менеджера — загляни в «Панель».</small><button onClick={() => { setSent(false); setForm({ name: '', phone: '' }) }}>Посчитать ещё</button></div>
        )}
        {!mini && <div className="bd-note">Тестовый режим: заявка попадает во вкладку «Панель»</div>}
      </div>
    </div>
  )
}
function Seg({ label, opts, v, on, ti }) {
  return (
    <div className="bd-seg"><span>{label}</span>
      <div role="radiogroup" aria-label={label}>{opts.map((o) => <button type="button" key={o} role="radio" aria-checked={v === o} className={v === o ? 'on' : ''} tabIndex={ti} onClick={() => on(o)}>{o}</button>)}</div>
    </div>
  )
}

/* ——— 2. Бот ——— */
const AREA = { 'до 100 м²': 90, '100–150 м²': 130, '150–200 м²': 175, 'больше 200 м²': 230 }
function Bot({ onLead, goSite }) {
  const [msgs, setMsgs] = useState([])
  const [typing, setTyping] = useState(false)
  const [step, setStep] = useState(null)
  const ctx = useRef({}), alive = useRef(true), body = useRef(null), busy = useRef(false)
  const STEPS = {
    start: { bot: () => [`Здравствуйте! Я бот ${brand.name} 🏡`, 'Посчитаю дом, запишу на бесплатный выезд инженера или покажу, как идёт ваша стройка.'], buttons: ['🧮 Рассчитать дом', '📐 Выезд инженера', '🏗 Моя стройка', '🏘 Готовые дома'],
      next: (v) => ({ '🧮 Рассчитать дом': 'area', '📐 Выезд инженера': 'visit', '🏗 Моя стройка': 'mine', '🏘 Готовые дома': 'done' })[v] },
    area: { field: 'area', bot: () => ['Какая площадь нужна?'], buttons: Object.keys(AREA), next: 'mat' },
    mat: { field: 'mat', bot: () => ['Из чего строим?'], buttons: Object.keys(MAT), next: 'res' },
    res: { bot: (x) => { const a = AREA[x.area], p = calcPrice({ area: a, floors: 1, mat: x.mat, fin: 'Под ключ' }); return [`Дом ${a} м², ${x.mat.toLowerCase()}, под ключ:\n≈ ${mln(p)}\nСрок ~${months({ area: a, fin: 'Под ключ' })} мес.`, 'Точную смету инженер сделает после выезда на участок — бесплатно.'] }, buttons: ['📐 Записаться на выезд', '↺ В начало'], next: (v) => (v.startsWith('📐') ? 'visit' : 'start') },
    visit: { field: 'time', bot: () => ['Когда удобно? Инженер приедет, осмотрит участок и привезёт смету.'], buttons: [`Завтра, 11:00`, `${day(2)}, 10:00`, `${day(3)}, 15:00`], next: 'phone' },
    phone: { bot: () => ['Оставьте номер — пришлём подтверждение и напомним накануне.'], buttons: ['📱 Поделиться номером'], next: 'booked' },
    booked: { bot: (x) => { onLead({ name: 'Клиент из бота', src: 'Бот', req: `Выезд инженера · ${x.time}${x.area ? ` · ${x.area}` : ''}` }); return [`Записал ✅\n${x.time}\nИнженер: ${brand.manager}\nНапомню за день и за 2 часа.`, 'Заявка уже в панели руководителя 👀'] }, buttons: ['↺ В начало'], next: 'start' },
    mine: { bot: () => ['Объект: ул. Сосновая, 12\nСейчас: кровля — 60%', { photo: 3, text: `Фотоотчёт прораба · сегодня 09:40\n«Стропила стоят, сегодня кроем металлочерепицей» — ${brand.foreman}` }], buttons: ['📸 Все этапы', '💬 Вопрос прорабу', '↺ В начало'], next: (v) => (v.startsWith('📸') ? 'go' : v.startsWith('💬') ? 'ask' : 'start') },
    ask: { bot: () => [`Передал прорабу ${brand.foreman}, ответит в течение часа 👷`], buttons: ['↺ В начало'], next: 'start' },
    done: { bot: () => ['Последние сданные дома:', { photo: 5, house: { floors: 2, material: 'Кирпич', garage: true }, text: '186 м² · кирпич · 7 мес' }, { photo: 5, house: { floors: 1, material: 'Брус', terrace: true }, text: '112 м² · брус · 4 мес' }], buttons: ['🧮 Рассчитать такой же', '↺ В начало'], next: (v) => (v.startsWith('🧮') ? 'area' : 'start') },
  }
  const run = async (key) => {
    if (key === 'go') { goSite(); return }
    busy.current = true; setStep(null)
    if (key === 'start') { ctx.current = {}; setMsgs([]) }
    for (const t of STEPS[key].bot(ctx.current)) {
      if (!alive.current) return
      setTyping(true); await sleep(450 + (typeof t === 'string' ? t.length * 6 : 500)); if (!alive.current) return
      setTyping(false); setMsgs((m) => [...m, { from: 'bot', ...(typeof t === 'string' ? { text: t } : t), at: now() }]); await sleep(150)
    }
    if (alive.current) { setStep(key); busy.current = false }
  }
  const pick = async (v) => {
    if (busy.current || !step) return
    const s = STEPS[step]; if (s.field) ctx.current[s.field] = v
    setMsgs((m) => [...m, { from: 'me', text: v, at: now() }])
    const nx = typeof s.next === 'function' ? s.next(v) : s.next
    await sleep(220); run(nx)
  }
  useEffect(() => { alive.current = true; run('start'); return () => { alive.current = false } }, [])
  useEffect(() => { body.current?.scrollTo({ top: 1e5, behavior: 'smooth' }) }, [msgs, typing, step])
  const s = step && STEPS[step]
  return (
    <div className="bd-botwrap">
      <div className="tg bd-tg">
        <div className="tg-head"><span className="tg-back">‹</span><span className="tg-ava" style={{ background: brand.color }}>{brand.initials}</span>
          <div><b>{brand.name} · бот</b><small>{typing ? 'печатает…' : 'бот'}</small></div></div>
        <div className="tg-body" ref={body}>
          <div className="tg-date">сегодня</div>
          {msgs.map((m, i) => m.photo
            ? <div key={i} className="tg-msg bot bd-photo"><House stage={m.photo} uid={`b${i}`} floors={1} material="Газобетон" {...(m.house || { terrace: true })} /><span>{m.text}</span><i>{m.at}</i></div>
            : <div key={i} className={`tg-msg ${m.from}`}>{m.text}<i>{m.at}{m.from === 'me' ? ' ✓✓' : ''}</i></div>)}
          {typing && <div className="tg-msg bot typing"><span /><span /><span /></div>}
          {s && <div className={`tg-kb ${s.buttons.length > 2 ? 'col' : ''}`}>{s.buttons.map((b) => <button key={b} onClick={() => pick(b)}>{b}</button>)}</div>}
        </div>
        <div className="tg-input"><span className="tg-menu">☰ Меню</span><span className="tg-ph">Сообщение</span></div>
      </div>
      <ul className="bd-why">
        <li><b>24/7</b>отвечает ночью и в выходные</li>
        <li><b>30 сек</b>от вопроса до записи на выезд</li>
        <li><b>0</b>потерянных заявок — всё падает в панель</li>
      </ul>
    </div>
  )
}

/* ——— 3. Моя стройка: фотоотчёты по этапам ——— */
const STAGES = [
  { n: 'Фундамент', pay: 15, date: day(-64), done: true, works: ['Геология участка', 'Армирование', 'Заливка плиты', 'Гидроизоляция'], note: 'Плита залита, прочность набрана. Можно на стены.' },
  { n: 'Стены', pay: 30, date: day(-27), done: true, works: ['Кладка 1-го этажа', 'Армопояс', 'Перекрытие', 'Проёмы'], note: 'Коробка готова, геометрия в допуске ±3 мм.' },
  { n: 'Кровля', pay: 20, date: 'в работе', cur: 60, works: ['Стропила', 'Пароизоляция', 'Утепление', 'Металлочерепица'], note: 'Стропила стоят, сегодня кроем металлочерепицей.' },
  { n: 'Окна и двери', pay: 15, date: day(18), works: ['Окна ПВХ', 'Входная дверь', 'Откосы'] },
  { n: 'Фасад и участок', pay: 20, date: day(45), works: ['Фасад', 'Отмостка', 'Благоустройство'] },
]
function Site() {
  const [sel, setSel] = useState(2)
  const [ok, setOk] = useState({})
  const st = STAGES[sel], paid = STAGES.filter((s) => s.done).reduce((a, s) => a + s.pay, 0)
  const total = Math.round((2 + 0.6) / 5 * 100), bar = useCount(total, 900)
  return (
    <div className="bd-site">
      <div className="bd-site-head">
        <div><small>Объект</small><b>ул. Сосновая, 12 · 146 м²</b></div>
        <div className="bd-prog"><span style={{ width: `${bar}%` }} /><em>{Math.round(bar)}%</em></div>
        <div><small>Оплачено по этапам</small><b>{paid}% · сдача {day(60)}</b></div>
      </div>
      <div className="bd-site-main">
        <ol className="bd-stages">
          {STAGES.map((s, i) => (
            <li key={s.n}><button className={`${i === sel ? 'on' : ''} ${s.done ? 'done' : s.cur ? 'cur' : ''}`} onClick={() => setSel(i)}>
              <i>{s.done ? '✓' : s.cur ? `${s.cur}%` : i + 1}</i><span><b>{s.n}</b><small>{s.done ? `сдан ${s.date}` : s.cur ? 'в работе' : `план ${s.date}`} · {s.pay}%</small></span>
            </button></li>
          ))}
        </ol>
        <div className="bd-report" key={sel}>
          <div className="bd-shots">
            {[0, 1, 2].map((k) => <div key={k} className={`bd-shot s${k}`}><House stage={Math.min(sel + 1, 5)} uid={`s${sel}${k}`} terrace /><small>{st.done || st.cur ? `IMG_${4210 + sel * 7 + k}` : 'скоро'}</small></div>)}
          </div>
          <div className="bd-rep-info">
            <h5>{st.n}{st.cur && <span> · {st.cur}%</span>}</h5>
            {st.note ? <div className="bd-q">«{st.note}» <small>— прораб {brand.foreman}, {st.done ? st.date : 'сегодня 09:40'}</small></div> : <div className="bd-q bd-mute">Этап ещё не начат. Фото появятся здесь сами — прораб отправляет их из Telegram.</div>}
            <ul>{st.works.map((w, k) => <li key={w} className={st.done || (st.cur && k < 2) ? 'y' : ''}>{w}</li>)}</ul>
            {st.done && (ok[sel] ? <div className="bd-accepted">Этап принят ✓ Оплата {st.pay}% — по акту</div> : <button className="bd-btn" onClick={() => setOk({ ...ok, [sel]: 1 })}>Принять этап</button>)}
            {st.cur && <button className="bd-btn ghost">💬 Вопрос прорабу</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ——— 4. Панель руководителя ——— */
function Panel({ leads, setLeads, addLead }) {
  const [lateDone, setLateDone] = useState(false)
  useEffect(() => {
    let k = 0
    const iv = setInterval(() => { const [n, r] = RANDOM[k++ % RANDOM.length]; addLead({ name: n, src: SOURCES[k % 4], req: r }) }, 9000)
    return () => clearInterval(iv)
  }, [])
  const take = (id) => setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, st: 'В работе', ans: l.ans || '1 мин', late: false, fresh: false } : l)))
  const today = leads.length + 3
  return (
    <div className="bd-panel">
      <div className="bd-kpi">
        <div><b>{today}</b><span>заявок сегодня</span></div>
        <div><b>3 мин</b><span>средний ответ</span></div>
        <div><b>5</b><span>выездов на неделе</span></div>
        <div><b>18%</b><span>заявка → договор</span></div>
      </div>
      {!lateDone && leads.some((l) => l.late) && <div className="bd-alert">⚠ Заявка Марины ждёт 15 мин — менеджеру ({brand.manager}) ушло напоминание в Telegram<button onClick={() => setLateDone(true)}>ок</button></div>}
      <div className="bd-leads" role="table" aria-label="Заявки">
        {leads.map((l) => (
          <div key={l.id} role="row" className={`bd-lead ${l.fresh ? 'fresh' : ''} ${l.late ? 'late' : ''}`}>
            <span className="t">{l.t}</span>
            <span className={`src src-${SOURCES.indexOf(l.src)}`}>{l.src}</span>
            <span className="who"><b>{l.name}</b><small>{l.req}</small></span>
            {l.st === 'Новая' ? <button onClick={() => take(l.id)}>Взять</button> : <span className={`st st-${l.st === 'Договор' ? 'win' : 'go'}`}>{l.st}{l.ans && <small> · ответ {l.ans}</small>}</span>}
          </div>
        ))}
      </div>
      <div className="bd-foremen">
        <b>Отчёты прорабов сегодня — 3 из 4</b>
        <span className="y">Сосновая, 12 · 14 фото</span><span className="y">Лесная, 3 · 9 фото</span><span className="y">Озёрная, 8 · 6 фото</span><span className="n">Полевая, 5 · нет отчёта → напомнили</span>
      </div>
    </div>
  )
}
