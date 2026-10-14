/* Бренд демо «Стройка». Значения по умолчанию — вымышленная компания.
   Демо под конкретного клиента — без пересборки, параметрами ссылки:
   demo.html?name=СтройМакс&color=0a7d4f&m2=42000&city=Казань&manager=Ирина&phone=%2B7%20900%20123-45-67
   name — название, color — фирменный цвет (hex без #), m2 — цена м² «под ключ» из газобетона,
   city — регион работ, manager — имя инженера/менеджера, phone — телефон в шапке. */
const DEF = {
  name: 'СтройДом',                 // 🟡 ЗАГЛУШКА — вымышленная компания для демо
  color: 'f26b1d',
  m2: 38000,
  city: 'Москва и область',
  manager: 'Алексей',
  foreman: 'Сергей',
  phone: '+7 (900) 000-00-00',
}
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
const txt = (k, max = 32) => { const v = (q.get(k) || '').trim().replace(/[<>]/g, ''); return v ? v.slice(0, max) : DEF[k] }
const color = /^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(q.get('color') || '') ? q.get('color') : DEF.color
const m2 = Math.min(500000, Math.max(5000, +q.get('m2') || DEF.m2))
export const brand = {
  name: txt('name'), city: txt('city', 40), manager: txt('manager', 20), foreman: txt('foreman', 20), phone: txt('phone', 24),
  color: '#' + color, m2,
  initials: txt('name').replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+|(?=[А-ЯA-Z])/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'СД',
  custom: ['name', 'color', 'm2', 'city'].some((k) => q.has(k)),
}
