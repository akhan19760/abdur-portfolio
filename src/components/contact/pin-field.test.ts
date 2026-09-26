import { describe, expect, it } from "vitest"
import {
  HOLE,
  PIN_CHANNELS,
  PIN_PHYSICS,
  RELIEF_HEIGHT,
  createPinField,
  holeSink,
  pressSurface,
  riseAt,
  setRelief,
  setRevealOrigin,
  settlePins,
  shadePins,
  stepPins,
  strikePins,
} from "./pin-field"
import type { PinField, PinInput } from "./pin-field"

const COLS = 40
const ROWS = 30
const idx = (field: PinField, c: number, r: number) => r * field.cols + c
const still: PinInput = { reveal: 1, time: 0, press: null }
const LAMP_OFF = { col: 0, row: 0, height: 7, on: 0 }

/** Runs the pins for `seconds` at 60 fps. */
function run(field: PinField, seconds: number, input: PinInput = still) {
  for (let t = 0; t < seconds; t += 1 / 60) stepPins(field, 1 / 60, { ...input, time: t })
}

/** A square of letter pins (coverage 1) in an otherwise empty wall. */
function block(field: PinField, c0: number, r0: number, size: number) {
  const coverage = new Float32Array(field.cols * field.rows)
  for (let r = r0; r < r0 + size; r++)
    for (let c = c0; c < c0 + size; c++) coverage[idx(field, c, r)] = 1
  setRelief(field, coverage)
}

describe("createPinField", () => {
  it("makes a flat, still wall of the given size", () => {
    const field = createPinField(COLS, ROWS)
    expect(field.height).toHaveLength(COLS * ROWS)
    expect(field.height.every((h) => h === 0)).toBe(true)
    expect(field.velocity.every((v) => v === 0)).toBe(true)
    expect(field.relief.every((v) => v === 0)).toBe(true)
  })

  it("starts the letters rising from the middle", () => {
    const field = createPinField(COLS, ROWS)
    const middle = idx(field, Math.round((COLS - 1) / 2), Math.round((ROWS - 1) / 2))
    expect(field.reach[middle]).toBeLessThan(1)
    expect(field.maxReach).toBeCloseTo(Math.hypot((COLS - 1) / 2, (ROWS - 1) / 2), 3)
  })
})

describe("setRelief", () => {
  it("takes each pin's coverage, clamped to 0–1", () => {
    const field = createPinField(COLS, ROWS)
    const coverage = new Float32Array(COLS * ROWS)
    coverage[0] = 0.5
    coverage[1] = 3
    coverage[2] = -1
    setRelief(field, coverage)
    expect(Array.from(field.relief.slice(0, 3))).toEqual([0.5, 1, 0])
  })

  it("clears the letters for null or a drawing of the wrong size", () => {
    const field = createPinField(COLS, ROWS)
    block(field, 5, 5, 3)
    setRelief(field, null)
    expect(field.relief.every((v) => v === 0)).toBe(true)
    block(field, 5, 5, 3)
    setRelief(field, new Float32Array(10).fill(1))
    expect(field.relief.every((v) => v === 0)).toBe(true)
  })
})

describe("riseAt", () => {
  it("is 0 before the reveal and 1 once it's done", () => {
    expect(riseAt(0, 0, 50)).toBe(0)
    expect(riseAt(50, 1, 50)).toBe(1)
  })

  it("reaches pins near the origin before pins far from it", () => {
    const near = riseAt(2, 0.3, 50)
    const far = riseAt(40, 0.3, 50)
    expect(near).toBeGreaterThan(far)
    expect(near).toBeGreaterThan(0)
  })

  it("never goes down as the reveal goes on", () => {
    let before = 0
    for (let reveal = 0; reveal <= 1; reveal += 0.05) {
      const now = riseAt(20, reveal, 50)
      expect(now).toBeGreaterThanOrEqual(before)
      before = now
    }
  })
})

describe("setRevealOrigin", () => {
  it("measures every pin's distance from the new origin", () => {
    const field = createPinField(COLS, ROWS)
    setRevealOrigin(field, 0, 0)
    expect(field.reach[0]).toBe(0)
    expect(field.reach[idx(field, 3, 4)]).toBeCloseTo(5)
    expect(field.maxReach).toBeCloseTo(Math.hypot(COLS - 1, ROWS - 1))
  })
})

