// Small synthesized sounds, so the app needs no audio files and is never silent.
const KEY = 'opagram.sound'
let ctx: AudioContext | null = null

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Browsers only allow audio after a click or key press: call this from one. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* no audio available */
  }
}

type Note = [freq: number, at: number, length: number, volume: number]

function play(notes: Note[]) {
  if (!soundEnabled() || !ctx || ctx.state !== 'running') return
  const c = ctx
  const t0 = c.currentTime
  for (const [freq, at, length, volume] of notes) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t0 + at)
    gain.gain.exponentialRampToValueAtTime(volume, t0 + at + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + length)
    osc.connect(gain).connect(c.destination)
    osc.start(t0 + at)
    osc.stop(t0 + at + length + 0.02)
  }
}

/** A message arrived in another chat, or while the window is hidden. */
export const playIncoming = () =>
  play([
    [880, 0, 0.18, 0.2],
    [1318.5, 0.09, 0.26, 0.17],
  ])

/** A message arrived in the chat you are looking at: quieter. */
export const playInChat = () => play([[1046.5, 0, 0.14, 0.08]])

export const playSend = () =>
  play([
    [523.25, 0, 0.1, 0.1],
    [784, 0.05, 0.14, 0.08],
  ])
