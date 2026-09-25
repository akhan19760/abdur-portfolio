/**
 * Pure maths for the About section's 3D signal core, kept out of the R3F
 * component so it can be unit-tested without WebGL.
 */

/** `count` unit vectors spread evenly over a sphere (Fibonacci lattice). */
export function fibonacciSphere(count: number): Float32Array {
  const out = new Float32Array(count * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = golden * i
    out[i * 3] = Math.cos(theta) * r
    out[i * 3 + 1] = y
    out[i * 3 + 2] = Math.sin(theta) * r
  }
  return out
}

/** How far each shell point travels when the core disperses, in [min, max]. */
export function randomSpreads(
  count: number,
  min = 2,
  max = 7,
  random = Math.random
): Float32Array {
  const out = new Float32Array(count)
  for (let i = 0; i < count; i++) out[i] = min + random() * (max - min)
  return out
}

/**
 * Writes shell point positions into `target`: each point sits on its
 * direction at `radius`, pushed out by `dispersal × spread` (0 = intact shell).
 */
export function writeShellPositions(
  target: Float32Array,
  directions: Float32Array,
  spreads: Float32Array,
  radius: number,
  dispersal: number
): void {
  for (let i = 0; i < spreads.length; i++) {
    const r = radius + dispersal * spreads[i]
    target[i * 3] = directions[i * 3] * r
    target[i * 3 + 1] = directions[i * 3 + 1] * r
    target[i * 3 + 2] = directions[i * 3 + 2] * r
  }
}

