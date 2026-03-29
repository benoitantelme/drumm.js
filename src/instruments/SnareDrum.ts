const SNARE_TUNE_MIN_HZ = 150
const SNARE_TUNE_MAX_HZ = 280
const ENVELOPE_FLOOR = 0.0001
const VOICE_TAIL_S = 0.01
const ATTACK_MIN_S = 0.001
const ATTACK_MAX_S = 0.030

// ── Tone body ───────────────────────────────────────────
const SNARE_TONE_GAIN = 0.25
const SNARE_TONE_DETUNE_HZ = 30          // second oscillator offset for fatness

// ── Crack layer (broadband transient) ──────────────────
const CRACK_DURATION_S = 0.08
const CRACK_EDGE_FADE_S = 0.001
const CRACK_HIGHPASS_HZ = 1200
const CRACK_PEAK_GAIN = 0.55

// ── Rattle layer (snare wires, filtered noise) ─────────
const RATTLE_EDGE_FADE_S = 0.004
const RATTLE_HIGHPASS_HZ = 1800
const RATTLE_LOWPASS_HZ  = 8000
const RATTLE_PEAK_GAIN   = 0.45

export function snareTuneToHz(tune: number): number {
  return SNARE_TUNE_MIN_HZ + (tune / 100) * (SNARE_TUNE_MAX_HZ - SNARE_TUNE_MIN_HZ)
}

function attackSecondsToMix(attackS: number): number {
  return Math.max(0, Math.min(1, (attackS - ATTACK_MIN_S) / (ATTACK_MAX_S - ATTACK_MIN_S)))
}

function createNoiseBuffer(
  ctx: AudioContext,
  durationS: number,
  edgeFadeS: number,
): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * durationS)
  const fadeSamples = Math.max(1, Math.floor(ctx.sampleRate * edgeFadeS))
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < bufferSize; i++) {
    let amplitude = 1
    if (i < fadeSamples) {
      amplitude = i / fadeSamples
    } else if (i >= bufferSize - fadeSamples) {
      amplitude = (bufferSize - 1 - i) / fadeSamples
    }
    data[i] = (Math.random() * 2 - 1) * Math.max(0, amplitude)
  }

  data[0] = 0
  data[bufferSize - 1] = 0
  return buffer
}

export function scheduleSnareDrum(
  ctx: AudioContext,
  time: number,
  gainNode: GainNode,
  tuneHz: number,
  attackS: number,
  decayS: number,
): void {
  const envelopeStart = Math.max(time, ctx.currentTime)
  const attackEnd = envelopeStart + attackS
  const decayEnd = attackEnd + decayS
  const attackMix = attackSecondsToMix(attackS)

  // ── Tone: two slightly detuned sines for a fatter body ─
  const toneGain = ctx.createGain()
  toneGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  toneGain.gain.linearRampToValueAtTime(SNARE_TONE_GAIN, attackEnd)
  toneGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, decayEnd)
  toneGain.connect(gainNode)

  for (const offset of [0, SNARE_TONE_DETUNE_HZ]) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(tuneHz + offset, envelopeStart)
    osc.connect(toneGain)
    osc.start(time)
    osc.stop(decayEnd + VOICE_TAIL_S)
  }

  // ── Crack: short broadband burst — the initial transient ─
  const crackEnd = envelopeStart + CRACK_DURATION_S
  const crackPeak = CRACK_PEAK_GAIN * (1 - attackMix * 0.5)

  const crack = ctx.createBufferSource()
  crack.buffer = createNoiseBuffer(ctx, CRACK_DURATION_S, CRACK_EDGE_FADE_S)

  const crackHp = ctx.createBiquadFilter()
  crackHp.type = 'highpass'
  crackHp.frequency.setValueAtTime(CRACK_HIGHPASS_HZ, envelopeStart)

  const crackGain = ctx.createGain()
  crackGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  crackGain.gain.linearRampToValueAtTime(crackPeak, envelopeStart + CRACK_EDGE_FADE_S * 4)
  crackGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, crackEnd)

  crack.connect(crackHp)
  crackHp.connect(crackGain)
  crackGain.connect(gainNode)
  crack.start(time)
  crack.stop(crackEnd + VOICE_TAIL_S)

  // ── Rattle: longer filtered noise — the snare wire buzz ─
  // Duration is driven by the decay knob so it feels responsive
  const rattleDuration = Math.max(0.05, decayS * 0.8)
  const rattleEnd = envelopeStart + rattleDuration
  const rattlePeak = RATTLE_PEAK_GAIN * (1 - attackMix * 0.4)

  const rattle = ctx.createBufferSource()
  rattle.buffer = createNoiseBuffer(ctx, rattleDuration, RATTLE_EDGE_FADE_S)

  const rattleHp = ctx.createBiquadFilter()
  rattleHp.type = 'highpass'
  rattleHp.frequency.setValueAtTime(RATTLE_HIGHPASS_HZ, envelopeStart)

  const rattleLp = ctx.createBiquadFilter()
  rattleLp.type = 'lowpass'
  rattleLp.frequency.setValueAtTime(RATTLE_LOWPASS_HZ, envelopeStart)

  const rattleGain = ctx.createGain()
  rattleGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  rattleGain.gain.linearRampToValueAtTime(rattlePeak, attackEnd)
  rattleGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, rattleEnd)

  rattle.connect(rattleHp)
  rattleHp.connect(rattleLp)
  rattleLp.connect(rattleGain)
  rattleGain.connect(gainNode)
  rattle.start(time)
  rattle.stop(rattleEnd + VOICE_TAIL_S)
}
