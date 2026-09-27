import { describe, expect, it } from "vitest"
import { foldPhases } from "@/hooks/process"
import {
  PAPER_SCREEN_X,
  driftPose,
  flightPath,
  foldWindows,
  lampPosition,
  orbitCamera,
  paperStateAt,
  projectToScreen,
} from "./fold-choreography"
import { FOLDS, FOLD_INDEX, SHEET_WIDTH } from "./paper-fold"
import { paperScreen } from "@/lib/stage-framing"

const phases = foldPhases()
const [discover, design, build, refine, launch] = phases.starts
const ASPECT = 16 / 9
const at = (u: number, aspect = ASPECT) => paperStateAt(u, phases, aspect)
const origin = { x: 0, y: 0, z: 0 }

describe("orbitCamera", () => {
  it("looks straight down with the nose at the top of the view", () => {
    const cam = orbitCamera(
      { target: origin, distance: 6, elevation: Math.PI / 2, azimuth: 0 },
      ASPECT
    )
    expect(cam.forward.y).toBeCloseTo(-1)
    expect(cam.up.z).toBeCloseTo(-1)
    const nose = projectToScreen(cam, { x: 0, y: 0, z: -1 })!
    const tail = projectToScreen(cam, { x: 0, y: 0, z: 1 })!
    expect(nose.sy).toBeLessThan(tail.sy)
  })

  it("keeps what it frames right of centre, beside the text", () => {
    for (const aspect of [1.3, ASPECT, 2.4]) {
      for (const elevation of [Math.PI / 2, 0.5, 0.15]) {
        const cam = orbitCamera(
          { target: origin, distance: 5, elevation, azimuth: -0.5 },
          aspect
        )
        const p = projectToScreen(cam, origin)!
        expect(p.sx).toBeCloseTo(PAPER_SCREEN_X, 5)
        expect(p.sy).toBeCloseTo(0.5, 5)
      }
    }
  })
})

describe("orbitCamera in portrait", () => {
  it("centres what it frames in the top part of the view, over the text", () => {
    for (const aspect of [390 / 844, 390 / 664, 810 / 1080]) {
      const cam = orbitCamera(
        { target: origin, distance: 5, elevation: 0.6, azimuth: -0.5 },
        aspect
      )
      const p = projectToScreen(cam, origin)!
      expect(p.sx).toBeCloseTo(paperScreen(aspect).sx, 5)
      expect(p.sy).toBeCloseTo(paperScreen(aspect).sy, 5)
    }
  })

  it("pulls back so the landed sheet fits across a phone", () => {
    const aspect = 390 / 844
    const landed = at(phases.landing, aspect)
    const left = projectToScreen(landed.camera, { x: -SHEET_WIDTH / 2, y: 0, z: 0 })!
    const right = projectToScreen(landed.camera, { x: SHEET_WIDTH / 2, y: 0, z: 0 })!
    expect(left.sx).toBeGreaterThan(0.02)
    expect(right.sx).toBeLessThan(0.98)
  })
})

describe("lampPosition", () => {
  it("floats just above the paper, under the cursor", () => {
    const cam = orbitCamera(
      { target: origin, distance: 6, elevation: Math.PI / 2, azimuth: 0 },
      ASPECT
    )
    const lamp = lampPosition(cam, 0.7, 0.4)
    expect(lamp.y).toBeGreaterThan(0.5)
    expect(lamp.y).toBeLessThan(2)
    const onScreen = projectToScreen(cam, lamp)!
    expect(onScreen.sx).toBeCloseTo(0.7, 5)
    expect(onScreen.sy).toBeCloseTo(0.4, 5)
  })
})

describe("the handoff", () => {
  it("starts with the sheet off screen and lands it flat, where the ring goes out", () => {
    const early = at(0.1)
    const sheetLeft = projectToScreen(early.camera, {
      x: early.pose.x - SHEET_WIDTH / 2,
      y: early.pose.y,
      z: early.pose.z,
    })!
    expect(sheetLeft.sx).toBeGreaterThan(1)

    const landed = at(phases.landing)
    expect(landed.pose).toEqual({ x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 })
    const centre = projectToScreen(landed.camera, origin)!
    expect(centre.sx).toBeCloseTo(PAPER_SCREEN_X, 5)
    expect(centre.sy).toBeCloseTo(0.5, 5)
  })

  it("falls steadily, always above the water", () => {
    let last = Infinity
    for (let u = 0.1; u <= phases.landing; u += 0.05) {
      const { y } = driftPose(u, phases.landing)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(last)
      last = y
    }
  })

  it("looks straight down at the water, like Work's camera", () => {
    expect(at(0.5).camera.forward.y).toBeCloseTo(-1)
    expect(at(discover + 0.5).camera.forward.y).toBeCloseTo(-1)
  })
})

