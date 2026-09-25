/**
 * Pure maths for the Work section's sea, kept out of the component so it can
 * be unit-tested. The shader repeats the per-pixel parts in GLSL; the CPU
 * uses these for the camera, the cursor's light and the screens' hover tilt.
 *
 * World units are roughly metres: y up, the water at y = 0 (bent down with
 * distance while the planet's curvature is on), the camera looking toward −z
 * at yaw 0. Each project's screen stands on the water at z = 0, facing +z.
 */

export type Vec3 = { x: number; y: number; z: number }

export type SeaCamera = {
  x: number
  /** Height above the water. */
  y: number
  z: number
  /** Radians; 0 looks toward −z, positive turns toward +x. */
  yaw: number
  /** Radians below the horizon; positive looks down. */
  pitch: number
  /** Radians of bank. */
  roll: number
  /** Vertical field of view, radians. */
  fov: number
  /** Width / height of the view. */
  aspect: number
  /** 1 / planet radius; 0 is a flat sea. */
  curvature: number
}

export type CameraBasis = { forward: Vec3; right: Vec3; up: Vec3 }

// ── Small vector helpers ─────────────────────────────────────────────────────
const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z)
const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z)
const scale = (a: Vec3, s: number): Vec3 => vec(a.x * s, a.y * s, a.z * s)
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
export const length = (a: Vec3) => Math.hypot(a.x, a.y, a.z)
export function normalize(a: Vec3): Vec3 {
  const l = length(a)
  return l > 0 ? scale(a, 1 / l) : vec(0, 0, 0)
}

export function clamp(x: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, x))
}
export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}
export const mix = (a: number, b: number, t: number) => a + (b - a) * t

// ── Camera ───────────────────────────────────────────────────────────────────

/** Forward, right and up vectors for a camera's yaw, pitch and roll. */
export function cameraBasis(cam: Pick<SeaCamera, "yaw" | "pitch" | "roll">): CameraBasis {
  const cp = Math.cos(cam.pitch)
  const forward = vec(
    Math.sin(cam.yaw) * cp,
    -Math.sin(cam.pitch),
    -Math.cos(cam.yaw) * cp
  )
  const right0 = vec(Math.cos(cam.yaw), 0, Math.sin(cam.yaw))
  // up = right × forward
  const up0 = vec(
    right0.y * forward.z - right0.z * forward.y,
    right0.z * forward.x - right0.x * forward.z,
    right0.x * forward.y - right0.y * forward.x
  )
  const cr = Math.cos(cam.roll)
  const sr = Math.sin(cam.roll)
  return {
    forward,
    right: add(scale(right0, cr), scale(up0, sr)),
    up: sub(scale(up0, cr), scale(right0, sr)),
  }
}

/** Direction of the ray through a screen point (0–1, from the top left). */
export function rayDirection(cam: SeaCamera, sx: number, sy: number): Vec3 {
  const { forward, right, up } = cameraBasis(cam)
  const t = Math.tan(cam.fov / 2)
  const nx = (sx * 2 - 1) * t * cam.aspect
  const ny = (1 - sy * 2) * t
  return normalize(add(forward, add(scale(right, nx), scale(up, ny))))
}

/**
 * Where a ray from the camera meets the water, or null if it passes over the
 * horizon. The surface drops by curvature·d²/2 at horizontal distance d from
 * the camera; the root is taken in a form that stays exact as curvature → 0.
 */
export function hitSea(cam: SeaCamera, dir: Vec3): Vec3 | null {
  if (dir.y >= 0) return null
  const k = (cam.curvature * (dir.x * dir.x + dir.z * dir.z)) / 2
  const disc = dir.y * dir.y - 4 * k * cam.y
  if (disc < 0) return null
  const t = (2 * cam.y) / (-dir.y + Math.sqrt(disc))
  return add(vec(cam.x, cam.y, cam.z), scale(dir, t))
}

/** The water under a screen point (0–1, from the top left), or null. */
export function screenToSea(cam: SeaCamera, sx: number, sy: number): Vec3 | null {
  return hitSea(cam, rayDirection(cam, sx, sy))
}

