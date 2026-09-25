import { render } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { orbitPoint, useOrbits } from "./use-orbits"
import type { Dock, Orbit } from "./use-orbits"

const FLAT: Orbit = { rx: 0.5, ry: 0.25, tilt: 0, speed: 1, phase: 0 }

describe("orbitPoint", () => {
  it("starts on the right of the ellipse", () => {
    const p = orbitPoint(0, FLAT, 400, 200)
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeCloseTo(0)
  })

  it("reaches the front (depth 1) a quarter turn later", () => {
    const p = orbitPoint(Math.PI / 2, FLAT, 400, 200)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(25)
    expect(p.depth).toBeCloseTo(1)
  })

  it("is at the back (depth -1) on the other side", () => {
    expect(orbitPoint(-Math.PI / 2, FLAT, 400, 200).depth).toBeCloseTo(-1)
  })

  it("tilts the ellipse", () => {
    const tilted = orbitPoint(0, { ...FLAT, tilt: Math.PI / 2 }, 400, 400)
    expect(tilted.x).toBeCloseTo(0)
    expect(tilted.y).toBeCloseTo(100)
  })
})

// ── useOrbits ─────────────────────────────────────────────────────────────────

let frames: FrameRequestCallback[] = []
let now = 0
const runFrame = () => {
  now += 16
  const pending = frames
  frames = []
  pending.forEach((cb) => cb(now))
}

const ORBITS: Orbit[] = [FLAT]
const DOCKS: Dock[] = [{ x: -0.5, y: -0.5 }]

function Harness({ enabled, caught }: { enabled: boolean; caught: boolean }) {
  const { containerRef } = useOrbits<HTMLDivElement>({
    orbits: ORBITS,
    docks: DOCKS,
    enabled,
  })
  return (
    <div ref={containerRef}>
      <button type="button" data-orbit-index="0" data-caught={caught ? "" : undefined}>
        Satellite
      </button>
    </div>
  )
}

describe("useOrbits", () => {
  beforeEach(() => {
    frames = []
    now = 0
    vi.spyOn(performance, "now").mockImplementation(() => now)
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb)
      return frames.length
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("positions satellites with a transform when enabled", () => {
    const { getByRole } = render(<Harness enabled caught={false} />)
    runFrame()
    expect(getByRole("button").style.transform).toContain("translate3d")
  })

  it("leaves satellites alone when disabled", () => {
    const { getByRole } = render(<Harness enabled={false} caught={false} />)
    runFrame()
    expect(getByRole("button").style.transform).toBe("")
  })

  it("brings a caught satellite to full size and opacity at its dock", () => {
    const { getByRole } = render(<Harness enabled caught />)
    for (let i = 0; i < 200; i++) runFrame()
    const el = getByRole("button")
    expect(el.style.transform).toContain("scale(1.000)")
    expect(Number(el.style.opacity)).toBeCloseTo(1)
  })

  it("clears its styles on unmount", () => {
    const { getByRole, rerender } = render(<Harness enabled caught={false} />)
    runFrame()
    rerender(<Harness enabled={false} caught={false} />)
    expect(getByRole("button").style.transform).toBe("")
  })
})
