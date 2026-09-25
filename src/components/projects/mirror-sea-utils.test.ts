import { describe, expect, it } from "vitest"
import {
  PANEL_HEIGHT,
  PANEL_WIDTH,
  cameraBasis,
  dot,
  ggx,
  hitPanel,
  hitSea,
  horizonDip,
  length,
  panelScreenRect,
  pitchForHorizon,
  rayDirection,
  screenToSea,
  worldToScreen,
} from "./mirror-sea-utils"
import type { SeaCamera, Vec3 } from "./mirror-sea-utils"

const camera = (overrides: Partial<SeaCamera> = {}): SeaCamera => ({
  x: -7,
  y: 5.5,
  z: 32,
  yaw: 0,
  pitch: 0.1,
  roll: 0,
  fov: 0.63,
  aspect: 1.6,
  curvature: 0,
  ...overrides,
})

/** Screen height (0 = top) of the horizon in the middle column, found by bisection. */
function horizonScreenY(cam: SeaCamera): number {
  let top = -2
  let bottom = 3
  for (let i = 0; i < 60; i++) {
    const mid = (top + bottom) / 2
    if (hitSea(cam, rayDirection(cam, 0.5, mid))) bottom = mid
    else top = mid
  }
  return (top + bottom) / 2
}

describe("cameraBasis", () => {
  it("is orthonormal at any angle", () => {
    const { forward, right, up } = cameraBasis({ yaw: 0.4, pitch: 0.7, roll: 0.2 })
    for (const v of [forward, right, up]) expect(length(v)).toBeCloseTo(1)
    expect(dot(forward, right)).toBeCloseTo(0)
    expect(dot(forward, up)).toBeCloseTo(0)
    expect(dot(right, up)).toBeCloseTo(0)
  })

  it("looks toward −z, level, at yaw and pitch 0", () => {
    const { forward, up } = cameraBasis({ yaw: 0, pitch: 0, roll: 0 })
    expect(forward.z).toBeCloseTo(-1)
    expect(up.y).toBeCloseTo(1)
  })
})

describe("screenToSea / worldToScreen", () => {
  it("round-trips a screen point through the water", () => {
    const cam = camera()
    const p = screenToSea(cam, 0.3, 0.8)
    expect(p).not.toBeNull()
    const back = worldToScreen(cam, p as Vec3)
    expect(back?.sx).toBeCloseTo(0.3)
    expect(back?.sy).toBeCloseTo(0.8)
  })

  it("misses the water above the horizon", () => {
    expect(screenToSea(camera(), 0.5, 0.05)).toBeNull()
  })

  it("returns null for points behind the camera", () => {
    expect(worldToScreen(camera(), { x: 0, y: 0, z: 500 })).toBeNull()
  })

  it("bends the water down with curvature", () => {
    // From 1,200 m the curved horizon dips ~32°, so look further down than that
    const curved = screenToSea(
      camera({ y: 1200, pitch: 0.75, curvature: 1 / 6000 }),
      0.5,
      0.6
    )
    expect(curved).not.toBeNull()
    expect(curved!.y).toBeLessThan(0)
  })
})

describe("pitchForHorizon", () => {
  it("puts a flat sea's horizon where asked", () => {
    for (const y of [0.25, 0.35, 0.744]) {
      const cam = camera({ pitch: pitchForHorizon(y, 0.63, 5.5, 0) })
      expect(horizonScreenY(cam)).toBeCloseTo(y, 3)
    }
  })

  it("accounts for a curved horizon's dip", () => {
    const cam = camera({ y: 1200, curvature: 1 / 6000 })
    cam.pitch = pitchForHorizon(0.744, cam.fov, cam.y, cam.curvature)
    expect(horizonScreenY(cam)).toBeCloseTo(0.744, 2)
  })

  it("dips more the higher and more curved", () => {
    expect(horizonDip(100, 0)).toBe(0)
    expect(horizonDip(1200, 1 / 6000)).toBeGreaterThan(horizonDip(100, 1 / 6000))
  })
})

describe("ggx", () => {
  it("peaks at alignment", () => {
    expect(ggx(1, 0.1)).toBeGreaterThan(ggx(0.99, 0.1))
    expect(ggx(-1, 0.1)).toBe(ggx(0, 0.1))
  })
})

describe("hitPanel", () => {
  const panel = { x: 0, yaw: 0, rise: 1 }
  const eye = { x: 0, y: 4, z: 30 }

  it("hits the middle of a screen straight on", () => {
    const hit = hitPanel(eye, { x: 0, y: 0.5 / 30, z: -1 }, panel)
    expect(hit?.t).toBeCloseTo(30, 0)
    expect(hit?.u).toBeCloseTo(0.5)
    expect(hit?.v).toBeCloseTo(4.5 / PANEL_HEIGHT, 1)
  })

  it("misses beside, above and under the water", () => {
    expect(
      hitPanel(eye, { x: (PANEL_WIDTH / 2 + 1) / 30, y: 0, z: -1 }, panel)
    ).toBeNull()
    expect(hitPanel(eye, { x: 0, y: 6 / 30, z: -1 }, panel)).toBeNull()
    expect(hitPanel(eye, { x: 0, y: -5 / 30, z: -1 }, panel)).toBeNull()
  })

  it("shows only what has risen, the picture rising with it", () => {
    const half = { ...panel, rise: 0.5 }
    expect(hitPanel(eye, { x: 0, y: 1 / 30, z: -1 }, half)).toBeNull() // 5 m up: still under
    const low = hitPanel(eye, { x: 0, y: -2 / 30, z: -1 }, half) // 2 m up
    expect(low?.v).toBeCloseTo((2 - (4.5 - PANEL_HEIGHT)) / PANEL_HEIGHT, 1)
  })

  it("turns with its yaw", () => {
    const turned = { ...panel, yaw: 0.3 }
    const hit = hitPanel(eye, { x: 0.1, y: 0, z: -1 }, turned)
    expect(hit).not.toBeNull()
    expect(hit!.u).not.toBeCloseTo(hitPanel(eye, { x: 0.1, y: 0, z: -1 }, panel)!.u, 2)
  })
})

describe("panelScreenRect", () => {
  it("frames the screen's corners on the view", () => {
    const cam = camera()
    const rect = panelScreenRect(cam, { x: 0, yaw: 0, rise: 1 })
    expect(rect).not.toBeNull()
    expect(rect!.left).toBeLessThan(rect!.right)
    expect(rect!.top).toBeLessThan(rect!.bottom)
    const middle = worldToScreen(cam, { x: 0, y: PANEL_HEIGHT / 2, z: 0 })!
    expect(middle.sx).toBeGreaterThan(rect!.left)
    expect(middle.sx).toBeLessThan(rect!.right)
  })
})
