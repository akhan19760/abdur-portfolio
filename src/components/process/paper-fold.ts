/**
 * The Process section's sheet of paper and the folds that turn it into a
 * classic dart paper plane. Pure maths with no three.js, so it can be
 * unit-tested; the vertex shader (paper-fold-shader) repeats `foldPoint`.
 *
 * World units: the sheet is A4 at 1 unit = 10 cm (2.1 × 2.97), lying flat in
 * the xz plane at y = 0, centred on the origin, with the edge that becomes
 * the nose toward −z. The finished plane's body hangs below its wings and it
 * points toward −z.
 *
 * The folds, in order:
 *   cornerL/R  the two top corners down to the centre line
 *   edgeL/R    the new slanted edges down to the centre line again
 *   halfL/R    both halves up, so the plane is folded in half
 *   wingL/R    each wing back out, leaving the body hanging below
 *
 * Each fold turns part of the paper rigidly about a crease. A fold's crease,
 * and which part of the paper it turns, are worked out on the paper as it
 * lies once every earlier fold is complete. Every vertex keeps a bitmask of
 * the folds that turn it; folding it means applying those turns in order,
 * each as far as its fold has got. So a fold must finish before a later one
 * that depends on it starts (left and right twins are independent and may
 * run together).
 */

export type Vec3 = { x: number; y: number; z: number }

export const SHEET_WIDTH = 2.1
export const SHEET_LENGTH = 2.97
const HALF_W = SHEET_WIDTH / 2
/** z of the edge that becomes the nose. */
export const NOSE_Z = -SHEET_LENGTH / 2
/** z of the tail edge. */
export const TAIL_Z = SHEET_LENGTH / 2

/**
 * How far short of flat a folded flap stays (radians). Real paper springs
 * open a little, and it keeps the layers from sitting inside each other.
 */
const SPRING = 0.035
/** How far each half turns up when the plane is folded in half. */
const HALF_TURN = Math.PI / 2 - 0.05
/** Height of the plane's body, below the wings. */
export const KEEL_DEPTH = 0.32
/** The wings finish this far above level (radians). */
const DIHEDRAL = 0.12
/** The second pair of folds halves the first pair's 45°. */
const EDGE_ANGLE = Math.PI / 8

// ── Vector helpers ───────────────────────────────────────────────────────────
export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const add = (a: Vec3, b: Vec3) => vec(a.x + b.x, a.y + b.y, a.z + b.z)
const sub = (a: Vec3, b: Vec3) => vec(a.x - b.x, a.y - b.y, a.z - b.z)
const scale = (a: Vec3, s: number) => vec(a.x * s, a.y * s, a.z * s)
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3) =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a.x, a.y, a.z)
  return l > 0 ? scale(a, 1 / l) : vec(0, 0, 0)
}

/** Turns `p` by `angle` about the line through `point` along unit `dir`. */
export function rotateAbout(p: Vec3, point: Vec3, dir: Vec3, angle: number): Vec3 {
  const v = sub(p, point)
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return add(
    point,
    add(add(scale(v, c), scale(cross(dir, v), s)), scale(dir, dot(dir, v) * (1 - c)))
  )
}

/**
 * Which side of a crease (a line in the xz plane) a point is on, as a signed
 * distance. Used while the paper still lies flat.
 */
function sideOf(point: Vec3, dir: Vec3, p: Vec3): number {
  return dir.x * (p.z - point.z) - dir.z * (p.x - point.x)
}

// ── The folds ────────────────────────────────────────────────────────────────
export type FoldId =
  "cornerL" | "cornerR" | "edgeL" | "edgeR" | "halfL" | "halfR" | "wingL" | "wingR"

export type Fold = {
  id: FoldId
  /** A point on the crease (as the paper lies before this fold). */
  point: Vec3
  /** The crease's direction; a positive turn starts the paper moving the right way. */
  dir: Vec3
  /** The finished fold's turn (radians). */
  angle: number
}

