/**
 * What the pin wall's camera and lights are doing at every point of the
 * Contact section's scroll. Pure, so it can be unit-tested; the wall reads it
 * every frame.
 *
 *   approach  (the last screen of Process) Process's plane flies off into
 *             the dark. Far ahead of it the wall waits, unlit, seen from a
 *             little above; the plane's light shows on it where the plane
 *             is heading, and grows as it gets closer.
 *   arrival   The plane reaches the wall (lib/paper-plane). The pins where
 *             it hits are driven in and a ring runs out across the wall.
 *   handoff   Contact's top rises up the view. The camera comes down and in
 *             until the wall fills the view, square on; the soft light over
 *             it comes up, the cursor's light takes over, and the letters
 *             push out from behind, spreading out from where the plane hit.
 *   hold      The wall settles and it's the visitor's to play with, the
 *             contact details over its lower half.
 *   exit      (the page loop, after the section) Scrolling on, a hole opens
 *             in the middle of the wall, a ring of pins sinking back and
 *             widening outward, and the camera flies through it into the
 *             dark, where the Hero's name is already on its way (lib/page-loop).
 *
 * World units: 1 = the distance between two pins. The wall's face is the
 * plane z = 0 with the pins pointing toward +z (the camera); the middle of
 * the grid is at x = y = 0, and y is up.
 */

import type { WallPhases } from "@/hooks/contact"
import { isPortrait } from "@/lib/stage-framing"
import { PIN_GRID, PORTRAIT_PIN_GRID } from "./pin-field"

// ── Small helpers ────────────────────────────────────────────────────────────
export function clamp(x: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, x))
}
export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}
export const mix = (a: number, b: number, t: number) => a + (b - a) * t

export type Vec3 = { x: number; y: number; z: number }
const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const sub = (a: Vec3, b: Vec3) => vec(a.x - b.x, a.y - b.y, a.z - b.z)
const add = (a: Vec3, b: Vec3) => vec(a.x + b.x, a.y + b.y, a.z + b.z)
const scale = (a: Vec3, s: number) => vec(a.x * s, a.y * s, a.z * s)
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3) =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a.x, a.y, a.z)
  return l > 0 ? scale(a, 1 / l) : vec(0, 0, 0)
}

// ── Camera ───────────────────────────────────────────────────────────────────
/** Vertical field of view (radians). */
export const WALL_FOV = (40 * Math.PI) / 180
/** Pins across the view once the camera has arrived. */
export const VIEW_COLUMNS = 124
/** The most pins down the view (on narrow screens it pulls back less). */
const VIEW_ROWS_MAX = 84
/**
 * Portrait views: pins across (fewer, so the letters stay big on a phone)
 * and the most down, inside the taller portrait wall.
 */
export const PORTRAIT_VIEW_COLUMNS = 62
const PORTRAIT_VIEW_ROWS_MAX = PORTRAIT_PIN_GRID.rows - 12

/** The wall for a view of this shape: wide in landscape, tall in portrait. */
export function pinGridFor(aspect: number): { cols: number; rows: number } {
  return isPortrait(aspect) ? PORTRAIT_PIN_GRID : PIN_GRID
}

/** Where the camera starts: this much further back, and this far up (units). */
const APPROACH = { far: 1.55, lift: 34 }
/** Most the camera moves across (and up) with the cursor, units. */
export const PARALLAX = { x: 7, y: 4 }

/** When things happen, in screens (see useWallScroll's phases). */
const TIMES = {
  /** The wall starts to draw (it's dark until the plane's light reaches it). */
  visible: -0.95,
  approach: { from: -0.8, to: 1.1 },
  /** The soft light over the wall comes up after the plane arrives. */
  key: { from: -0.4, to: 0.75 },
  /** The cursor's light takes over. */
  lamp: { from: -0.35, to: 0.45 },
  /** The letters push out. */
  reveal: { from: 0.1, to: 1.0 },
} as const

