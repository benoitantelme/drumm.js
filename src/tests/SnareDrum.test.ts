/**
 * Tests for SnareDrum synthesis.
 *
 * Strategy: provide a spy-instrumented MockAudioContext so we can assert on
 * every gain.setValueAtTime / linearRampToValueAtTime /
 * exponentialRampToValueAtTime call made during scheduleSnareDrum().
 *
 * Layer identity is determined by call order — scheduleSnareDrum creates nodes
 * in this fixed sequence:
 *   createGain [0]  → toneGain
 *   createGain [1]  → crackGain
 *   createGain [2]  → rattleGain
 *
 * Constants mirrored from SnareDrum.ts so the tests are self-documenting:
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scheduleSnareDrum, snareTuneToHz } from '../instruments/SnareDrum.ts'

// ── mirrored constants ───────────────────────────────────
const SNARE_TONE_GAIN        = 0.25
const SNARE_TONE_DECAY_MAX_S = 0.040
const SNARE_TONE_DECAY_RATIO = 0.15
const SNARE_TONE_TAIL_GAIN   = 0.015
const CRACK_PEAK_GAIN        = 0.55
const RATTLE_PEAK_GAIN       = 0.45
const ENVELOPE_FLOOR         = 0.0001
const CRACK_DURATION_S       = 0.08

// ── mock factory ────────────────────────────────────────
function makeGainNode() {
  return {
    gain: {
      value: 1,
      setValueAtTime:              vi.fn(),
      linearRampToValueAtTime:     vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }
}

function makeMockContext(currentTime = 0) {
  const gainNodes: ReturnType<typeof makeGainNode>[] = []

  const ctx = {
    currentTime,
    sampleRate: 44100,
    destination: {},
    createGain: vi.fn().mockImplementation(() => {
      const node = makeGainNode()
      gainNodes.push(node)
      return node
    }),
    createOscillator: vi.fn().mockReturnValue({
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    }),
    createBuffer: vi.fn().mockImplementation((_ch: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    })),
    createBiquadFilter: vi.fn().mockReturnValue({
      type: 'lowpass',
      frequency: { setValueAtTime: vi.fn() },
      Q: { value: 1 },
      connect: vi.fn(),
    }),
    createBufferSource: vi.fn().mockReturnValue({
      buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    }),
    _gainNodes: gainNodes,
  }

  return ctx
}

type MockContext = ReturnType<typeof makeMockContext>

// Helper: call scheduleSnareDrum and return the three gain nodes by layer index
function schedule(
  ctx: MockContext,
  { time = 0, tuneHz = 200, attackS = 0.001, decayS = 0.150 } = {},
) {
  const masterGain = makeGainNode()
  scheduleSnareDrum(
    ctx as unknown as AudioContext,
    time,
    masterGain as unknown as GainNode,
    tuneHz,
    attackS,
    decayS,
  )
  const [toneGain, crackGain, rattleGain] = ctx._gainNodes
  return { toneGain, crackGain, rattleGain, masterGain }
}

// ── snareTuneToHz ────────────────────────────────────────
describe('snareTuneToHz', () => {
  it('maps 0 to 150 Hz', () => {
    expect(snareTuneToHz(0)).toBe(150)
  })

  it('maps 100 to 280 Hz', () => {
    expect(snareTuneToHz(100)).toBe(280)
  })

  it('maps 50 to 215 Hz', () => {
    expect(snareTuneToHz(50)).toBe(215)
  })

  it('never returns a value below 150 Hz', () => {
    expect(snareTuneToHz(0)).toBeGreaterThanOrEqual(150)
  })

  it('never returns a value above 280 Hz', () => {
    expect(snareTuneToHz(100)).toBeLessThanOrEqual(280)
  })
})

// ── tone envelope ────────────────────────────────────────
describe('tone envelope', () => {
  let ctx: MockContext

  beforeEach(() => { ctx = makeMockContext() })

  it('starts at ENVELOPE_FLOOR', () => {
    const { toneGain } = schedule(ctx)
    expect(toneGain.gain.setValueAtTime).toHaveBeenCalledWith(ENVELOPE_FLOOR, expect.any(Number))
  })

  it('ramps up to SNARE_TONE_GAIN at attackEnd', () => {
    const attackS = 0.005
    const { toneGain } = schedule(ctx, { attackS })
    const attackEnd = attackS  // envelopeStart = max(0, currentTime=0) = 0
    expect(toneGain.gain.linearRampToValueAtTime)
      .toHaveBeenCalledWith(SNARE_TONE_GAIN, expect.closeTo(attackEnd, 5))
  })

  it('snaps to SNARE_TONE_TAIL_GAIN quickly after attack', () => {
    const attackS = 0.001
    const decayS  = 0.200
    const { toneGain } = schedule(ctx, { attackS, decayS })

    const attackEnd   = attackS
    const toneDecayS  = Math.min(SNARE_TONE_DECAY_MAX_S, decayS * SNARE_TONE_DECAY_RATIO)
    const toneSnapEnd = attackEnd + toneDecayS

    // First exponential ramp must land on SNARE_TONE_TAIL_GAIN at toneSnapEnd
    const calls = toneGain.gain.exponentialRampToValueAtTime.mock.calls
    expect(calls[0][0]).toBeCloseTo(SNARE_TONE_TAIL_GAIN, 5)
    expect(calls[0][1]).toBeCloseTo(toneSnapEnd, 5)
  })

  it('tone snap time is capped at SNARE_TONE_DECAY_MAX_S above the attack', () => {
    // Use a very long decay so ratio * decayS would exceed the cap
    const attackS = 0.001
    const decayS  = 2.0   // 2 * 0.15 = 0.30 >> cap of 0.040
    const { toneGain } = schedule(ctx, { attackS, decayS })

    const attackEnd   = attackS
    const toneSnapEnd = attackEnd + SNARE_TONE_DECAY_MAX_S

    const calls = toneGain.gain.exponentialRampToValueAtTime.mock.calls
    expect(calls[0][1]).toBeCloseTo(toneSnapEnd, 5)
  })

  it('tone snap time scales with decayS when below the cap', () => {
    const attackS     = 0.001
    const shortDecayS = 0.050   // 0.050 * 0.15 = 0.0075 — well under cap
    const longDecayS  = 0.200   // 0.200 * 0.15 = 0.030  — also under cap

    const ctxA = makeMockContext()
    const ctxB = makeMockContext()
    schedule(ctxA, { attackS, decayS: shortDecayS })
    schedule(ctxB, { attackS, decayS: longDecayS })

    const snapA = ctxA._gainNodes[0].gain.exponentialRampToValueAtTime.mock.calls[0][1]
    const snapB = ctxB._gainNodes[0].gain.exponentialRampToValueAtTime.mock.calls[0][1]
    expect(snapB).toBeGreaterThan(snapA)
  })

  it('final exponential ramp decays to ENVELOPE_FLOOR at decayEnd', () => {
    const attackS = 0.001
    const decayS  = 0.150
    const { toneGain } = schedule(ctx, { attackS, decayS })

    const decayEnd = attackS + decayS
    const calls    = toneGain.gain.exponentialRampToValueAtTime.mock.calls
    // Second ramp: floor at full decayEnd
    expect(calls[1][0]).toBeCloseTo(ENVELOPE_FLOOR, 5)
    expect(calls[1][1]).toBeCloseTo(decayEnd, 5)
  })

  it('tone decay is faster than the full decayS duration', () => {
    const attackS = 0.001
    const decayS  = 0.200
    const { toneGain } = schedule(ctx, { attackS, decayS })

    const attackEnd = attackS
    const decayEnd  = attackS + decayS
    const snapTime  = toneGain.gain.exponentialRampToValueAtTime.mock.calls[0][1] as number
    expect(snapTime).toBeLessThan(decayEnd)
    expect(snapTime).toBeGreaterThan(attackEnd)
  })

  it('creates exactly two oscillators (detuned pair)', () => {
    schedule(ctx)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2)
  })

  it('oscillators are stopped at decayEnd + tail', () => {
    const attackS = 0.001
    const decayS  = 0.150
    schedule(ctx, { attackS, decayS })
    const osc = ctx.createOscillator.mock.results[0].value
    // stop time should be > decayEnd
    const stopTime = osc.stop.mock.calls[0][0] as number
    expect(stopTime).toBeGreaterThan(attackS + decayS)
  })
})

// ── crack layer ──────────────────────────────────────────
describe('crack layer', () => {
  let ctx: MockContext

  beforeEach(() => { ctx = makeMockContext() })

  it('starts at ENVELOPE_FLOOR', () => {
    const { crackGain } = schedule(ctx)
    expect(crackGain.gain.setValueAtTime).toHaveBeenCalledWith(ENVELOPE_FLOOR, expect.any(Number))
  })

  it('peaks at CRACK_PEAK_GAIN (zero attack mix)', () => {
    // Minimum attackS → attackMix = 0 → peak = CRACK_PEAK_GAIN * (1 - 0) = full
    const { crackGain } = schedule(ctx, { attackS: 0.001 })
    expect(crackGain.gain.linearRampToValueAtTime)
      .toHaveBeenCalledWith(expect.closeTo(CRACK_PEAK_GAIN, 3), expect.any(Number))
  })

  it('peak is reduced when attack is longer (higher attackMix)', () => {
    const ctxShort = makeMockContext()
    const ctxLong  = makeMockContext()
    schedule(ctxShort, { attackS: 0.001 })
    schedule(ctxLong,  { attackS: 0.030 })

    const peakShort = ctxShort._gainNodes[1].gain.linearRampToValueAtTime.mock.calls[0][0] as number
    const peakLong  = ctxLong._gainNodes[1].gain.linearRampToValueAtTime.mock.calls[0][0] as number
    expect(peakShort).toBeGreaterThan(peakLong)
  })

  it('decays to ENVELOPE_FLOOR at CRACK_DURATION_S after envelopeStart', () => {
    const { crackGain } = schedule(ctx, { time: 0 })
    const crackEnd = CRACK_DURATION_S  // envelopeStart = 0
    expect(crackGain.gain.exponentialRampToValueAtTime)
      .toHaveBeenCalledWith(ENVELOPE_FLOOR, expect.closeTo(crackEnd, 5))
  })

  it('crack duration is fixed regardless of decayS', () => {
    const ctxA = makeMockContext()
    const ctxB = makeMockContext()
    schedule(ctxA, { decayS: 0.050 })
    schedule(ctxB, { decayS: 0.500 })

    const endA = ctxA._gainNodes[1].gain.exponentialRampToValueAtTime.mock.calls[0][1] as number
    const endB = ctxB._gainNodes[1].gain.exponentialRampToValueAtTime.mock.calls[0][1] as number
    expect(endA).toBeCloseTo(endB, 5)
  })
})

// ── rattle layer ─────────────────────────────────────────
describe('rattle layer', () => {
  let ctx: MockContext

  beforeEach(() => { ctx = makeMockContext() })

  it('starts at ENVELOPE_FLOOR', () => {
    const { rattleGain } = schedule(ctx)
    expect(rattleGain.gain.setValueAtTime).toHaveBeenCalledWith(ENVELOPE_FLOOR, expect.any(Number))
  })

  it('peaks at RATTLE_PEAK_GAIN (zero attack mix)', () => {
    const { rattleGain } = schedule(ctx, { attackS: 0.001 })
    expect(rattleGain.gain.linearRampToValueAtTime)
      .toHaveBeenCalledWith(expect.closeTo(RATTLE_PEAK_GAIN, 3), expect.any(Number))
  })

  it('peak is reduced when attack is longer', () => {
    const ctxShort = makeMockContext()
    const ctxLong  = makeMockContext()
    schedule(ctxShort, { attackS: 0.001 })
    schedule(ctxLong,  { attackS: 0.030 })

    const peakShort = ctxShort._gainNodes[2].gain.linearRampToValueAtTime.mock.calls[0][0] as number
    const peakLong  = ctxLong._gainNodes[2].gain.linearRampToValueAtTime.mock.calls[0][0] as number
    expect(peakShort).toBeGreaterThan(peakLong)
  })

  it('rattle duration grows with decayS', () => {
    const ctxA = makeMockContext()
    const ctxB = makeMockContext()
    schedule(ctxA, { decayS: 0.100 })
    schedule(ctxB, { decayS: 0.400 })

    const endA = ctxA._gainNodes[2].gain.exponentialRampToValueAtTime.mock.calls[0][1] as number
    const endB = ctxB._gainNodes[2].gain.exponentialRampToValueAtTime.mock.calls[0][1] as number
    expect(endB).toBeGreaterThan(endA)
  })

  it('rattle lasts longer than the tone snap', () => {
    const attackS = 0.001
    const decayS  = 0.150
    const { toneGain, rattleGain } = schedule(ctx, { attackS, decayS })

    const toneSnapTime   = toneGain.gain.exponentialRampToValueAtTime.mock.calls[0][1] as number
    const rattleReleaseTime = rattleGain.gain.exponentialRampToValueAtTime.mock.calls[0][1] as number
    expect(rattleReleaseTime).toBeGreaterThan(toneSnapTime)
  })

  it('rattle ends at ENVELOPE_FLOOR', () => {
    const { rattleGain } = schedule(ctx)
    const calls = rattleGain.gain.exponentialRampToValueAtTime.mock.calls
    expect(calls[0][0]).toBeCloseTo(ENVELOPE_FLOOR, 5)
  })

  it('rattle has a minimum duration even at very short decayS', () => {
    const { rattleGain } = schedule(ctx, { attackS: 0.001, decayS: 0.001 })
    const releaseTime = rattleGain.gain.exponentialRampToValueAtTime.mock.calls[0][1] as number
    // minimum rattle = 0.05s + attackS
    expect(releaseTime).toBeGreaterThanOrEqual(0.05)
  })
})

// ── layer separation ─────────────────────────────────────
describe('layer separation', () => {
  it('creates exactly 3 gain nodes (tone, crack, rattle)', () => {
    const ctx = makeMockContext()
    schedule(ctx)
    expect(ctx.createGain).toHaveBeenCalledTimes(3)
  })

  it('tone snap is faster than rattle duration at any decayS', () => {
    for (const decayS of [0.05, 0.15, 0.30, 0.50]) {
      const c = makeMockContext()
      const { toneGain, rattleGain } = schedule(c, { attackS: 0.001, decayS })
      const snap    = toneGain.gain.exponentialRampToValueAtTime.mock.calls[0][1] as number
      const rattle  = rattleGain.gain.exponentialRampToValueAtTime.mock.calls[0][1] as number
      expect(snap).toBeLessThan(rattle)
    }
  })

  it('all three gain nodes connect to the master gainNode', () => {
    const ctx = makeMockContext()
    const { toneGain, crackGain, rattleGain, masterGain } = schedule(ctx)
    expect(toneGain.connect).toHaveBeenCalledWith(masterGain)
    expect(crackGain.connect).toHaveBeenCalledWith(masterGain)
    expect(rattleGain.connect).toHaveBeenCalledWith(masterGain)
  })
})