describe("the steps", () => {
  it("shows the notes while you discover, and only then", () => {
    expect(at(discover + 0.5).notes).toBe(1)
    expect(at(design + 0.5).notes).toBe(0)
    expect(at(0.3).notes).toBe(0)
  })

  it("draws the fold lines during Design", () => {
    expect(at(discover + 0.5).lines).toBe(0)
    expect(at(design).draw).toBe(0)
    expect(at(build).draw).toBe(1)
    expect(at(build).lines).toBe(1)
    expect(at(launch).lines).toBe(0)
  })

  it("leaves the paper flat until Build, and folded by the end of Refine", () => {
    expect(at(build).folds.every((f) => f === 0)).toBe(true)
    expect(at(refine + 0.7).folds.every((f) => f === 1)).toBe(true)
  })

  it("finishes each fold before any fold that depends on it starts", () => {
    const w = foldWindows(phases)
    const i = FOLD_INDEX
    expect(w[i.cornerL].to).toBeLessThanOrEqual(w[i.edgeL].from)
    expect(w[i.cornerR].to).toBeLessThanOrEqual(w[i.edgeR].from)
    expect(Math.max(w[i.edgeL].to, w[i.edgeR].to)).toBeLessThanOrEqual(w[i.halfL].from)
    expect(w[i.halfL].to).toBeLessThanOrEqual(w[i.wingL].from)
    expect(w[i.halfR].to).toBeLessThanOrEqual(w[i.wingR].from)
    w.forEach(({ from, to }) => expect(to).toBeGreaterThan(from))
    expect(w).toHaveLength(FOLDS.length)
  })

  it("keeps the camera above what it's looking at", () => {
    for (let u = 0; u < phases.total; u += 0.1) {
      const { camera } = at(u)
      expect(camera.forward.y).toBeLessThan(0)
      expect(camera.position.y).toBeGreaterThan(0.5)
    }
  })

  it("lifts the plane and turns it toward the light once its wings are out", () => {
    expect(at(refine).aim).toBe(0)
    expect(at(refine + 0.9).aim).toBe(1)
    expect(at(refine + 0.9).pose.y).toBeGreaterThan(0.2)
  })

  it("lets the flat sheet lift toward the light, until the folding starts", () => {
    expect(at(0.5).curl).toBe(0)
    expect(at(discover + 0.3).curl).toBe(1)
    expect(at(design + 0.5).curl).toBe(1)
    expect(at(build + 0.1).curl).toBe(0)
  })

  it("fills the dark around the paper with dust once it has landed", () => {
    expect(at(0.3).dust).toBe(0)
    expect(at(discover + 0.5).dust).toBe(1)
    expect(at(launch + 1).dust).toBe(1)
  })

  it("reports the step on stage", () => {
    expect(at(discover + 0.1).active).toBe(0)
    expect(at(build + 1).active).toBe(2)
    expect(at(launch + 1).active).toBe(4)
  })
})

describe("the launch", () => {
  it("flies away into the distance after a short climb", () => {
    expect(flightPath(0).z).toBeCloseTo(0)
    expect(flightPath(0.3).y).toBeGreaterThan(0)
    expect(flightPath(1).z).toBeLessThan(-40)
  })

  it("flies from its perch, wherever the scroll starts", () => {
    const s = at(launch + 1)
    expect(s.perch.z).toBe(0)
    expect(s.perch.y).toBeGreaterThan(0.2)
    expect(s.pose.z - s.perch.z).toBeCloseTo(flightPath(s.flight).z)
  })

  it("waits until Launch, and is gone before the section ends", () => {
    expect(at(launch).flight).toBe(0)
    expect(at(phases.ends[4]).flight).toBe(1)
    expect(at(phases.ends[4]).pose.z).toBeLessThan(-40)
  })

  it("leaves nothing behind once the section has scrolled away", () => {
    expect(at(phases.total - 0.1).opacity).toBe(1)
    expect(at(phases.total + 0.5).opacity).toBe(0)
  })

  it("holds together on very wide and narrower screens", () => {
    for (const aspect of [1.25, 2.6]) {
      const s = at(launch + 0.45, aspect)
      const plane = projectToScreen(s.camera, { x: 0, y: s.pose.y + 0.3, z: 0 })!
      expect(plane.sx).toBeGreaterThan(0.5)
      expect(plane.sx).toBeLessThan(0.85)
    }
  })
})