/** The earliest the wall draws, in screens (it's hidden before this). */
export const WALL_VISIBLE_FROM = TIMES.visible

/**
 * The exit through the wall, in screens after the section's end
 * (`phases.total`), when the page loop's stretch starts coming up. It must be
 * over before the loop ends (use-page-loop's LOOP_SCREENS).
 */
const EXIT = {
  /** The hole opens… */
  open: { from: 0, to: 0.55 },
  /**
   * …to this radius (cells). Small enough that its rim stays in view as the
   * camera comes in, growing like a tunnel's mouth, and sweeps out past the
   * edges of the view just as the camera goes through.
   */
  radius: 11,
  /** The camera flies in… */
  fly: { from: 0.1, to: 1.25 },
  /** …to this far past the wall's face (units). */
  past: -20,
  /** The wall fades out once the camera is through. */
  fade: { from: 1.05, to: 1.25 },
} as const

/** Screens after the section's end when the wall has gone for good. */
export const WALL_EXIT_END = EXIT.fade.to

/** How far back the camera sits once it has arrived, to fit VIEW_COLUMNS across. */
export function holdDistance(aspect: number): number {
  const t = Math.tan(WALL_FOV / 2)
  const portrait = isPortrait(aspect)
  const columns = portrait ? PORTRAIT_VIEW_COLUMNS : VIEW_COLUMNS
  const byWidth = columns / 2 / (t * Math.max(0.1, aspect))
  const byHeight = (portrait ? PORTRAIT_VIEW_ROWS_MAX : VIEW_ROWS_MAX) / 2 / t
  return Math.min(byWidth, byHeight)
}

export type WallCamera = {
  position: Vec3
  forward: Vec3
  right: Vec3
  up: Vec3
  fov: number
  aspect: number
}

/** A camera at `position` looking at `target`, level (no roll). */
export function lookAtCamera(position: Vec3, target: Vec3, aspect: number): WallCamera {
  const forward = normalize(sub(target, position))
  const right = normalize(cross(forward, vec(0, 1, 0)))
  const up = cross(right, forward)
  return { position, forward, right, up, fov: WALL_FOV, aspect }
}

/**
 * Where the ray through a screen point (0–1 from the top left) meets the
 * plane z = `z` (the wall's face by default), or null if it never does.
 */
export function wallPoint(
  cam: WallCamera,
  sx: number,
  sy: number,
  z = 0
): { x: number; y: number } | null {
  const t = Math.tan(cam.fov / 2)
  const dir = add(
    cam.forward,
    add(scale(cam.right, (sx * 2 - 1) * t * cam.aspect), scale(cam.up, (1 - sy * 2) * t))
  )
  if (Math.abs(dir.z) < 1e-6) return null
  const k = (z - cam.position.z) / dir.z
  if (k <= 0) return null
  return { x: cam.position.x + dir.x * k, y: cam.position.y + dir.y * k }
}

/** Screen position (0–1, from the top left) of a world point, or null if behind. */
export function projectToScreen(
  cam: WallCamera,
  p: Vec3
): { sx: number; sy: number } | null {
  const d = sub(p, cam.position)
  const depth = dot(d, cam.forward)
  if (depth <= 1e-6) return null
  const t = Math.tan(cam.fov / 2)
  const nx = dot(d, cam.right) / (depth * t * cam.aspect)
  const ny = dot(d, cam.up) / (depth * t)
  return { sx: (nx + 1) / 2, sy: (1 - ny) / 2 }
}

/** A world point on the wall as a (fractional) cell: column, and row from the top. */
export function toCell(
  x: number,
  y: number,
  grid: { cols: number; rows: number } = PIN_GRID
): { col: number; row: number } {
  return { col: x + (grid.cols - 1) / 2, row: (grid.rows - 1) / 2 - y }
}

