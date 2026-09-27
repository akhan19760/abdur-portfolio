import { describe, expect, it } from "vitest"
import { wallPhases } from "@/hooks/contact"
import { PIN_GRID, PORTRAIT_PIN_GRID } from "./pin-field"
import {
  PORTRAIT_VIEW_COLUMNS,
  VIEW_COLUMNS,
  WALL_EXIT_END,
  WALL_FOV,
  WALL_VISIBLE_FROM,
  holdDistance,
  letteringBox,
  lookAtCamera,
  pinGridFor,
  projectToScreen,
  toCell,
  wallPoint,
  wallStateAt,
} from "./wall-choreography"

const phases = wallPhases()
const WIDE = 16 / 9
const t = Math.tan(WALL_FOV / 2)

describe("holdDistance", () => {
  it("fits VIEW_COLUMNS pins across a wide view", () => {
    const d = holdDistance(WIDE)
    expect(2 * d * t * WIDE).toBeCloseTo(VIEW_COLUMNS, 5)
  })

  it("comes in closer on a squarer view, so the wall still fills it top to bottom", () => {
    const d = holdDistance(1.2)
    expect(2 * d * t).toBeLessThanOrEqual(PIN_GRID.rows)
    expect(2 * d * t * 1.2).toBeLessThan(VIEW_COLUMNS)
  })

  it("never shows more of the wall than there is", () => {
    for (const aspect of [1, 4 / 3, 16 / 10, WIDE, 21 / 9, 32 / 9]) {
      const d = holdDistance(aspect)
      expect(2 * d * t * aspect).toBeLessThanOrEqual(PIN_GRID.cols)
      expect(2 * d * t).toBeLessThanOrEqual(PIN_GRID.rows)
    }
  })
})

describe("the camera's rays", () => {
  const cam = lookAtCamera({ x: 0, y: 0, z: 90 }, { x: 0, y: 0, z: 0 }, WIDE)

  it("meets the wall at its middle through the middle of the view", () => {
    const p = wallPoint(cam, 0.5, 0.5)
    expect(p?.x).toBeCloseTo(0)
    expect(p?.y).toBeCloseTo(0)
  })

  it("has up at the top and right on the right", () => {
    const topRight = wallPoint(cam, 0.9, 0.1)
    expect(topRight!.x).toBeGreaterThan(0)
    expect(topRight!.y).toBeGreaterThan(0)
  })

  it("round-trips a screen point through the wall", () => {
    const tilted = lookAtCamera({ x: 5, y: 30, z: 140 }, { x: 0, y: 0, z: 0 }, WIDE)
    for (const [sx, sy] of [
      [0.2, 0.3],
      [0.62, 0.42],
      [0.9, 0.85],
    ]) {
      const p = wallPoint(tilted, sx, sy)!
      const back = projectToScreen(tilted, { x: p.x, y: p.y, z: 0 })!
      expect(back.sx).toBeCloseTo(sx, 6)
      expect(back.sy).toBeCloseTo(sy, 6)
    }
  })

  it("never meets a wall behind the camera", () => {
    const away = lookAtCamera({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: 20 }, WIDE)
    expect(wallPoint(away, 0.5, 0.5)).toBeNull()
    expect(projectToScreen(cam, { x: 0, y: 0, z: 200 })).toBeNull()
  })
})

describe("toCell", () => {
  it("puts the wall's middle at the middle cell, with row 0 at the top", () => {
    expect(toCell(0, 0)).toEqual({
      col: (PIN_GRID.cols - 1) / 2,
      row: (PIN_GRID.rows - 1) / 2,
    })
    expect(toCell(-(PIN_GRID.cols - 1) / 2, (PIN_GRID.rows - 1) / 2)).toEqual({
      col: 0,
      row: 0,
    })
  })
})

describe("letteringBox", () => {
  it("sits across the middle, a little above centre, inside the wall", () => {
    for (const aspect of [4 / 3, WIDE, 21 / 9]) {
      const box = letteringBox(aspect)
      expect(box.col).toBeCloseTo((PIN_GRID.cols - 1) / 2)
      expect(box.row).toBeLessThan((PIN_GRID.rows - 1) / 2)
      expect(box.row - box.height / 2).toBeGreaterThan(0)
      expect(box.width).toBeLessThanOrEqual(PIN_GRID.cols - 4)
      expect(box.width).toBeGreaterThan(box.height)
    }
  })
})