describe("pressSurface", () => {
  const press = { col: 10, row: 10, radius: 5, depth: 2 }

  it("is deepest in the middle and rises toward the rim", () => {
    expect(pressSurface(press, 0)).toBe(-2)
    expect(pressSurface(press, 2.5)).toBeGreaterThan(-2)
    expect(pressSurface(press, 4.9)).toBeGreaterThan(RELIEF_HEIGHT)
  })

  it("doesn't reach past its rim", () => {
    expect(pressSurface(press, 5)).toBe(Infinity)
  })
})

describe("stepPins", () => {
  it("does nothing for no time, or time that isn't a number", () => {
    const field = createPinField(COLS, ROWS)
    expect(stepPins(field, 0, still)).toBe(0)
    expect(stepPins(field, Number.NaN, still)).toBe(0)
  })

  it("splits a frame into fixed steps, up to a cap", () => {
    const field = createPinField(COLS, ROWS)
    expect(stepPins(field, 1 / 60, still)).toBe(2)
    expect(stepPins(field, 5, still)).toBe(PIN_PHYSICS.maxSteps)
  })

  it("pushes a letter's pins out once the reveal has passed them", () => {
    const field = createPinField(COLS, ROWS)
    block(field, 15, 10, 6)
    run(field, 4)
    expect(field.height[idx(field, 17, 12)]).toBeCloseTo(RELIEF_HEIGHT, 0)
    expect(Math.abs(field.height[idx(field, 2, 2)])).toBeLessThan(0.3)
  })

  it("keeps the letters in before the reveal", () => {
    const field = createPinField(COLS, ROWS)
    block(field, 15, 10, 6)
    run(field, 2, { reveal: 0, time: 0, press: null })
    expect(Math.abs(field.height[idx(field, 17, 12)])).toBeLessThan(0.3)
  })

  it("pushes pins back under the fingertip", () => {
    const field = createPinField(COLS, ROWS)
    const press = { col: 20, row: 15, radius: 5, depth: 2 }
    run(field, 0.5, { reveal: 1, time: 0, press })
    const middle = field.height[idx(field, 20, 15)]
    expect(middle).toBeLessThanOrEqual(-2 + 1e-6)
    // …and they spring back once it's gone
    run(field, 4)
    expect(Math.abs(field.height[idx(field, 20, 15)])).toBeLessThan(0.3)
  })

  it("settles down after a strike instead of blowing up", () => {
    const field = createPinField(COLS, ROWS)
    strikePins(field, 20, 15, 60, 2.4)
    run(field, 12)
    const worst = field.height.reduce((m, h) => Math.max(m, Math.abs(h)), 0)
    expect(Number.isFinite(worst)).toBe(true)
    expect(worst).toBeLessThan(0.35) // just the swell left
  })
})

describe("strikePins", () => {
  it("drives the pins in, most at the middle", () => {
    const field = createPinField(COLS, ROWS)
    strikePins(field, 20, 15, 30, 2)
    expect(field.velocity[idx(field, 20, 15)]).toBeCloseTo(-30)
    expect(field.velocity[idx(field, 22, 15)]).toBeGreaterThan(-30)
    expect(field.velocity[idx(field, 22, 15)]).toBeLessThan(0)
    expect(field.velocity[idx(field, 0, 0)]).toBe(0)
  })

  it("sends a ring outward: pins further out move later", () => {
    const field = createPinField(COLS, ROWS)
    const calm = { reveal: 0, time: 0, press: null }
    settlePins(field, calm)
    strikePins(field, 20, 15, 40, 1.5)
    // How far each pin is from where it would be at rest (the swell moves too)
    const moved = (c: number, r: number) =>
      Math.abs(field.height[idx(field, c, r)] - field.rest[idx(field, c, r)])
    run(field, 0.25, calm)
    expect(moved(24, 15)).toBeGreaterThan(0.05)
    expect(moved(24, 15)).toBeGreaterThan(moved(38, 15) * 5)
  })

  it("stays inside the wall at its edges", () => {
    const field = createPinField(COLS, ROWS)
    expect(() => strikePins(field, 0, 0, 30, 3)).not.toThrow()
    expect(() => strikePins(field, -50, 200, 30, 3)).not.toThrow()
  })
})

