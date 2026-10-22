/* ===== Web Audio API: Синтез мягкого тактильного звука капли воды без внешних файлов ===== */

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
 * Проигрывает мягкий, бархатный звук капли воды (без резких высоких частот).
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
      // Мягкий тёплый "бульк" капли: диапазон 340 -> 640 Гц, сглажен lowpass фильтром, комфортная бархатная громкость
      const osc = ctx.createOscillator()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(340, now)
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.05)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(750, now)
      filter.frequency.exponentialRampToValueAtTime(450, now + 0.08)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.038, now + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.09)
    } else if (type === 'pop') {
      // Приглушённый пузырёк для отмены / возврата назад
      const osc = ctx.createOscillator()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(420, now)
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.04)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(600, now)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.03, now + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.07)
    } else if (type === 'success') {
      // Тёплый двойной перелив капли (созвучный, без свиста)
      // Первая нота
      const osc1 = ctx.createOscillator()
      const filter1 = ctx.createBiquadFilter()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(360, now)
      osc1.frequency.exponentialRampToValueAtTime(520, now + 0.045)
      filter1.type = 'lowpass'
      filter1.frequency.setValueAtTime(700, now)

      gain1.gain.setValueAtTime(0.0001, now)
      gain1.gain.linearRampToValueAtTime(0.034, now + 0.008)
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)

      osc1.connect(filter1)
      filter1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.085)

      // Вторая нота (мягкий верхний перелив)
      const osc2 = ctx.createOscillator()
      const filter2 = ctx.createBiquadFilter()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(480, now + 0.065)
      osc2.frequency.exponentialRampToValueAtTime(680, now + 0.115)
      filter2.type = 'lowpass'
      filter2.frequency.setValueAtTime(800, now + 0.065)

      gain2.gain.setValueAtTime(0.0001, now + 0.065)
      gain2.gain.linearRampToValueAtTime(0.038, now + 0.075)
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)

      osc2.connect(filter2)
      filter2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.065)
      osc2.stop(now + 0.17)
    }
  } catch (e) {
    // Безопасный фоллбек
  }
}
