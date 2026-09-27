import { describe, expect, it, vi } from "vitest"
import { SEA_EXIT, seaPhases } from "@/hooks/projects"
import { hitSea, panelScreenRect, rayDirection } from "./mirror-sea-utils"
import type { SeaCamera } from "./mirror-sea-utils"
import { paperScreen } from "@/lib/stage-framing"
import {
  ABOUT_HORIZON_Y,
  HORIZON_Y,
  PAPER_LANDING,
  holdCamera,
  seaStateAt,
  siteX,
} from "./sea-choreography"

// ScrollTrigger (imported through the hooks barrel) calls matchMedia on register.
vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
})

const PHASES = seaPhases(4)
const ASPECT = 1.6

function horizonScreenY(cam: SeaCamera, sx = 0.5): number {
  let top = -2
  let bottom = 3
  for (let i = 0; i < 60; i++) {
    const mid = (top + bottom) / 2
    if (hitSea(cam, rayDirection(cam, sx, mid))) bottom = mid
    else top = mid
  }
  return (top + bottom) / 2
}

describe("seaStateAt", () => {
  it("keeps the sea's horizon on About's as About's stage starts to leave", () => {
    for (const u of [0, 0.1, 0.2, 0.28]) {
      const { camera } = seaStateAt(u, PHASES, ASPECT)
      expect(horizonScreenY(camera)).toBeCloseTo(ABOUT_HORIZON_Y - u, 2)
    }
  })

  it("curves the horizon down at the edges at first, like About's planet", () => {
    const { camera } = seaStateAt(0, PHASES, ASPECT)
    const droop = horizonScreenY(camera, 0.02) - horizonScreenY(camera, 0.5)
    expect(droop).toBeGreaterThan(0.06)
    expect(droop).toBeLessThan(0.18)
  })

  it("settles low over flat water with the horizon a third of the way down", () => {
    const { camera } = seaStateAt(PHASES.arrivals[0], PHASES, ASPECT)
    expect(camera.y).toBeLessThan(10)
    expect(camera.curvature).toBe(0)
    expect(horizonScreenY(camera)).toBeCloseTo(HORIZON_Y, 2)
  })

  it("rests beside each project while it's read, its screen fully up", () => {
    PHASES.arrivals.forEach((arrival, i) => {
      const u = (arrival + PHASES.holdEnds[i]) / 2
      const state = seaStateAt(u, PHASES, ASPECT)
      const hold = holdCamera(i, ASPECT)
      for (const key of Object.keys(hold) as (keyof SeaCamera)[]) {
        expect(state.camera[key]).toBeCloseTo(hold[key], 6)
      }
      expect(state.panels[i].rise).toBe(1)
      expect(state.active).toBe(i)
    })
  })

  it("stands each screen right of centre, clear of the text on the left", () => {
    const hold = holdCamera(1, ASPECT)
    const rect = panelScreenRect(hold, { x: siteX(1), yaw: 0, rise: 1 })
    expect(rect).not.toBeNull()
    expect(rect!.left).toBeGreaterThan(0.44)
    expect(rect!.right).toBeLessThan(0.98)
    expect(rect!.top).toBeGreaterThan(0.12)
    expect(rect!.bottom).toBeLessThan(0.75)
  })

  it("in portrait, stands each screen across the top of the view, text room below", () => {
    for (const aspect of [390 / 844, 390 / 664, 810 / 1080]) {
      const hold = holdCamera(1, aspect)
      const rect = panelScreenRect(hold, { x: siteX(1, aspect), yaw: 0, rise: 1 })
      expect(rect).not.toBeNull()
      expect(rect!.left).toBeGreaterThan(0.02)
      expect(rect!.right).toBeLessThan(0.98)
      expect(rect!.right - rect!.left).toBeGreaterThan(0.75)
      expect(rect!.top).toBeGreaterThan(0.1)
      expect(rect!.bottom).toBeLessThan(0.55)
    }
  })

  it("in portrait, keeps a screen in view through every glide too", () => {
    const aspect = 390 / 844
    for (let i = 1; i < PHASES.arrivals.length; i++) {
      for (let s = 0; s <= 1; s += 0.1) {
        const u =
          PHASES.holdEnds[i - 1] + s * (PHASES.arrivals[i] - PHASES.holdEnds[i - 1])
        const { camera, panels } = seaStateAt(u, PHASES, aspect)
        const onScreen = panels.some((panel) => {
          if (panel.rise < 0.15) return false
          const rect = panelScreenRect(camera, panel)
          return rect !== null && rect.right > 0.05 && rect.left < 0.95
        })
        expect(onScreen).toBe(true)
      }
    }
  })

  it("keeps later screens under water until the camera heads their way; earlier ones stay up", () => {
    const u = (PHASES.arrivals[2] + PHASES.holdEnds[2]) / 2
    const { panels } = seaStateAt(u, PHASES, ASPECT)
    expect(panels.map((p) => p.rise)).toEqual([1, 1, 1, 0])
  })

  it("keeps something on screen through every glide", () => {
    for (let i = 1; i < PHASES.arrivals.length; i++) {
      for (let s = 0; s <= 1; s += 0.1) {
        const u =
          PHASES.holdEnds[i - 1] + s * (PHASES.arrivals[i] - PHASES.holdEnds[i - 1])
        const { camera, panels } = seaStateAt(u, PHASES, ASPECT)
        const onScreen = panels.some((panel) => {
          if (panel.rise < 0.15) return false
          const rect = panelScreenRect(camera, panel)
          return rect !== null && rect.right > 0.05 && rect.left < 0.95
        })
        expect(onScreen).toBe(true)
      }
    }
  })

  it("glides sideways between projects, banking on the way", () => {
    const mid = (PHASES.holdEnds[0] + PHASES.arrivals[1]) / 2
    const { camera } = seaStateAt(mid, PHASES, ASPECT)
    expect(camera.x).toBeGreaterThan(holdCamera(0, ASPECT).x)
    expect(camera.x).toBeLessThan(holdCamera(1, ASPECT).x)
    expect(camera.roll).not.toBe(0)
  })

  it("moves smoothly the whole way", () => {
    let prev = seaStateAt(-0.3, PHASES, ASPECT).camera
    for (let u = -0.3; u < PHASES.total + 1; u += 0.01) {
      const { camera } = seaStateAt(u, PHASES, ASPECT)
      expect(Math.abs(camera.x - prev.x)).toBeLessThan(2)
      expect(Math.abs(camera.pitch - prev.pitch)).toBeLessThan(0.05)
      expect(Math.abs(camera.y - prev.y) / prev.y).toBeLessThan(0.12)
      prev = camera
    }
  })

  it("keeps the last screen up while it's read", () => {
    const end = seaStateAt(PHASES.total - 0.2, PHASES, ASPECT)
    expect(end.panels[3].rise).toBe(1)
    expect(end.active).toBe(3)
    expect(end.lookDown).toBe(0)
    expect(end.swell).toBe(1)
  })

  it("then sinks it and looks straight down at still water for Process's paper", () => {
    const down = seaStateAt(PHASES.total + PAPER_LANDING, PHASES, ASPECT)
    expect(down.panels.every((p) => p.rise === 0)).toBe(true)
    expect(down.lookDown).toBe(1)
    expect(down.camera.pitch).toBeCloseTo(Math.PI / 2)
    expect(down.swell).toBeLessThan(0.3)
    // The water is still there under the sheet as it lands
    expect(down.opacity).toBe(1)
    const landing = paperScreen(ASPECT)
    const under = rayDirection(down.camera, landing.sx, landing.sy)
    expect(hitSea(down.camera, under)).not.toBeNull()
  })

  it("fades in under About's horizon and out once the paper has landed", () => {
    expect(seaStateAt(-0.5, PHASES, ASPECT).opacity).toBe(0)
    expect(seaStateAt(0.5, PHASES, ASPECT).opacity).toBe(1)
    expect(seaStateAt(PHASES.total + 1.3, PHASES, ASPECT).opacity).toBeLessThan(1)
    expect(seaStateAt(PHASES.total + SEA_EXIT, PHASES, ASPECT).opacity).toBe(0)
  })

  it("hands the light over from the dawn to the cursor", () => {
    const start = seaStateAt(0, PHASES, ASPECT)
    const later = seaStateAt(1, PHASES, ASPECT)
    expect(start.dawn).toBe(1)
    expect(start.light).toBe(0)
    expect(later.dawn).toBe(0)
    expect(later.light).toBe(1)
  })
})
