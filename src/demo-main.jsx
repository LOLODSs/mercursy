import { render } from 'preact'
import './fonts.css'
import BuildDemo from './demos/BuildDemo.jsx'
import { brand } from './demos/brand.js'
import { profile } from './config.js'
import './demo-page.css'

/* Отдельная страница демо — её удобно кидать клиенту в личку.
   Под клиента: demo.html?name=СтройМакс&color=0a7d4f&m2=42000 (все параметры — в src/demos/brand.js) */
document.title = `${brand.name} — демо системы продаж`
function Page() {
  return (
    <div className="dp" style={{ '--bd-c': brand.color }}>
      <header className="dp-top">
        <span>{brand.custom ? <>Демо для <b>{brand.name}</b></> : <>Живое демо · <b>система продаж для стройки</b></>}</span>
        <a href="./" target="_blank" rel="noreferrer">сделано {profile.name} ↗</a>
      </header>
      <main className="dp-main"><BuildDemo full /></main>
      <footer className="dp-foot">
        <span>Калькулятор, бот, фотоотчёты и панель связаны: оставьте заявку — и она появится в «Панели».</span>
        <a className="dp-cta" href={profile.telegram} target="_blank" rel="noreferrer">Хочу так для своей компании</a>
      </footer>
    </div>
  )
}
render(<Page />, document.getElementById('root'))
