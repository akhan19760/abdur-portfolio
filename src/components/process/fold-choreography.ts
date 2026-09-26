/**
 * What the paper, its camera and its light are doing at every point of the
 * Process section's scroll. Pure, so it can be unit-tested; the paper reads
 * it every frame.
 *
 *   handoff  Work's camera turns to look straight down at the calm water; a
 *            sheet of paper drifts down out of the dark, rocking like a
 *            falling leaf, and settles on the surface. This camera looks
 *            straight down too, so the sheet sits on Work's water.
 *   discover The blank sheet, seen from above. The visitor's light shows its
 *            grain and faint pencil notes wherever it falls.
 *   design   The fold lines draw themselves out from the nose, and the camera
 *            tilts down to a three-quarter view.
 *   build    The folds, one pair at a time: corners, edges, then both halves
 *            up. The camera comes closer and circles as it goes.
 *   refine   The wings fold out and it lifts: a paper plane. The camera pulls
 *            back to its side, and the plane turns to follow the light.
 *   launch   The camera swings round behind it and it flies off into the
 *            dark, a thin purple trail behind each wingtip.
 *
 * The paper keeps to the right of the view (PAPER_SCREEN_X), beside the text.
 */

import type { FoldPhases } from "@/hooks/process"
import { stepAt } from "@/hooks/process"
import { FOLD_COUNT, FOLD_INDEX, KEEL_DEPTH } from "./paper-fold"
import type { FoldId, Vec3 } from "./paper-fold"

// ── Small helpers ────────────────────────────────────────────────────────────
export function clamp(x: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, x))
}
export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const add = (a: Vec3, b: Vec3) => vec(a.x + b.x, a.y + b.y, a.z + b.z)
const sub = (a: Vec3, b: Vec3) => vec(a.x - b.x, a.y - b.y, a.z - b.z)
const scale = (a: Vec3, s: number) => vec(a.x * s, a.y * s, a.z * s)
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a.x, a.y, a.z)
  return l > 0 ? scale(a, 1 / l) : vec(0, 0, 0)
}

// ── Camera ───────────────────────────────────────────────────────────────────
/** Vertical field of view (radians). */
export const PAPER_FOV = (35 * Math.PI) / 180
/**
 * Where the paper sits across the view (0 = left edge): right of centre,
 * beside the step text. Work's sea sends the landing ring out from here
 * (sea-choreography's PAPER_SCREEN must match).
 */
export const PAPER_SCREEN_X = 0.63
/** How far along the cursor's ray the light floats, as a share of the camera's distance. */
const LAMP_REACH = 0.8

export type PaperCamera = {
  position: Vec3
  forward: Vec3
  right: Vec3
  up: Vec3
  fov: number
  aspect: number
  /** Distance to the point it's framing. */
  distance: number
}

type Orbit = {
  /** What the camera frames (it stays at PAPER_SCREEN_X across the view). */
  target: Vec3
  distance: number
  /** Radians above level; π/2 looks straight down with the nose at the top. */
  elevation: number
  /** Radians round from behind the tail; positive swings to the right. */
  azimuth: number
}

/** A camera circling `target`, turned so the target sits at PAPER_SCREEN_X. */
export function orbitCamera(orbit: Orbit, aspect: number): PaperCamera {
  const { target, distance, elevation: el, azimuth: az } = orbit
  const forward = vec(
    -Math.sin(az) * Math.cos(el),
    -Math.sin(el),
    -Math.cos(az) * Math.cos(el)
  )
  const right = vec(Math.cos(az), 0, -Math.sin(az))
  const up = vec(
    right.y * forward.z - right.z * forward.y,
    right.z * forward.x - right.x * forward.z,
    right.x * forward.y - right.y * forward.x
  )
  // Look a little left of the target so it stands right of centre
  const shift = (2 * PAPER_SCREEN_X - 1) * distance * Math.tan(PAPER_FOV / 2) * aspect
  const look = sub(target, scale(right, shift))
  return {
    position: sub(look, scale(forward, distance)),
    forward,
    right,
    up,
    fov: PAPER_FOV,
    aspect,
    distance,
  }
}