describe("portrait views", () => {
  const PHONES = [390 / 844, 390 / 664, 810 / 1080]

  it("use the tall wall, and see only pins that are on it", () => {
    for (const aspect of PHONES) {
      const grid = pinGridFor(aspect)
      expect(grid).toEqual(PORTRAIT_PIN_GRID)
      const d = holdDistance(aspect)
      expect(2 * d * t * aspect).toBeLessThanOrEqual(grid.cols)
      expect(2 * d * t).toBeLessThanOrEqual(grid.rows)
    }
  })

  it("keep the letters big: no more than PORTRAIT_VIEW_COLUMNS pins across", () => {
    for (const aspect of PHONES) {
      expect(2 * holdDistance(aspect) * t * aspect).toBeLessThanOrEqual(
        PORTRAIT_VIEW_COLUMNS + 1e-9
      )
    }
  })

  it("stack the words in the top part of the view", () => {
    for (const aspect of PHONES) {
      const box = letteringBox(aspect)
      expect(box.lines).toBe(2)
      expect(box.col).toBeCloseTo((PORTRAIT_PIN_GRID.cols - 1) / 2)
      expect(box.row).toBeLessThan((PORTRAIT_PIN_GRID.rows - 1) / 2)
      expect(box.row - box.height / 2).toBeGreaterThan(0)
    }
  })

  it("use the wide wall and one line in landscape", () => {
    expect(pinGridFor(WIDE)).toEqual(PIN_GRID)
    expect(letteringBox(WIDE).lines).toBe(1)
  })
})

describe("wallStateAt", () => {
  it("is hidden before the plane gets near", () => {
    expect(wallStateAt(WALL_VISIBLE_FROM - 0.1, phases, WIDE).opacity).toBe(0)
  })

  it("starts far back and above, in the dark, with the letters in", () => {
    const s = wallStateAt(-0.8, phases, WIDE)
    expect(s.camera.position.z).toBeGreaterThan(holdDistance(WIDE) * 1.4)
    expect(s.camera.position.y).toBeGreaterThan(20)
    expect(s.key).toBe(0)
    expect(s.lamp).toBe(0)
    expect(s.reveal).toBe(0)
  })

  it("ends square on at the hold distance, fully lit, letters out", () => {
    const s = wallStateAt(phases.total, phases, WIDE)
    expect(s.camera.position.z).toBeCloseTo(holdDistance(WIDE))
    expect(s.camera.position.x).toBeCloseTo(0)
    expect(s.camera.position.y).toBeCloseTo(0)
    expect(s.camera.forward.z).toBeCloseTo(-1)
    expect(s.key).toBe(1)
    expect(s.lamp).toBe(1)
    expect(s.reveal).toBe(1)
    expect(s.opacity).toBe(1)
  })

  it("comes steadily in and down, and on through the wall", () => {
    let z = Infinity
    let y = Infinity
    for (let u = -0.8; u <= phases.total + WALL_EXIT_END; u += 0.1) {
      const s = wallStateAt(u, phases, WIDE)
      expect(s.camera.position.z).toBeLessThanOrEqual(z + 1e-9)
      expect(s.camera.position.y).toBeLessThanOrEqual(y + 1e-9)
      z = s.camera.position.z
      y = s.camera.position.y
    }
  })

  it("moves with the cursor only once it has arrived", () => {
    const early = wallStateAt(-0.8, phases, WIDE, { x: 1, y: 1 })
    expect(early.camera.position.x).toBeCloseTo(0)
    const late = wallStateAt(phases.total, phases, WIDE, { x: 1, y: -1 })
    expect(late.camera.position.x).toBeGreaterThan(3)
    expect(late.camera.position.y).toBeLessThan(-2)
  })
})

describe("the exit through the wall (the page loop)", () => {
  const end = phases.total + WALL_EXIT_END

  it("keeps the wall whole until the section's end", () => {
    expect(wallStateAt(phases.total, phases, WIDE).hole).toBe(0)
  })

  it("opens a hole in the middle whose rim stays in view, then sweeps past as the camera goes through", () => {
    // Half the view's width where it meets the wall, in cells
    const halfWidth = (u: number) =>
      wallStateAt(u, phases, WIDE).camera.position.z * t * WIDE
    // Still coming in: the whole rim is on screen
    const coming = phases.total + 0.6
    expect(wallStateAt(coming, phases, WIDE).hole).toBeGreaterThan(8)
    expect(halfWidth(coming)).toBeGreaterThan(wallStateAt(coming, phases, WIDE).hole * 2)
    // About to go through: the rim is past the edges of the view
    let u = coming
    while (wallStateAt(u, phases, WIDE).camera.position.z > 3) u += 0.01
    expect(halfWidth(u)).toBeLessThan(wallStateAt(u, phases, WIDE).hole)
  })

  it("flies the camera straight through, past the wall's face, still facing on", () => {
    const s = wallStateAt(end, phases, WIDE, { x: 1, y: 1 })
    expect(s.camera.position.z).toBeLessThan(0)
    expect(s.camera.position.x).toBeCloseTo(0)
    expect(s.camera.position.y).toBeCloseTo(0)
    expect(s.camera.forward.z).toBeCloseTo(-1)
  })

  it("is gone by the time it's through", () => {
    expect(wallStateAt(end, phases, WIDE).opacity).toBe(0)
    expect(wallStateAt(phases.total + 0.5, phases, WIDE).opacity).toBe(1)
  })
})
