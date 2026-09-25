import { describe, it, expect } from "vitest"
import {
  dispersalAt,
  fibonacciSphere,
  centreDimming,
  formationBlend,
  galaxyFormation,
  helixFormation,
  horizonFormation,
  randomSpreads,
  ringsFormation,
  seededRandom,
  shellCloudFormation,
  staggeredMorph,
  toNdc,
  writeShellPositions,
} from "./signal-core-utils"

describe("fibonacciSphere", () => {
  it("returns count × 3 components", () => {
    expect(fibonacciSphere(50)).toHaveLength(150)
  })

  it("returns unit vectors", () => {
    const dirs = fibonacciSphere(40)
    for (let i = 0; i < 40; i++) {
      const len = Math.hypot(dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2])
      expect(len).toBeCloseTo(1, 5)
    }
  })

  it("spans pole to pole", () => {
    const dirs = fibonacciSphere(10)
    expect(dirs[1]).toBeCloseTo(1)
    expect(dirs[9 * 3 + 1]).toBeCloseTo(-1)
  })

  it("handles a single point", () => {
    expect(Array.from(fibonacciSphere(1))).toEqual([1, 0, 0])
  })

  it("handles zero points", () => {
    expect(fibonacciSphere(0)).toHaveLength(0)
  })
})

describe("randomSpreads", () => {
  it("stays within [min, max]", () => {
    const spreads = randomSpreads(100, 2, 7)
    spreads.forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(2)
      expect(s).toBeLessThanOrEqual(7)
    })
  })

  it("uses the injected random source", () => {
    expect(Array.from(randomSpreads(2, 0, 10, () => 0.5))).toEqual([5, 5])
  })
})

describe("writeShellPositions", () => {
  const dirs = new Float32Array([1, 0, 0, 0, 1, 0])
  const spreads = new Float32Array([2, 4])

  it("places points on the shell radius when intact", () => {
    const out = new Float32Array(6)
    writeShellPositions(out, dirs, spreads, 3, 0)
    expect(Array.from(out)).toEqual([3, 0, 0, 0, 3, 0])
  })

  it("pushes each point out by its own spread when dispersed", () => {
    const out = new Float32Array(6)
    writeShellPositions(out, dirs, spreads, 3, 1)
    expect(Array.from(out)).toEqual([5, 0, 0, 0, 7, 0])
  })
})

describe("dispersalAt", () => {
  it("is 0 before the start", () => {
    expect(dispersalAt(0.5)).toBe(0)
  })

  it("is 1 after the end", () => {
    expect(dispersalAt(1)).toBe(1)
  })

  it("is 0.5 at the midpoint", () => {
    expect(dispersalAt(0.5, 0, 1)).toBeCloseTo(0.5)
  })

  it("handles a zero-length range", () => {
    expect(dispersalAt(0.4, 0.5, 0.5)).toBe(0)
    expect(dispersalAt(0.6, 0.5, 0.5)).toBe(1)
  })
})

describe("toNdc", () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 }

  it("maps the centre to (0, 0)", () => {
    const { x, y } = toNdc(100, 50, rect)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0) // -0 from the y flip; equal to 0 for rendering
  })

  it("maps top-left to (-1, 1)", () => {
    expect(toNdc(0, 0, rect)).toEqual({ x: -1, y: 1 })
  })

  it("clamps points far outside the rect", () => {
    expect(toNdc(10_000, -10_000, rect)).toEqual({ x: 1.2, y: 1.2 })
  })

  it("returns the origin for an empty rect", () => {
    expect(toNdc(5, 5, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 })
  })
})