/** Smoothstep of scroll progress between `start` and `end`: 0 intact, 1 fully dispersed. */
export function dispersalAt(progress: number, start = 0.8, end = 0.97): number {
  if (end <= start) return progress >= end ? 1 : 0
  const t = Math.min(1, Math.max(0, (progress - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

/**
 * Maps a viewport point to normalised device coordinates for a rect:
 * (-1, -1) bottom-left to (1, 1) top-right, clamped to ±`limit`.
 */
export function toNdc(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
  limit = 1.2
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  const clamp = (v: number) => Math.min(limit, Math.max(-limit, v))
  return {
    x: clamp(((x - rect.left) / rect.width) * 2 - 1),
    y: clamp(-(((y - rect.top) / rect.height) * 2 - 1)),
  }
}

// ── Formations ────────────────────────────────────────────────────────────────
// The core's particles take a different shape for each About layer and morph
// between them as the visitor dives. Every formation returns `count` points
// (x, y, z triples) in the scene's local space, before any spin or tilt.

/** Small seeded PRNG (mulberry32), so formations are identical on every mount. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A spiral galaxy in the XZ plane: `arms` arms winding out to `radius`. */
export function galaxyFormation(
  count: number,
  random: () => number,
  arms = 3,
  radius = 8.5
): Float32Array {
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const r = 0.45 + Math.pow(random(), 0.8) * radius
    const arm = ((i % arms) / arms) * Math.PI * 2
    const scatter = (random() - 0.5) * 0.9 * (1.15 - r / (radius + 0.5))
    const theta = arm + r * 0.55 + scatter
    out[i * 3] = Math.cos(theta) * r
    out[i * 3 + 1] = (random() - 0.5) * 0.55 * (1 - r / (radius + 1.5))
    out[i * 3 + 2] = Math.sin(theta) * r
  }
  return out
}

/** A double helix along y: two strands, with a share of points as rungs. */
export function helixFormation(
  count: number,
  random: () => number,
  height = 11,
  radius = 1.7,
  turns = 3.5,
  rungShare = 0.18
): Float32Array {
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const s = random()
    const angle = s * turns * Math.PI * 2
    const y = (s - 0.5) * height
    if (random() < rungShare) {
      const u = random()
      const ax = Math.cos(angle) * radius
      const az = Math.sin(angle) * radius
      out[i * 3] = ax - 2 * ax * u
      out[i * 3 + 1] = y
      out[i * 3 + 2] = az - 2 * az * u
    } else {
      const strand = (i % 2) * Math.PI
      const r = radius + (random() - 0.5) * 0.22
      out[i * 3] = Math.cos(angle + strand) * r
      out[i * 3 + 1] = y + (random() - 0.5) * 0.08
      out[i * 3 + 2] = Math.sin(angle + strand) * r
    }
  }
  return out
}

/** Concentric rings in the XZ plane, plus a thin halo of points around the core. */
export function ringsFormation(
  count: number,
  random: () => number,
  radii: readonly number[] = [3, 3.8, 4.7],
  width = 0.3,
  haloShare = 0.12
): Float32Array {
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    if (random() < haloShare) {
      const z = random() * 2 - 1
      const theta = random() * Math.PI * 2
      const r = 1.9 * (1 + random() * 0.35)
      const s = Math.sqrt(1 - z * z)
      out[i * 3] = Math.cos(theta) * s * r
      out[i * 3 + 1] = z * r
      out[i * 3 + 2] = Math.sin(theta) * s * r
    } else {
      const ring = radii[i % radii.length] + (random() - 0.5) * width
      const theta = random() * Math.PI * 2
      out[i * 3] = Math.cos(theta) * ring
      out[i * 3 + 1] = (random() - 0.5) * 0.06
      out[i * 3 + 2] = Math.sin(theta) * ring
    }
  }
  return out
}

export type FormationBlend = {
  /** Formation being left. */
  from: number
  /** Formation being approached (equal to `from` while holding). */
  to: number
  /** 0–1 progress from `from` to `to`. */
  t: number
}

/**
 * Which formations to show at a scroll `progress`, given the progress
 * `windows` ([start, end]) during which each formation holds still. Between
 * two windows the particles morph from one formation to the next.
 */
export function formationBlend(
  progress: number,
  windows: readonly (readonly [number, number])[]
): FormationBlend {
  if (windows.length === 0) return { from: 0, to: 0, t: 0 }
  for (let i = 0; i < windows.length; i++) {
    const [start, end] = windows[i]
    if (progress < start) {
      if (i === 0) return { from: 0, to: 0, t: 0 }
      const prevEnd = windows[i - 1][1]
      const span = start - prevEnd
      return { from: i - 1, to: i, t: span > 0 ? (progress - prevEnd) / span : 1 }
    }
    if (progress <= end) return { from: i, to: i, t: 0 }
  }
  const last = windows.length - 1
  return { from: last, to: last, t: 0 }
}

/**
 * A point's own morph progress: points set off at different times (`delay`
 * 0–1, spread over `spread` of the morph), each easing in and out, so a
 * formation dissolves and re-forms like a flock rather than all at once.
 */
export function staggeredMorph(t: number, delay: number, spread = 0.4): number {
  const local = Math.min(1, Math.max(0, (t - delay * spread) / (1 - spread)))
  return local * local * (3 - 2 * local)
}

/**
 * The Signal layer's shape: a sparse shell around the crystal (a share of the
 * points, evenly spread) with the rest scattered thinly far out in space, so
 * the statement in front of it stays easy to read.
 */
export function shellCloudFormation(
  count: number,
  random: () => number,
  shellShare = 0.35,
  radius = 2.3,
  cloudMin = 5,
  cloudMax = 13
): Float32Array {
  const out = new Float32Array(count * 3)
  const shellCount = Math.round(count * shellShare)
  const dirs = fibonacciSphere(shellCount)
  for (let i = 0; i < count; i++) {
    if (i < shellCount) {
      const r = radius * (1 + (random() - 0.5) * 0.04)
      out[i * 3] = dirs[i * 3] * r
      out[i * 3 + 1] = dirs[i * 3 + 1] * r
      out[i * 3 + 2] = dirs[i * 3 + 2] * r
    } else {
      const z = random() * 2 - 1
      const theta = random() * Math.PI * 2
      const s = Math.sqrt(1 - z * z)
      const r = cloudMin + random() * (cloudMax - cloudMin)
      out[i * 3] = Math.cos(theta) * s * r
      out[i * 3 + 1] = z * r
      out[i * 3 + 2] = Math.sin(theta) * s * r
    }
  }
  return out
}

/**
 * The finale's shape: the curved horizon of a vast planet along the bottom of
 * the view (the top of a circle of `radius` whose highest point is at
 * `rimY`), with most points crowded along the rim and a sparse glow below it.
 */
export function horizonFormation(
  count: number,
  random: () => number,
  radius = 16,
  rimY = -1.6,
  span = 0.95,
  rimShare = 0.72
): Float32Array {
  const out = new Float32Array(count * 3)
  const cy = rimY - radius
  for (let i = 0; i < count; i++) {
    const theta = Math.PI / 2 + (random() - 0.5) * span
    const r =
      random() < rimShare ? radius - random() ** 2 * 0.25 : radius - random() * 2.2
    out[i * 3] = Math.cos(theta) * r
    out[i * 3 + 1] = cy + Math.sin(theta) * r
    out[i * 3 + 2] = -1 + (random() - 0.5) * 0.6
  }
  return out
}

/**
 * Brightness factor for a point `distance` from the middle of the view: dim
 * at the centre (where text sits), full strength from `outer` outward.
 */
export function centreDimming(
  distance: number,
  inner = 0.9,
  outer = 2.8,
  floor = 0.2
): number {
  const t = Math.min(1, Math.max(0, (distance - inner) / (outer - inner)))
  return floor + (1 - floor) * t * t * (3 - 2 * t)
}
