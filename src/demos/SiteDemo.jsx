import { useEffect, useRef, useState } from 'react'

/* Демо мини-лендинга кофейни. 🟡 ЗАГЛУШКА — замени на скрин/видео/ссылку своего сайта */
const MENU = [
  { n: 'Эспрессо', p: 180, c: '#5b3a29' },
  { n: 'Капучино', p: 260, c: '#c49a6c' },
  { n: 'Раф лаванда', p: 320, c: '#b9a3d6' },
  { n: 'Матча латте', p: 340, c: '#9cc27a' },
]
export default function SiteDemo({ mini = false, paused = false }) {
  const [cart, setCart] = useState([])
  const [bump, setBump] = useState(0)
  const [toast, setToast] = useState(null)
  const [hot, setHot] = useState(-1)
  const tt = useRef(), ht = useRef()
  const flash = (t, ms = 1400) => { setToast(t); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), ms) }
  const add = (i) => { setCart((c) => [...c, MENU[i]]); setBump((b) => b + 1); flash(`${MENU[i].n} в корзине`) }
  useEffect(() => () => { clearTimeout(tt.current); clearTimeout(ht.current) }, [])
  useEffect(() => {
    if (!mini || paused) return
    let i = 0
    const iv = setInterval(() => {
      const k = i++ % MENU.length; setHot(k)
      ht.current = setTimeout(() => { if (i % 5 === 0) setCart([]); add(k); setHot(-1) }, 600)
    }, 2400)
    return () => clearInterval(iv)
  }, [mini, paused])
  const sum = cart.reduce((a, b) => a + b.p, 0)
  return (
    <div className={`site ${mini ? 'mini' : ''}`} onPointerDown={(e) => mini || e.stopPropagation()}>
      <div className="site-bar"><i /><i /><i /><span>🔒 coffeelab.ru</span></div>
      <div className="site-page">
        <nav className="site-nav"><b>COFFEE LAB</b><span>Меню</span><span>О нас</span>
          <button key={bump} className="site-cart" tabIndex={mini ? -1 : 0}>🛒 {cart.length}</button></nav>
        <section className="site-hero">
          <div><small>specialty coffee · с 2019</small><h4>Кофе,<br />который хочется<br />потрогать</h4>
            <button className="site-cta" tabIndex={mini ? -1 : 0} onClick={() => add(1)}>Заказать с собой</button></div>
          <div className="site-cup"><span className="steam"><i /><i /><i /></span><span className="cup" /><span className="saucer" /></div>
        </section>
        <section className="site-menu">
          {MENU.map((m, i) => (
            <div key={m.n} className={`site-item ${hot === i ? 'hot' : ''}`}>
              <span className="dot" style={{ background: m.c }} />
              <b>{m.n}</b><small>{m.p} ₽</small>
              <button tabIndex={mini ? -1 : 0} onClick={() => add(i)} aria-label={`Добавить ${m.n}`}>+</button>
            </div>
          ))}
        </section>
        {!mini && <section className="site-foot"><span>Итого: <b>{sum} ₽</b></span><button className="site-cta" disabled={!cart.length} onClick={() => { flash('Заказ оформлен — заберите через 7 минут ☕', 2600); setCart([]) }}>Оплатить</button></section>}
      </div>
      <div className={`site-toast ${toast ? 'on' : ''}`}>{toast}</div>
    </div>
  )
}
