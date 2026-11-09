import type { GameEvent } from '../game/world'

/*
 * Every sound in the game is synthesized here with the Web Audio API:
 * oscillators, filtered noise and volume envelopes. No audio files.
 *
 * Browsers only allow audio after the user interacts with the page, so the
 * AudioContext is created by unlock(), which runs on the Play button click.
 */

type Wave = OscillatorType

class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private muted = false
  private lastPlayed = new Map<string, number>()

  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return
        this.ctx = new Ctor()
        this.master = this.ctx.createGain()
        this.master.gain.value = this.muted ? 0 : 0.55
        this.master.connect(this.ctx.destination)
        this.noise = this.makeNoise()
        this.startAmbience()
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
    } catch (error) {
      console.warn('[arcane] audio unavailable', error)
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05)
  }

  /** Plays the sound for each game event (rate-limited so a swarm doesn't get deafening). */
  handle(events: GameEvent[]): void {
    if (!this.ctx || this.muted) return
    for (const e of events) {
      const play = RECIPES[e.type]
      if (!play) continue
      const now = this.ctx.currentTime
      if (now - (this.lastPlayed.get(e.type) ?? -1) < 0.045) continue
      this.lastPlayed.set(e.type, now)
      play(this, e)
    }
  }

  // ---- building blocks -------------------------------------------------

  /** A pitched note with an attack/decay envelope, optionally sliding to `endFreq`. */
  tone(freq: number, duration: number, opts: { type?: Wave; volume?: number; endFreq?: number; delay?: number; attack?: number } = {}): void {
    const { ctx, master } = this
    if (!ctx || !master) return
    const t = ctx.currentTime + (opts.delay ?? 0)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = opts.type ?? 'sine'
    osc.frequency.setValueAtTime(freq, t)
    if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(opts.endFreq, t + duration)
    const peak = opts.volume ?? 0.2
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(peak, t + (opts.attack ?? 0.01))
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(gain).connect(master)
    osc.start(t)
    osc.stop(t + duration + 0.05)
  }

  /** Filtered white noise: whooshes, impacts, shatters. */
  hiss(duration: number, opts: { freq?: number; endFreq?: number; q?: number; type?: BiquadFilterType; volume?: number; delay?: number } = {}): void {
    const { ctx, master, noise } = this
    if (!ctx || !master || !noise) return
    const t = ctx.currentTime + (opts.delay ?? 0)
    const src = ctx.createBufferSource()
    src.buffer = noise
    const filter = ctx.createBiquadFilter()
    filter.type = opts.type ?? 'bandpass'
    filter.frequency.setValueAtTime(opts.freq ?? 1200, t)
    if (opts.endFreq) filter.frequency.exponentialRampToValueAtTime(opts.endFreq, t + duration)
    filter.Q.value = opts.q ?? 1
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(opts.volume ?? 0.2, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(filter).connect(gain).connect(master)
    src.start(t, Math.random() * 1.5)
    src.stop(t + duration + 0.05)
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  /** A quiet, slowly breathing low drone under everything. */
  private startAmbience(): void {
    const { ctx, master } = this
    if (!ctx || !master) return
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 320
    const gain = ctx.createGain()
    gain.gain.value = 0.035
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.08
    lfoGain.gain.value = 0.015
    lfo.connect(lfoGain).connect(gain.gain)
    for (const [freq, detune] of [
      [55, 0],
      [82.4, 4],
      [110, -6],
    ]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = detune
      osc.connect(filter)
      osc.start()
    }
    filter.connect(gain).connect(master)
    lfo.start()
  }
}

type Recipe = (s: SoundEngine, e: GameEvent) => void

/** Note frequencies used by the musical cues (A minor / C major). */
const N = { A3: 220, C4: 261.6, E4: 329.6, G4: 392, A4: 440, C5: 523.3, E5: 659.3, G5: 784, A5: 880, C6: 1046.5 }

const RECIPES: Partial<Record<GameEvent['type'], Recipe>> = {
  grab: (s) => s.tone(620, 0.12, { endFreq: 940, type: 'triangle', volume: 0.12 }),
  drop: (s) => s.tone(520, 0.12, { endFreq: 380, type: 'triangle', volume: 0.08 }),
  throw: (s) => s.hiss(0.28, { freq: 600, endFreq: 3200, q: 2, volume: 0.22 }),
  smash: (s) => {
    s.hiss(0.12, { freq: 900, type: 'lowpass', volume: 0.25 })
    s.tone(140, 0.15, { endFreq: 70, volume: 0.25 })
  },
  'enemy-hit': (s) => s.tone(300, 0.1, { endFreq: 180, type: 'square', volume: 0.05 }),
  kill: (s) => {
    s.tone(1320, 0.25, { type: 'triangle', volume: 0.1 })
    s.tone(1980, 0.18, { type: 'sine', volume: 0.06, delay: 0.02 })
    s.hiss(0.2, { freq: 2500, type: 'highpass', volume: 0.1 })
  },
  'shard-shatter': (s) => s.hiss(0.22, { freq: 5000, type: 'highpass', volume: 0.14 }),
  'shard-spawn': (s) => s.tone(1600, 0.15, { type: 'sine', volume: 0.025 }),
  'pedestal-hit': (s) => {
    s.tone(110, 0.4, { endFreq: 45, type: 'sine', volume: 0.45 })
    s.hiss(0.3, { freq: 300, type: 'lowpass', volume: 0.3 })
  },
  'shield-block': (s) => s.tone(1100, 0.35, { endFreq: 900, type: 'triangle', volume: 0.12 }),
  awaken: (s) => [N.C4, N.E4, N.G4, N.C5, N.E5].forEach((f, i) => s.tone(f, 0.9, { type: 'triangle', volume: 0.12, delay: i * 0.11 })),
  ward: (s) => [N.C5, N.E5, N.G5].forEach((f) => s.tone(f, 1.2, { volume: 0.08, attack: 0.15 })),
  nova: (s) => {
    s.tone(80, 1.0, { endFreq: 30, volume: 0.5 })
    s.hiss(1.2, { freq: 4000, endFreq: 400, volume: 0.25 })
  },
  'wave-start': (s, e) => {
    if (e.type === 'wave-start' && e.boss) {
      s.tone(N.A3 / 2, 1.8, { type: 'sawtooth', volume: 0.12, attack: 0.4 })
      s.tone(N.A3 / 2 + 6, 1.8, { type: 'sawtooth', volume: 0.1, attack: 0.4 })
      return
    }
    s.tone(N.A3, 0.5, { type: 'sawtooth', volume: 0.06, attack: 0.05 })
    s.tone(N.E4, 0.7, { type: 'sawtooth', volume: 0.06, attack: 0.05, delay: 0.25 })
  },
  'wave-clear': (s) => [N.A4, N.C5, N.E5, N.A5].forEach((f, i) => s.tone(f, 0.5, { type: 'triangle', volume: 0.1, delay: i * 0.08 })),
  'boss-spawn': (s) => s.hiss(2.0, { freq: 200, endFreq: 80, type: 'lowpass', volume: 0.35 }),
  'boss-attack': (s) => s.tone(420, 0.5, { endFreq: 160, type: 'sawtooth', volume: 0.06 }),
  'boss-hit': (s) => {
    s.tone(90, 0.3, { endFreq: 50, volume: 0.3 })
    s.tone(760, 0.2, { endFreq: 600, type: 'square', volume: 0.04 })
  },
  'boss-defeated': (s) => {
    s.tone(60, 2.2, { endFreq: 25, volume: 0.5 })
    s.hiss(2.4, { freq: 3000, endFreq: 200, volume: 0.3 })
  },
  'orb-destroyed': (s) => s.tone(900, 0.15, { endFreq: 1400, type: 'triangle', volume: 0.08 }),
  victory: (s) => [N.C5, N.E5, N.G5, N.C6, N.G5, N.C6].forEach((f, i) => s.tone(f, 0.6, { type: 'triangle', volume: 0.12, delay: i * 0.14 })),
  defeat: (s) => [N.A4, N.E4, N.C4, N.A3].forEach((f, i) => s.tone(f, 0.8, { type: 'triangle', volume: 0.1, delay: i * 0.22 })),
}

export const sound = new SoundEngine()
