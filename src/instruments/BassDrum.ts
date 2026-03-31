const TUNE_MIN_HZ = 40
const TUNE_MAX_HZ = 120
const KICK_BASE_VOLUME = 0.7
const ENVELOPE_FLOOR = 0.0001
const VOICE_TAIL_S = 0.01
const NOISE_DURATION_S = 0.008
const NOISE_EDGE_FADE_S = 0.002
const NOISE_MIN_GAIN = 0.01
const NOISE_MAX_GAIN = 0.06
const NOISE_HIGHPASS_HZ = 1800
const KICK_END_HZ_MIN = 45
const KICK_END_HZ_MAX = 70
const ATTACK_MIN_S = 0.003
const ATTACK_MAX_S = 0.150
const DECAY_MIN_S = 0.050
const DECAY_MAX_S = 0.500

export function tuneToHz(tune: number): number {
  return TUNE_MIN_HZ + (tune / 100) * (TUNE_MAX_HZ - TUNE_MIN_HZ)
}

function attackSecondsToMix(attackS: number): number {
  return Math.max(0, Math.min(1, (attackS - ATTACK_MIN_S) / (ATTACK_MAX_S - ATTACK_MIN_S)))
}

function decaySecondsToMix(decayS: number): number {
  return Math.max(0, Math.min(1, (decayS - DECAY_MIN_S) / (DECAY_MAX_S - DECAY_MIN_S)))
}

function createShapedNoiseBuffer(
  ctx: AudioContext,
  durationS: number = NOISE_DURATION_S,
  edgeFadeS: number = NOISE_EDGE_FADE_S,
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

export function scheduleBassDrum(
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
  const oscReleaseEnd = decayEnd
  const noiseRampEnd = envelopeStart + NOISE_EDGE_FADE_S
  const noiseReleaseEnd = envelopeStart + NOISE_DURATION_S
  const attackMix = attackSecondsToMix(attackS)
  const decayMix = decaySecondsToMix(decayS)
  const noisePeakGain = NOISE_MAX_GAIN - ((NOISE_MAX_GAIN - NOISE_MIN_GAIN) * attackMix)
  const kickEndHz = KICK_END_HZ_MAX - ((KICK_END_HZ_MAX - KICK_END_HZ_MIN) * decayMix)

  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(tuneHz, envelopeStart)
  osc.frequency.exponentialRampToValueAtTime(kickEndHz, decayEnd)
  oscGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  oscGain.gain.linearRampToValueAtTime(KICK_BASE_VOLUME, attackEnd)
  oscGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, oscReleaseEnd)
  osc.connect(oscGain)
  oscGain.connect(gainNode)
  osc.start(time)
  osc.stop(oscReleaseEnd + VOICE_TAIL_S)

  const noise = ctx.createBufferSource()
  noise.buffer = createShapedNoiseBuffer(ctx)
  const noiseFilter = ctx.createBiquadFilter()
  const noiseGain = ctx.createGain()
  noiseFilter.type = 'highpass'
  noiseFilter.frequency.setValueAtTime(NOISE_HIGHPASS_HZ, envelopeStart)
  noiseGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  noiseGain.gain.linearRampToValueAtTime(noisePeakGain, noiseRampEnd)
  noiseGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, noiseReleaseEnd)
  noise.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(gainNode)
  noise.start(time)
  noise.stop(noiseReleaseEnd + VOICE_TAIL_S)
}