/** Screen position (0–1, from the top left) of a world point, or null if behind. */
export function projectToScreen(
  cam: PaperCamera,
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

/**
 * The visitor's light: a little way along the cursor's ray (screen 0–1, from
 * the top left), hovering just above whatever the camera is framing.
 */
export function lampPosition(cam: PaperCamera, sx: number, sy: number): Vec3 {
  const t = Math.tan(cam.fov / 2)
  const dir = normalize(
    add(
      cam.forward,
      add(
        scale(cam.right, (sx * 2 - 1) * t * cam.aspect),
        scale(cam.up, (1 - sy * 2) * t)
      )
    )
  )
  return add(cam.position, scale(dir, cam.distance * LAMP_REACH))
}

// ── The paper's placement ────────────────────────────────────────────────────
/** Where the paper is and how it's turned (radians; turns are about PAPER_PIVOT). */
export type PaperPose = {
  x: number
  y: number
  z: number
  /** Nose up is positive. */
  pitch: number
  /** Nose left is positive. */
  yaw: number
  roll: number
}

/** The point the paper turns about: inside the finished plane's body. */
export const PAPER_PIVOT: Vec3 = vec(0, KEEL_DEPTH, 0.2)

const REST: PaperPose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 }
const DRIFT_START = 0.1 // the sheet starts falling (off screen, to the right)
const DROP = 4.4 // how far above the water it starts
const HOVER = 0.3 // the plane lifts this far once its wings are out

/** The sheet falling onto the water like a leaf, rocking less as it slows. */
export function driftPose(u: number, landing: number): PaperPose {
  const t = clamp((u - DRIFT_START) / (landing - DRIFT_START))
  const left = 1 - t
  const sway = Math.sin(2 * Math.PI * 1.4 * t)
  return {
    x: 1.8 * left ** 1.5 + 0.35 * sway * left,
    y: DROP * left * left,
    z: -1.3 * left ** 1.5,
    pitch: 0.3 * Math.sin(2 * Math.PI * t) * left,
    yaw: 0.7 * left * left,
    roll: 0.42 * Math.sin(2 * Math.PI * 1.4 * t + 0.6) * left,
  }
}

/**
 * The plane's flight, as an offset from where it was when it left
 * (`f` 0–1): it climbs a little, then glides away into the distance,
 * rocking its wings.
 */
export function flightPath(f: number): PaperPose {
  const t = clamp(f)
  return {
    x: 0.8 * t * t,
    y: 1.1 * Math.sin(Math.PI * 0.9 * t),
    z: -48 * t ** 1.8,
    pitch: 0.14 * Math.cos(Math.PI * 0.9 * t) * (1 - t),
    yaw: -0.1 * t,
    roll: 0.25 * Math.sin(2 * Math.PI * 1.2 * t) * (1 - t),
  }
}

// ── The whole state ──────────────────────────────────────────────────────────
export type PaperState = {
  camera: PaperCamera
  /** How far along each fold is (0–1), in FOLDS order. */
  folds: number[]
  pose: PaperPose
  /** Where the plane was before it flew (what the flight starts from). */
  perch: PaperPose
  /** 0–1 through the plane's flight. */
  flight: number
  /** 0–1: how much the plane turns to follow the light. */
  aim: number
  /** 0–1: the pencil notes (Discover). */
  notes: number
  /** 0–1: how strongly the fold lines show. */
  lines: number
  /** 0–1: how much of the fold lines has been drawn, outward from the nose. */
  draw: number
  /** 0–1: the flat sheet's edge lifting toward the light (before any folds). */
  curl: number
  /** 0–1: dust drifting in the light around the paper. */
  dust: number
  /** 0–1: the whole paper (out once the section has gone). */
  opacity: number
  /** The step on stage. */
  active: number
}

type Shot = Omit<Orbit, "target"> & { u: number; lift: number }

const deg = (d: number) => (d * Math.PI) / 180

/** The camera's key positions; it eases between them. */
function shots(phases: FoldPhases): Shot[] {
  const [discover, design, build, refine, launch] = phases.starts
  const shot = (u: number, distance: number, el: number, az: number, lift = 0): Shot => ({
    u,
    distance,
    elevation: deg(el),
    azimuth: deg(az),
    lift,
  })
  return [
    shot(0, 6.4, 90, 0),
    shot(discover, 6.4, 90, 0),
    shot(design, 6.0, 90, 0), // a slow push in while you explore the sheet
    shot(design + 0.3, 6.0, 90, 0),
    shot(design + 1.0, 5.5, 62, -12),
    shot(build + 0.1, 5.4, 60, -14),
    shot(build + 1.3, 4.9, 50, -22, 0.05),
    shot(build + 1.9, 4.9, 30, -30, 0.4),
    shot(refine + 0.6, 5.2, 16, -36, KEEL_DEPTH + HOVER * 0.8),
    shot(launch, 5.4, 14, -40, KEEL_DEPTH + HOVER * 0.8),
    shot(launch + 0.45, 5.2, 9, 4, KEEL_DEPTH + HOVER * 0.8), // round behind it
  ]
}

