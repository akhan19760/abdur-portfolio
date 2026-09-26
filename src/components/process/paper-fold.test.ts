import { describe, expect, it } from "vitest"
import {
  FOLDED,
  FOLDS,
  FOLD_COUNT,
  FOLD_INDEX,
  KEEL_DEPTH,
  NOSE_Z,
  SHEET_LENGTH,
  SHEET_WIDTH,
  TAIL_Z,
  WINGTIPS,
  buildSheet,
  foldPoint,
  rotateAbout,
  traceFolds,
  vec,
} from "./paper-fold"
import type { FoldId, Vec3 } from "./paper-fold"

const HALF_W = SHEET_WIDTH / 2
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

/** Progress with only the named folds done (and the given amount). */
function only(ids: FoldId[], t = 1): number[] {
  const progress = new Array<number>(FOLD_COUNT).fill(0)
  for (const id of ids) progress[FOLD_INDEX[id]] = t
  return progress
}

/** Every fold up to and including `last` done. */
function upTo(last: FoldId): number[] {
  return FOLDS.map((_, i) => (i <= FOLD_INDEX[last] ? 1 : 0))
}

function fold(flat: Vec3, progress: readonly number[]) {
  return foldPoint(flat, traceFolds(flat).mask, progress)
}

const topLeft = vec(-HALF_W, 0, NOSE_Z)
const topRight = vec(HALF_W, 0, NOSE_Z)
const tailMiddle = vec(0, 0, TAIL_Z)

describe("rotateAbout", () => {
  it("turns a point a quarter turn about an axis", () => {
    const p = rotateAbout(vec(1, 0, 0), vec(0, 0, 0), vec(0, 0, 1), Math.PI / 2)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(1)
  })

  it("leaves points on the axis where they are", () => {
    const p = rotateAbout(vec(0, 0, 3), vec(0, 0, 0), vec(0, 0, 1), 1.2)
    expect(p).toEqual(vec(0, 0, 3))
  })
})

