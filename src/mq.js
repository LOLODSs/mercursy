/* Единая точка «мобильной» раскладки: телефоны + планшеты в портретной ориентации.
   Тот же запрос продублирован в styles.css (поиск: MOBILE_MQ) */
export const MOBILE_MQ = '(max-width: 760px), (orientation: portrait) and (max-width: 1100px)'
export const isMobile = () => matchMedia(MOBILE_MQ).matches
