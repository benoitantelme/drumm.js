const SNARE_TUNE_MIN_HZ = 380
const SNARE_TUNE_MAX_HZ = 440
const ENVELOPE_FLOOR = 0.0001
const VOICE_TAIL_S = 0.01
const ATTACK_MIN_S = 0.003
const ATTACK_MAX_S = 0.150
const SNARE_NOISE_MIN_GAIN = 0.01
const SNARE_NOISE_MAX_GAIN = 0.025
const SNARE_NOISE_DURATION_S = 0.03
const SNARE_NOISE_EDGE_FADE_S = 0.01
const SNARE_NOISE_HIGHPASS_HZ = 1600
const SNARE_NOISE_LOWPASS_HZ = 4200
const SNARE_TONE_GAIN = 0.12

export function snareTuneToHz(tune: number): number {
  return SNARE_TUNE_MIN_HZ + (tune / 100) * (SNARE_TUNE_MAX_HZ - SNARE_TUNE_MIN_HZ)
}

function attackSecondsToMix(attackS: number): number {
  return Math.max(0, Math.min(1, (attackS - ATTACK_MIN_S) / (ATTACK_MAX_S - ATTACK_MIN_S)))
}

function createShapedNoiseBuffer(
  ctx: AudioContext,
  durationS: number = SNARE_NOISE_DURATION_S,
  edgeFadeS: number = SNARE_NOISE_EDGE_FADE_S,
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
  const noisePeakGain = SNARE_NOISE_MAX_GAIN - ((SNARE_NOISE_MAX_GAIN - SNARE_NOISE_MIN_GAIN) * attackMix)
  const noiseReleaseEnd = envelopeStart + Math.min(SNARE_NOISE_DURATION_S, decayS * 0.25 + 0.02)

  const toneOsc = ctx.createOscillator()
  const toneGain = ctx.createGain()
  toneOsc.type = 'sine'
  toneOsc.frequency.setValueAtTime(tuneHz, envelopeStart)
  toneGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  toneGain.gain.linearRampToValueAtTime(SNARE_TONE_GAIN, attackEnd)
  toneGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, decayEnd)
  toneOsc.connect(toneGain)
  toneGain.connect(gainNode)
  toneOsc.start(time)
  toneOsc.stop(decayEnd + VOICE_TAIL_S)

  const noise = ctx.createBufferSource()
  noise.buffer = createShapedNoiseBuffer(ctx)
  const noiseHighpass = ctx.createBiquadFilter()
  const noiseLowpass = ctx.createBiquadFilter()
  const noiseGain = ctx.createGain()
  noiseHighpass.type = 'highpass'
  noiseHighpass.frequency.setValueAtTime(SNARE_NOISE_HIGHPASS_HZ, envelopeStart)
  noiseLowpass.type = 'lowpass'
  noiseLowpass.frequency.setValueAtTime(SNARE_NOISE_LOWPASS_HZ, envelopeStart)
  noiseGain.gain.setValueAtTime(ENVELOPE_FLOOR, envelopeStart)
  noiseGain.gain.linearRampToValueAtTime(noisePeakGain, envelopeStart + SNARE_NOISE_EDGE_FADE_S)
  noiseGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, noiseReleaseEnd)
  noise.connect(noiseHighpass)
  noiseHighpass.connect(noiseLowpass)
  noiseLowpass.connect(noiseGain)
  noiseGain.connect(gainNode)
  noise.start(time)
  noise.stop(noiseReleaseEnd + VOICE_TAIL_S)
}