describe("the folds", () => {
  it("are the eight folds of a dart, in order", () => {
    expect(FOLDS.map((f) => f.id)).toEqual([
      "cornerL",
      "cornerR",
      "edgeL",
      "edgeR",
      "halfL",
      "halfR",
      "wingL",
      "wingR",
    ])
  })

  it("moves nothing before any fold starts", () => {
    const p = vec(-0.9, 0, NOSE_Z + 0.05)
    expect(fold(p, only([]))).toEqual(p)
  })

  it("lifts a corner up off the sheet before laying it on the centre line", () => {
    const halfway = fold(topLeft, only(["cornerL"], 0.5))
    expect(halfway.y).toBeGreaterThan(0.5)

    const done = fold(topLeft, only(["cornerL"]))
    expect(done.x).toBeCloseTo(0, 2)
    expect(done.z).toBeCloseTo(NOSE_Z + HALF_W, 2)
    // Just above the sheet, not through it
    expect(done.y).toBeGreaterThan(0)
    expect(done.y).toBeLessThan(0.05)
  })

  it("keeps each corner fold to its own side", () => {
    expect(traceFolds(topLeft).mask & (1 << FOLD_INDEX.cornerR)).toBe(0)
    expect(traceFolds(topRight).mask & (1 << FOLD_INDEX.cornerL)).toBe(0)
    expect(traceFolds(tailMiddle).mask).toBe(0)
  })

  it("folds both layers together on the second pair of folds", () => {
    // Part of the first flap lies over the second crease, so it turns too
    const mask = traceFolds(vec(-HALF_W, 0, NOSE_Z + 0.9 * HALF_W)).mask
    expect(mask & (1 << FOLD_INDEX.cornerL)).not.toBe(0)
    expect(mask & (1 << FOLD_INDEX.edgeL)).not.toBe(0)
    // The corner itself landed on the centre line, beyond the second crease
    expect(traceFolds(topLeft).mask & (1 << FOLD_INDEX.edgeL)).toBe(0)
  })

  it("folds the paper in half with the flaps inside", () => {
    const leftEdge = vec(-HALF_W, 0, TAIL_Z - 0.1)
    const halved = fold(leftEdge, upTo("halfR"))
    // Stood up nearly upright, just left of the centre line
    expect(halved.y).toBeGreaterThan(HALF_W * 0.99)
    expect(halved.x).toBeLessThan(0)
    expect(halved.x).toBeGreaterThan(-0.1)
  })

  it("keeps the fold along the centre as the bottom of the body", () => {
    const p = fold(tailMiddle, FOLDED)
    expect(p.y).toBeCloseTo(0)
    expect(p.x).toBeCloseTo(0)
  })

  it("ends with two level wings above the body, mirrored", () => {
    const [left, right] = WINGTIPS
    expect(left.x).toBeCloseTo(-right.x, 5)
    expect(left.y).toBeCloseTo(right.y, 5)
    expect(left.x).toBeLessThan(-0.6)
    expect(left.y).toBeGreaterThan(KEEL_DEPTH)
    expect(left.y).toBeLessThan(KEEL_DEPTH + 0.2)
  })

  it("never stretches the paper", () => {
    // Two nearby points on the same facet stay the same distance apart
    const a = vec(-0.7, 0, 0.9)
    const b = vec(-0.66, 0, 0.93)
    expect(traceFolds(a).mask).toBe(traceFolds(b).mask)
    for (const progress of [only(["cornerL"], 0.4), upTo("halfR"), FOLDED]) {
      expect(dist(fold(a, progress), fold(b, progress))).toBeCloseTo(dist(a, b), 6)
    }
  })

  it("keeps the whole plane compact once folded", () => {
    const { positions, masks } = buildSheet(24, 34)
    for (let i = 0; i < masks.length; i++) {
      const flat = vec(positions[i * 3], 0, positions[i * 3 + 2])
      const p = foldPoint(flat, masks[i], FOLDED)
      expect(Math.abs(p.x)).toBeLessThan(0.85)
      expect(p.y).toBeGreaterThan(-0.05)
      expect(p.y).toBeLessThan(0.6)
      expect(p.z).toBeGreaterThanOrEqual(NOSE_Z - 1e-6)
      expect(p.z).toBeLessThanOrEqual(TAIL_Z + 1e-6)
    }
  })
})

describe("buildSheet", () => {
  it("makes a grid of the sheet", () => {
    const sheet = buildSheet(4, 6)
    expect(sheet.positions).toHaveLength(5 * 7 * 3)
    expect(sheet.masks).toHaveLength(5 * 7)
    expect(sheet.creasesA).toHaveLength(5 * 7 * 4)
    expect(sheet.indices).toHaveLength(4 * 6 * 6)
    // Corners of the sheet
    expect(Array.from(sheet.positions.slice(0, 3))).toEqual(
      [-HALF_W, 0, NOSE_Z].map(Math.fround)
    )
    const last = sheet.positions.length - 3
    expect(sheet.positions[last + 2]).toBeCloseTo(NOSE_Z + SHEET_LENGTH)
  })

  it("marks where each crease falls on the flat sheet", () => {
    const sheet = buildSheet(40, 56)
    const at = (x: number, z: number) => {
      let best = 0
      let bestD = Infinity
      for (let i = 0; i < sheet.masks.length; i++) {
        const d = Math.hypot(sheet.positions[i * 3] - x, sheet.positions[i * 3 + 2] - z)
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      return best
    }
    // On the first corner's crease, halfway along: ~0
    const onCrease = at(-HALF_W / 2, NOSE_Z + HALF_W / 2)
    expect(Math.abs(sheet.creasesA[onCrease * 4])).toBeLessThan(0.05)
    // The corner itself turns (positive); the tail doesn't (negative)
    expect(sheet.creasesA[at(-HALF_W, NOSE_Z) * 4]).toBeGreaterThan(0.5)
    expect(sheet.creasesA[at(0, TAIL_Z) * 4]).toBeLessThan(-0.5)
    // The centre line is x itself
    expect(sheet.creasesB[at(0.5, 0) * 4]).toBeCloseTo(0.5, 1)
  })
})
