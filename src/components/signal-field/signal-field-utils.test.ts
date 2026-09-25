import { describe, it, expect } from "vitest"
import {
  depthFade,
  project,
  smoothstep,
  travelForScroll,
  wrapDepth,
} from "./signal-field-utils"

describe("smoothstep", () => {
  it("clamps to 0 and 1 outside the edges", () => {
    expect(smoothstep(0, 10, -5)).toBe(0)
    expect(smoothstep(0, 10, 15)).toBe(1)
  })

  it("is 0.5 at the midpoint", () => {
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5)
  })

  it("steps when the edges are equal", () => {
    expect(smoothstep(3, 3, 2)).toBe(0)
    expect(smoothstep(3, 3, 3)).toBe(1)
  })
})

describe("wrapDepth", () => {
  it("returns the distance in front of the camera", () => {
    expect(wrapDepth(500, 100, 1000)).toBe(400)
  })

  it("wraps points behind the camera to the far end", () => {
    expect(wrapDepth(100, 300, 1000)).toBe(800)
  })

  it("wraps across several tunnel lengths", () => {
    expect(wrapDepth(100, 5300, 1000)).toBe(800)
  })

  it("never returns 0", () => {
    expect(wrapDepth(1000, 1000, 1000)).toBe(1000)
  })
})

describe("travelForScroll", () => {
  it("starts at 0", () => {
    expect(travelForScroll(0, 900)).toBe(0)
  })

  it("only moves forward as the page scrolls down", () => {
    let prev = -1
    for (let y = 0; y <= 3000; y += 50) {
      const z = travelForScroll(y, 900)
      expect(z).toBeGreaterThan(prev)
      prev = z
    }
  })

  it("adds the full warp once past the handoff", () => {
    expect(travelForScroll(2000, 900, 1, 1600)).toBe(2000 + 1600)
  })
})

describe("project", () => {
  it("puts the centre line on the vanishing point", () => {
    expect(project(0, 0, 500, 500, 100, 50)).toEqual({ sx: 100, sy: 50, scale: 1 })
  })

  it("pushes points outward as they get closer", () => {
    const far = project(10, 0, 1000, 500, 0, 0)
    const near = project(10, 0, 100, 500, 0, 0)
    expect(near.sx).toBeGreaterThan(far.sx)
    expect(near.scale).toBeGreaterThan(far.scale)
  })

  it("guards against a zero distance", () => {
    expect(Number.isFinite(project(1, 1, 0, 500, 0, 0).scale)).toBe(true)
  })
})

describe("depthFade", () => {
  it("is 0 right in front of the camera", () => {
    expect(depthFade(10, 2000)).toBe(0)
  })

  it("is 1 at mid-depth", () => {
    expect(depthFade(800, 2000)).toBe(1)
  })

  it("is 0 at the far end", () => {
    expect(depthFade(2000, 2000)).toBe(0)
  })
})
