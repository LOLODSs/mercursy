/* ===== Web Audio API: Синтез звука капли воды без внешних файлов ===== */

let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) audioCtx = new AudioContextClass()
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

/**
 * Проигрывает мягкий тактильный звук капельки воды.
 * @param {'bloop' | 'pop' | 'success'} type - тип звука
 * @param {boolean} muted - отключён ли звук
 */
export function playWaterDrop(type = 'bloop', muted = false) {
  if (muted) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    if (type === 'bloop') {
      // Классический "бульк" капли воды: быстрый свип частоты вверх с мягким затуханием
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'

      osc.frequency.setValueAtTime(560, now)
      osc.frequency.exponentialRampToValueAtTime(1250, now + 0.065)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.09, now + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.14)
    } else if (type === 'pop') {
      // Мягкий пузырёк (назад / отмена)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'

      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.05)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(0.07, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.1)
    } else if (type === 'success') {
      // Двойной перелив капли (успешная отправка заявки)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(620, now)
      osc1.frequency.exponentialRampToValueAtTime(980, now + 0.06)
      gain1.gain.setValueAtTime(0.001, now)
      gain1.gain.linearRampToValueAtTime(0.08, now + 0.012)
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.13)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(820, now + 0.075)
      osc2.frequency.exponentialRampToValueAtTime(1420, now + 0.14)
      gain2.gain.setValueAtTime(0.001, now + 0.075)
      gain2.gain.linearRampToValueAtTime(0.09, now + 0.088)
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.075)
      osc2.stop(now + 0.23)
    }
  } catch (e) {
    // Безопасный фоллбек
  }
}