type FoldSpec = Fold & {
  /** Whether this fold turns a point (as the paper lies before it); `mask` = folds that already turned it. */
  turns: (p: Vec3, mask: number) => boolean
  /** A point on the flat sheet this fold turns, and which way it should start moving. */
  sample: Vec3
  toward: Vec3
}

const UP = vec(0, 1, 0)
const NOSE_POINT = vec(0, 0, NOSE_Z)
const bit = (i: number) => 1 << i

function flatFold(id: FoldId, dir: Vec3, sample: Vec3): FoldSpec {
  const d = normalize(dir)
  const side = Math.sign(sideOf(NOSE_POINT, d, sample))
  return {
    id,
    point: NOSE_POINT,
    dir: d,
    angle: Math.PI - SPRING,
    turns: (p) => sideOf(NOSE_POINT, d, p) * side > 1e-9,
    sample,
    toward: UP,
  }
}

function halfFold(id: FoldId, side: -1 | 1): FoldSpec {
  return {
    id,
    point: vec(0, 0, 0),
    dir: vec(0, 0, 1),
    angle: HALF_TURN,
    turns: (p) => p.x * side > 1e-6,
    sample: vec(HALF_W * side, 0, TAIL_Z - 0.1),
    toward: UP,
  }
}

function wingFold(id: FoldId, side: -1 | 1, half: number): FoldSpec {
  return {
    id,
    // Where the half, leaning up, is KEEL_DEPTH high
    point: vec((side * KEEL_DEPTH) / Math.tan(HALF_TURN), KEEL_DEPTH, 0),
    dir: vec(0, 0, 1),
    angle: HALF_TURN - DIHEDRAL,
    turns: (p, mask) => (mask & bit(half)) !== 0 && p.y > KEEL_DEPTH,
    sample: vec(HALF_W * side, 0, TAIL_Z - 0.1),
    toward: vec(side, 0, 0),
  }
}

const SPECS: FoldSpec[] = [
  flatFold("cornerL", vec(-HALF_W, 0, HALF_W), vec(-HALF_W, 0, NOSE_Z)),
  flatFold("cornerR", vec(HALF_W, 0, HALF_W), vec(HALF_W, 0, NOSE_Z)),
  flatFold(
    "edgeL",
    vec(-Math.sin(EDGE_ANGLE), 0, Math.cos(EDGE_ANGLE)),
    vec(-HALF_W, 0, 0)
  ),
  flatFold(
    "edgeR",
    vec(Math.sin(EDGE_ANGLE), 0, Math.cos(EDGE_ANGLE)),
    vec(HALF_W, 0, 0)
  ),
  halfFold("halfL", -1),
  halfFold("halfR", 1),
  wingFold("wingL", -1, 4),
  wingFold("wingR", 1, 5),
]

export const FOLD_COUNT = SPECS.length

/** Every fold, with its crease oriented so a positive turn heads the right way. */
export const FOLDS: readonly Fold[] = (() => {
  const folds: Fold[] = []
  for (const spec of SPECS) {
    // Where the sample is once every earlier fold is complete
    let p = spec.sample
    let mask = 0
    folds.forEach((fold, i) => {
      if (SPECS[i].turns(p, mask)) {
        mask |= bit(i)
        p = rotateAbout(p, fold.point, fold.dir, fold.angle)
      }
    })
    const heading = dot(cross(spec.dir, sub(p, spec.point)), spec.toward)
    folds.push({
      id: spec.id,
      point: spec.point,
      dir: heading < 0 ? scale(spec.dir, -1) : spec.dir,
      angle: spec.angle,
    })
  }
  return folds
})()

/** Index of a fold in FOLDS (and bit in a vertex's mask). */
export const FOLD_INDEX = Object.fromEntries(FOLDS.map((f, i) => [f.id, i])) as Record<
  FoldId,
  number
>

type Trace = {
  /** Folds that turn this point. */
  mask: number
  /** Where it is before each fold, once every earlier fold is complete. */
  before: Vec3[]
  /** Where it ends up. */
  folded: Vec3
}