// ── The letters' place ───────────────────────────────────────────────────────
/**
 * Where the letters go, as a share of the view once the camera has arrived:
 * across the middle, a little above centre, clear of the text below them.
 */
const LETTERING = { centreY: 0.36, width: 0.86, height: 0.26, lines: 1 }
/** In portrait there's no width for one line: the words stack, in the top part. */
const PORTRAIT_LETTERING = { centreY: 0.26, width: 0.84, height: 0.3, lines: 2 }

export type LetteringBox = {
  /** The box's middle, as a cell. */
  col: number
  row: number
  /** Most it can take up, in cells. */
  width: number
  height: number
  /** Lines to set the words on. */
  lines: number
}

/** Where the letters sit on the wall for a view of this shape. */
export function letteringBox(
  aspect: number,
  grid: { cols: number; rows: number } = pinGridFor(aspect)
): LetteringBox {
  const place = isPortrait(aspect) ? PORTRAIT_LETTERING : LETTERING
  const viewHeight = 2 * holdDistance(aspect) * Math.tan(WALL_FOV / 2)
  const viewWidth = viewHeight * aspect
  const centre = toCell(0, (0.5 - place.centreY) * viewHeight, grid)
  return {
    col: centre.col,
    row: centre.row,
    width: Math.min(grid.cols - 4, viewWidth * place.width),
    height: viewHeight * place.height,
    lines: place.lines,
  }
}

// ── The whole state ──────────────────────────────────────────────────────────
export type WallState = {
  camera: WallCamera
  /** Radius (cells) of the hole in the wall's middle the camera flies through; 0 for none. */
  hole: number
  /** 0–1: the soft light over the whole wall. */
  key: number
  /** 0–1: the cursor's light (and fingertip). */
  lamp: number
  /** 0–1: how far the letters have risen. */
  reveal: number
  /** 0–1: the whole wall. */
  opacity: number
}

/**
 * Everything about the wall at timeline position `u` (screens; see
 * wallPhases). `parallax` (−1–1 each way) moves the camera a little with the
 * cursor, so the pins' depth shows.
 */
export function wallStateAt(
  u: number,
  phases: WallPhases,
  aspect: number,
  parallax: { x: number; y: number } = { x: 0, y: 0 }
): WallState {
  const hold = holdDistance(aspect)
  const come = smoothstep(
    TIMES.approach.from,
    Math.min(TIMES.approach.to, phases.total),
    u
  )
  // Mostly moving early, easing in to rest
  const t = 1 - (1 - come) ** 2
  const distance = hold * mix(APPROACH.far, 1, t)
  const lift = APPROACH.lift * (1 - t)
  // The exit: straight in through the hole, speeding up then easing off
  const after = u - phases.total
  const fly = smoothstep(EXIT.fly.from, EXIT.fly.to, after)
  const through = fly * fly * (3 - 2 * fly)
  // Parallax fades out on the way in, so the camera heads for the middle
  const settled =
    smoothstep(0.2, 1, t) * (1 - smoothstep(EXIT.fly.from, EXIT.open.to, after))
  const position = vec(
    parallax.x * PARALLAX.x * settled,
    lift + parallax.y * PARALLAX.y * settled,
    mix(distance, EXIT.past, through)
  )
  // Looks at a point ahead of it, so it keeps facing the wall as it passes
  const target = vec(0, 0, Math.min(0, position.z - 10))
  return {
    camera: lookAtCamera(position, target, aspect),
    hole: EXIT.radius * smoothstep(EXIT.open.from, EXIT.open.to, after),
    key: smoothstep(TIMES.key.from, TIMES.key.to, u),
    lamp: smoothstep(TIMES.lamp.from, TIMES.lamp.to, u),
    reveal: smoothstep(TIMES.reveal.from, TIMES.reveal.to, u),
    opacity:
      smoothstep(TIMES.visible, TIMES.visible + 0.15, u) *
      (1 - smoothstep(EXIT.fade.from, EXIT.fade.to, after)),
  }
}