/** Screen position (0–1, from the top left) of a world point, or null if behind. */
export function worldToScreen(
  cam: SeaCamera,
  p: Vec3
): { sx: number; sy: number } | null {
  const { forward, right, up } = cameraBasis(cam)
  const d = sub(p, vec(cam.x, cam.y, cam.z))
  const zc = dot(d, forward)
  if (zc <= 1e-6) return null
  const t = Math.tan(cam.fov / 2)
  const nx = dot(d, right) / (zc * t * cam.aspect)
  const ny = dot(d, up) / (zc * t)
  return { sx: (nx + 1) / 2, sy: (1 - ny) / 2 }
}

/** How far below eye level the horizon sits (radians) at a height and curvature. */
export function horizonDip(height: number, curvature: number): number {
  return Math.atan(Math.sqrt(Math.max(0, 2 * curvature * height)))
}

/**
 * The pitch that puts the horizon at a given screen height (0 = top, 1 =
 * bottom) in the middle of the view, with no roll. Values outside 0–1 are
 * fine: the horizon is then off screen.
 */
export function pitchForHorizon(
  screenY: number,
  fov: number,
  height: number,
  curvature: number
): number {
  const ndcY = 1 - screenY * 2
  return Math.atan(ndcY * Math.tan(fov / 2)) + horizonDip(height, curvature)
}

/** GGX (Trowbridge–Reitz) distribution for the angle between normal and half vector. */
export function ggx(cosNH: number, roughness: number): number {
  const a2 = roughness * roughness
  const c = Math.max(0, cosNH)
  const d = c * c * (a2 - 1) + 1
  return a2 / (Math.PI * d * d)
}

// ── Screens standing on the water ────────────────────────────────────────────

/** Size of every project's screen, in world units (16:9). */
export const PANEL_WIDTH = 16
export const PANEL_HEIGHT = 9

export type Panel = {
  /** Centre x; the screen stands at z = 0. */
  x: number
  /** Radians the screen has turned about its vertical axis (toward the cursor). */
  yaw: number
  /** 0–1: how far it has risen out of the water. */
  rise: number
}

/**
 * Where a ray meets a screen, or null. `u` runs 0–1 left to right and `v` 0–1
 * bottom to top of the screen's own face (so the picture rises with it); only
 * the part above the water counts.
 */
export function hitPanel(
  origin: Vec3,
  dir: Vec3,
  panel: Panel
): { t: number; u: number; v: number } | null {
  const normal = vec(Math.sin(panel.yaw), 0, Math.cos(panel.yaw))
  const denom = dot(dir, normal)
  if (Math.abs(denom) < 1e-6) return null
  const base = vec(panel.x, 0, 0)
  const t = dot(sub(base, origin), normal) / denom
  if (t <= 0) return null
  const q = add(origin, scale(dir, t))
  const tangent = vec(Math.cos(panel.yaw), 0, -Math.sin(panel.yaw))
  const lx = dot(sub(q, base), tangent)
  const top = PANEL_HEIGHT * panel.rise
  if (Math.abs(lx) > PANEL_WIDTH / 2 || q.y < 0 || q.y > top) return null
  return { t, u: lx / PANEL_WIDTH + 0.5, v: (q.y - (top - PANEL_HEIGHT)) / PANEL_HEIGHT }
}

/** The screen's on-screen bounding box (0–1, from the top left), or null if behind. */
export function panelScreenRect(
  cam: SeaCamera,
  panel: Panel
): { left: number; right: number; top: number; bottom: number } | null {
  const hx = (Math.cos(panel.yaw) * PANEL_WIDTH) / 2
  const hz = (-Math.sin(panel.yaw) * PANEL_WIDTH) / 2
  const top = PANEL_HEIGHT * panel.rise
  const corners = [
    vec(panel.x - hx, 0, -hz),
    vec(panel.x + hx, 0, hz),
    vec(panel.x - hx, top, -hz),
    vec(panel.x + hx, top, hz),
  ].map((p) => worldToScreen(cam, p))
  if (corners.some((c) => c === null)) return null
  const xs = corners.map((c) => (c as { sx: number }).sx)
  const ys = corners.map((c) => (c as { sy: number }).sy)
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  }
}

// ── Ripples ──────────────────────────────────────────────────────────────────

export const RIPPLE = {
  /** Metres per second the ring travels. */
  speed: 9,
  /** Width of the ring. */
  width: 1.8,
  /** Seconds a ripple lives. */
  life: 4,
} as const