function cameraAt(u: number, phases: FoldPhases, aspect: number): PaperCamera {
  const keys = shots(phases)
  let a = keys[0]
  let b = keys[0]
  let t = 0
  if (u >= keys[keys.length - 1].u) {
    a = b = keys[keys.length - 1]
  } else {
    for (let i = 0; i < keys.length - 1; i++) {
      if (u < keys[i + 1].u) {
        a = keys[i]
        b = keys[i + 1]
        t = smoothstep(a.u, b.u, u)
        break
      }
    }
  }
  return orbitCamera(
    {
      target: vec(0, mix(a.lift, b.lift, t), 0),
      distance: mix(a.distance, b.distance, t),
      elevation: mix(a.elevation, b.elevation, t),
      azimuth: mix(a.azimuth, b.azimuth, t),
    },
    aspect
  )
}

/** Each fold's window, in screens after a step starts. */
const FOLD_TIMES: Record<FoldId, { step: number; from: number; to: number }> = {
  cornerL: { step: 2, from: 0.1, to: 0.55 },
  cornerR: { step: 2, from: 0.2, to: 0.65 },
  edgeL: { step: 2, from: 0.75, to: 1.2 },
  edgeR: { step: 2, from: 0.85, to: 1.3 },
  halfL: { step: 2, from: 1.4, to: 1.9 },
  halfR: { step: 2, from: 1.4, to: 1.9 },
  wingL: { step: 3, from: 0.1, to: 0.6 },
  wingR: { step: 3, from: 0.1, to: 0.6 },
}

/** When each fold runs, in timeline screens (FOLDS order). */
export function foldWindows(phases: FoldPhases): { from: number; to: number }[] {
  const windows = new Array<{ from: number; to: number }>(FOLD_COUNT)
  for (const [id, { step, from, to }] of Object.entries(FOLD_TIMES)) {
    const start = phases.starts[step]
    windows[FOLD_INDEX[id as FoldId]] = { from: start + from, to: start + to }
  }
  return windows
}

/** Everything about the paper at timeline position `u` (screens; see foldPhases). */
export function paperStateAt(u: number, phases: FoldPhases, aspect: number): PaperState {
  const [discover, design, build, refine, launch] = phases.starts

  const folds = foldWindows(phases).map(({ from, to }) => smoothstep(from, to, u))

  // ── Placement: falling onto the water, resting, hovering, flying ──
  const flight = smoothstep(0, 1, (u - (launch + 0.4)) / 0.95) ** 1.2
  const perch: PaperPose = { ...REST, y: HOVER * smoothstep(refine, refine + 0.6, u) }
  let pose = perch
  if (u < phases.landing) {
    pose = driftPose(u, phases.landing)
  } else if (flight > 0) {
    const path = flightPath(flight)
    pose = {
      x: perch.x + path.x,
      y: perch.y + path.y,
      z: perch.z + path.z,
      pitch: path.pitch,
      yaw: path.yaw,
      roll: path.roll,
    }
  }

  const notes =
    smoothstep(phases.landing - 0.1, discover + 0.2, u) *
    (1 - smoothstep(design - 0.1, design + 0.25, u))
  const lines =
    smoothstep(design, design + 0.15, u) *
    (1 - 0.55 * smoothstep(build + 0.1, build + 1.9, u)) *
    (1 - smoothstep(refine + 0.2, refine + 0.6, u))

  return {
    camera: cameraAt(u, phases, aspect),
    folds,
    pose,
    perch,
    flight,
    aim: smoothstep(refine + 0.55, refine + 0.85, u),
    notes,
    lines,
    draw: smoothstep(design + 0.1, design + 0.8, u),
    curl:
      smoothstep(phases.landing, phases.landing + 0.25, u) *
      (1 - smoothstep(build - 0.05, build + 0.1, u)),
    dust: smoothstep(phases.landing - 0.2, discover + 0.3, u),
    opacity: 1 - smoothstep(phases.total, phases.total + 0.4, u),
    active: stepAt(u, phases),
  }
}