describe("settlePins", () => {
  it("puts every pin at rest where it belongs", () => {
    const field = createPinField(COLS, ROWS)
    block(field, 15, 10, 6)
    strikePins(field, 5, 5, 30, 2)
    settlePins(field, still)
    expect(field.velocity.every((v) => v === 0)).toBe(true)
    expect(field.height[idx(field, 17, 12)]).toBeCloseTo(RELIEF_HEIGHT, 0)
  })
})

describe("shadePins", () => {
  const out = () => new Float32Array(COLS * ROWS * PIN_CHANNELS)

  it("writes each pin's height and speed", () => {
    const field = createPinField(COLS, ROWS)
    field.height[idx(field, 3, 4)] = 1.5
    field.velocity[idx(field, 3, 4)] = -2
    const data = shadePins(field, LAMP_OFF, out())
    const o = idx(field, 3, 4) * PIN_CHANNELS
    expect(data[o]).toBeCloseTo(1.5)
    expect(data[o + 3]).toBeCloseTo(2)
  })

  it("leaves an open, flat wall fully lit", () => {
    const field = createPinField(COLS, ROWS)
    const data = shadePins(field, LAMP_OFF, out())
    expect(data[idx(field, 20, 15) * PIN_CHANNELS + 1]).toBe(1)
    expect(data[idx(field, 20, 15) * PIN_CHANNELS + 2]).toBe(0)
  })

  it("shades pins down and to the right of a letter (the soft light is top left)", () => {
    const field = createPinField(COLS, ROWS)
    block(field, 15, 10, 6)
    settlePins(field, { ...still, time: 0 })
    field.height.set(field.height.map((h) => Math.max(0, Math.round(h))))
    const data = shadePins(field, LAMP_OFF, out())
    const below = data[idx(field, 21, 16) * PIN_CHANNELS + 1]
    const above = data[idx(field, 13, 8) * PIN_CHANNELS + 1]
    expect(below).toBeLessThan(above)
  })

  it("shades pins behind a letter from the cursor's light, not those in front of it", () => {
    const field = createPinField(COLS, ROWS)
    block(field, 18, 10, 4) // columns 18–21
    field.height.set(field.relief.map((v) => v * RELIEF_HEIGHT))
    const lamp = { col: 10, row: 12, height: 3, on: 1 }
    const data = shadePins(field, lamp, out())
    const behind = data[idx(field, 23, 12) * PIN_CHANNELS + 2]
    const front = data[idx(field, 16, 12) * PIN_CHANNELS + 2]
    expect(behind).toBeGreaterThan(0.5)
    expect(front).toBe(0)
  })

  it("leaves the cursor's shadows out while its light is off", () => {
    const field = createPinField(COLS, ROWS)
    block(field, 18, 10, 4)
    field.height.set(field.relief.map((v) => v * RELIEF_HEIGHT))
    const data = shadePins(field, { col: 10, row: 12, height: 3, on: 0 }, out())
    expect(data[idx(field, 23, 12) * PIN_CHANNELS + 2]).toBe(0)
  })
})

describe("the hole", () => {
  it("is fully sunk inside, not at all outside, and soft at its edge", () => {
    expect(holeSink(0, 20)).toBe(1)
    expect(holeSink(20, 20)).toBe(0)
    expect(holeSink(30, 20)).toBe(0)
    const edge = holeSink(20 - HOLE.band / 2, 20)
    expect(edge).toBeGreaterThan(0)
    expect(edge).toBeLessThan(1)
    expect(holeSink(0, 0)).toBe(0)
  })

  it("takes the pins inside it right back into the wall, at once, letters and all", () => {
    const field = createPinField(COLS, ROWS)
    block(field, 17, 12, 6)
    settlePins(field, still)
    const hole = { col: 20, row: 15, radius: 10 }
    stepPins(field, 1 / 60, { ...still, hole })
    expect(field.height[idx(field, 20, 15)]).toBeLessThanOrEqual(HOLE.depth + 1e-6)
    expect(field.height[idx(field, 18, 13)]).toBeLessThanOrEqual(HOLE.depth + 1e-6)
    // Well outside it, the wall is as it was
    expect(Math.abs(field.height[idx(field, 2, 2)])).toBeLessThan(0.3)
  })

  it("closes again when it shrinks away (scrolling back up)", () => {
    const field = createPinField(COLS, ROWS)
    stepPins(field, 1 / 60, { ...still, hole: { col: 20, row: 15, radius: 10 } })
    run(field, 4)
    expect(Math.abs(field.height[idx(field, 20, 15)])).toBeLessThan(0.3)
  })
})
