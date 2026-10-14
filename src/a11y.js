import { useEffect } from 'react'
const SEL = 'a[href],button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),textarea,[tabindex]:not([tabindex="-1"])'
/* Держит фокус внутри открытого окна, Esc закрывает, после закрытия возвращает фокус */
export function useFocusTrap(ref, active, onClose, { trap = true } = {}) {
  useEffect(() => {
    if (!active || !ref.current) return
    const prev = document.activeElement
    const el = ref.current
    const t = setTimeout(() => { if (!el.contains(document.activeElement)) el.querySelector(SEL)?.focus({ preventScroll: true }) }, 60)
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab' || !trap) return
      const f = [...el.querySelectorAll(SEL)].filter((n) => n.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    el.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); el.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }) }
  }, [active, trap])
}