describe("seededRandom", () => {
  it("is deterministic for a seed", () => {
    const a = seededRandom(7)
    const b = seededRandom(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it("stays in [0, 1)", () => {
    const r = seededRandom(1)
    for (let i = 0; i < 500; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe("formations", () => {
  it("galaxy: a flat-ish disc within its radius", () => {
    const g = galaxyFormation(400, seededRandom(1), 3, 8)
    for (let i = 0; i < 400; i++) {
      expect(Math.hypot(g[i * 3], g[i * 3 + 2])).toBeLessThanOrEqual(8.5)
      expect(Math.abs(g[i * 3 + 1])).toBeLessThan(0.5)
    }
  })

  it("helix: within its radius and height", () => {
    const h = helixFormation(400, seededRandom(2), 10, 2)
    for (let i = 0; i < 400; i++) {
      expect(Math.hypot(h[i * 3], h[i * 3 + 2])).toBeLessThanOrEqual(2.2)
      expect(Math.abs(h[i * 3 + 1])).toBeLessThanOrEqual(5.1)
    }
  })

  it("rings: points on a ring or in the halo", () => {
    const r = ringsFormation(400, seededRandom(3), [3, 4], 0.2, 0.1)
    for (let i = 0; i < 400; i++) {
      const d = Math.hypot(r[i * 3], r[i * 3 + 1], r[i * 3 + 2])
      const onRing = Math.abs(d - 3) < 0.2 || Math.abs(d - 4) < 0.2
      const inHalo = d < 2.6
      expect(onRing || inHalo).toBe(true)
    }
  })

  it("return count x 3 components", () => {
    expect(galaxyFormation(10, seededRandom(1))).toHaveLength(30)
    expect(helixFormation(10, seededRandom(1))).toHaveLength(30)
    expect(ringsFormation(10, seededRandom(1))).toHaveLength(30)
  })
})

describe("formationBlend", () => {
  const windows: [number, number][] = [
    [0.1, 0.2],
    [0.4, 0.5],
    [0.7, 0.8],
  ]

  it("holds the first formation before and during its window", () => {
    expect(formationBlend(0, windows)).toEqual({ from: 0, to: 0, t: 0 })
    expect(formationBlend(0.15, windows)).toEqual({ from: 0, to: 0, t: 0 })
  })

  it("morphs between windows", () => {
    const b = formationBlend(0.3, windows)
    expect(b.from).toBe(0)
    expect(b.to).toBe(1)
    expect(b.t).toBeCloseTo(0.5)
  })

  it("holds within a later window", () => {
    expect(formationBlend(0.45, windows)).toEqual({ from: 1, to: 1, t: 0 })
  })

  it("holds the last formation after its window", () => {
    expect(formationBlend(0.95, windows)).toEqual({ from: 2, to: 2, t: 0 })
  })

  it("handles no windows", () => {
    expect(formationBlend(0.5, [])).toEqual({ from: 0, to: 0, t: 0 })
  })
})

describe("staggeredMorph", () => {
  it("goes from 0 to 1", () => {
    expect(staggeredMorph(0, 0.5)).toBe(0)
    expect(staggeredMorph(1, 0.5)).toBe(1)
  })

  it("lets points with a later delay set off later", () => {
    expect(staggeredMorph(0.3, 0)).toBeGreaterThan(staggeredMorph(0.3, 1))
  })
})

describe("shellCloudFormation", () => {
  it("puts its shell share on the shell and the rest far out", () => {
    const f = shellCloudFormation(200, seededRandom(4), 0.25, 2, 5, 10)
    for (let i = 0; i < 200; i++) {
      const d = Math.hypot(f[i * 3], f[i * 3 + 1], f[i * 3 + 2])
      if (i < 50) expect(d).toBeCloseTo(2, 0)
      else {
        expect(d).toBeGreaterThanOrEqual(5)
        expect(d).toBeLessThanOrEqual(10)
      }
    }
  })
})

describe("horizonFormation", () => {
  it("keeps every point on or inside the planet, below the rim", () => {
    const radius = 16
    const rimY = -1.6
    const f = horizonFormation(300, seededRandom(5), radius, rimY)
    for (let i = 0; i < 300; i++) {
      const d = Math.hypot(f[i * 3], f[i * 3 + 1] - (rimY - radius))
      expect(d).toBeLessThanOrEqual(radius + 1e-6)
      expect(d).toBeGreaterThanOrEqual(radius - 2.2 - 1e-6)
      expect(f[i * 3 + 1]).toBeLessThanOrEqual(rimY + 1e-6)
    }
  })
})

describe("centreDimming", () => {
  it("is dim at the centre and full strength further out", () => {
    expect(centreDimming(0)).toBeCloseTo(0.2)
    expect(centreDimming(5)).toBe(1)
  })

  it("brightens smoothly in between", () => {
    expect(centreDimming(1.5)).toBeGreaterThan(centreDimming(1))
    expect(centreDimming(1.5)).toBeLessThan(1)
  })
})
