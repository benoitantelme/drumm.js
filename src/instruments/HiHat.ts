const HIHAT_TUNE_MIN_HZ = 6000
const HIHAT_TUNE_MAX_HZ = 12000
const ENVELOPE_FLOOR = 0.0001
const VOICE_TAIL_S = 0.01
const ATTACK_MIN_S = 0.001
const ATTACK_MAX_S = 0.020
const HIHAT_NOISE_MIN_GAIN = 0.06
const HIHAT_NOISE_MAX_GAIN = 0.18
const HIHAT_NOISE_DURATION_S = 0.25
const HIHAT_NOISE_EDGE_FADE_S = 0.002
const HIHAT_NOISE_HIGHPASS_HZ = 7000
const HIHAT_NOISE_BANDPASS_Q = 0.8

export function hiHatTuneToHz(tune: number): number {
  return HIHAT_TUNE_MIN_HZ + (tune / 100) * (HIHAT_TUNE_MAX_HZ - HIHAT_TUNE_MIN_HZ)
}

function attackSecondsToMix(attackS: number): number {
  return Math.max(0, Math.min(1, (attackS - ATTACK_MIN_S) / (ATTACK_MAX_S - ATTACK_MIN_S)))
}

function createShapedNoiseBuffer(
  ctx: AudioContext,
  durationS: number = HIHAT_NOISE_DURATION_S,
  edgeFadeS: number = HIHAT_NOISE_EDGE_FADE_S,
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

export function scheduleHiHat(
  ctx: AudioContext,
  time: number,
  gainNode: GainNode,
  tuneHz: number,
  attackS: number,
  decayS: number,
): void {
  const envelopeStart = Math.max(time, ctx.currentTime)
  const attackEnd = envelopeStart + attackS
  const attackMix = attackSecondsToMix(attackS)
  const noisePeakGain = HIHAT_NOISE_MAX_GAIN - ((HIHAT_NOISE_MAX_GAIN - HIHAT_NOISE_MIN_GAIN) * attackMix)
  const noiseReleaseEnd = envelopeStart + Math.min(HIHAT_NOISE_DURATION_S, decayS + attackS)

  const noise = ctx.createBufferSource()
  noise.buffer = createShapedNoiseBuffer(ctx)

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.setValueAtTime(HIHAT_NOISE_HIGHPASS_HZ, envelopeStart)

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(tuneHz, envelopeStart)
  bandpass.Q.value = HIHAT_NOISE_BANDPASS_Q

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  noiseGain.gain.linearRampToValueAtTime(noisePeakGain, attackEnd)
  noiseGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, noiseReleaseEnd)

  noise.connect(highpass)
  highpass.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(gainNode)

  noise.start(time)
  noise.stop(noiseReleaseEnd + VOICE_TAIL_S)
}