/** Follows a point on the flat sheet through every fold. */
export function traceFolds(flat: Vec3): Trace {
  let p = flat
  let mask = 0
  const before: Vec3[] = []
  FOLDS.forEach((fold, i) => {
    before.push(p)
    if (SPECS[i].turns(p, mask)) {
      mask |= bit(i)
      p = rotateAbout(p, fold.point, fold.dir, fold.angle)
    }
  })
  return { mask, before, folded: p }
}

/**
 * Where a point of the flat sheet is when each fold is `progress[i]` (0–1) of
 * the way done. `mask` comes from traceFolds (or the vertex's attribute).
 */
export function foldPoint(flat: Vec3, mask: number, progress: readonly number[]): Vec3 {
  let p = flat
  FOLDS.forEach((fold, i) => {
    const t = progress[i] ?? 0
    if (t !== 0 && mask & bit(i)) p = rotateAbout(p, fold.point, fold.dir, fold.angle * t)
  })
  return p
}

/** Every fold finished. */
export const FOLDED: readonly number[] = FOLDS.map(() => 1)

/** The finished plane's wingtips (the tail's corners), left then right. */
export const WINGTIPS: readonly Vec3[] = [-1, 1].map((side) => {
  const flat = vec(side * HALF_W, 0, TAIL_Z)
  return foldPoint(flat, traceFolds(flat).mask, FOLDED)
})

// ── The sheet's mesh ─────────────────────────────────────────────────────────
export type SheetMesh = {
  /** Flat positions (x, 0, z), 3 per vertex. */
  positions: Float32Array
  /** Bitmask of the folds that turn each vertex (exact as a float up to 2^24). */
  masks: Float32Array
  /**
   * Per vertex, signed distances to each crease as the paper lay when that
   * crease was made (positive on the side that turned), 4 per vertex:
   * cornerL, cornerR, edgeL, edgeR. Interpolated across a triangle, their zero
   * lines are exactly where the creases fall on the flat sheet — the fold
   * lines drawn during Design.
   */
  creasesA: Float32Array
  /** The same for: the centre line, wingL, wingR (and one unused slot). */
  creasesB: Float32Array
  indices: Uint32Array
}

/**
 * A grid over the sheet, `columns` × `rows` cells. Creases don't line up
 * with the grid, so it's kept fine: a fold bends within one cell.
 */
export function buildSheet(columns: number, rows: number): SheetMesh {
  const count = (columns + 1) * (rows + 1)
  const positions = new Float32Array(count * 3)
  const masks = new Float32Array(count)
  const creasesA = new Float32Array(count * 4)
  const creasesB = new Float32Array(count * 4)
  const { cornerL, edgeR, halfL, halfR, wingL, wingR } = FOLD_INDEX

  let v = 0
  for (let r = 0; r <= rows; r++) {
    const z = NOSE_Z + (r / rows) * SHEET_LENGTH
    for (let c = 0; c <= columns; c++) {
      const x = -HALF_W + (c / columns) * SHEET_WIDTH
      const flat = vec(x, 0, z)
      const { mask, before } = traceFolds(flat)
      positions.set([x, 0, z], v * 3)
      masks[v] = mask

      for (let i = cornerL; i <= edgeR; i++) {
        const fold = FOLDS[i]
        const d = Math.abs(sideOf(fold.point, fold.dir, before[i]))
        creasesA[v * 4 + i - cornerL] = mask & bit(i) ? d : -d
      }
      const wing = (i: number, half: number) =>
        mask & bit(half) ? before[i].y - KEEL_DEPTH : -1
      creasesB.set([x, wing(wingL, halfL), wing(wingR, halfR), 0], v * 4)
      v++
    }
  }

  const indices = new Uint32Array(columns * rows * 6)
  let k = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const a = r * (columns + 1) + c
      const b = a + 1
      const d = a + columns + 1
      const e = d + 1
      indices.set([a, d, b, b, d, e], k)
      k += 6
    }
  }

  return { positions, masks, creasesA, creasesB, indices }
}
