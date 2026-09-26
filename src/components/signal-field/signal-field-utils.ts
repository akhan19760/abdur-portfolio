/**
 * Pure maths for the SignalField, kept out of the component for unit tests.
 *
 * The field is a repeating tunnel of particles `depth` world units long.
 * The camera moves forward along z as the page scrolls; a particle's distance
 * in front of the camera wraps so the tunnel never runs out.
 */

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x >= edge1 ? 1 : 0
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Distance in front of the camera, wrapped into (0, depth]. */
export function wrapDepth(z: number, cameraZ: number, depth: number): number {
  const d = (((z - cameraZ) % depth) + depth) % depth
  return d === 0 ? depth : d
}

/**
 * Camera z for a scroll position. Scrolling always moves forward, and the
 * stretch where the Hero hands over to About (roughly 0.15–1.1 viewports
 * down) adds `warp` extra units, so that part of the scroll feels like a dive.
 */
export function travelForScroll(
  scrollY: number,
  viewportHeight: number,
  perPx = 0.9,
  warp = 1600
): number {
  const boost = smoothstep(viewportHeight * 0.15, viewportHeight * 1.1, scrollY)
  return scrollY * perPx + boost * warp
}

/** Perspective projection of a world point `dz` units in front of the camera. */
export function project(
  x: number,
  y: number,
  dz: number,
  focal: number,
  cx: number,
  cy: number
): { sx: number; sy: number; scale: number } {
  const scale = focal / Math.max(dz, 1)
  return { sx: cx + x * scale, sy: cy + y * scale, scale }
}

/** Opacity factor: fades particles in at the far end and out right before the camera. */
export function depthFade(dz: number, depth: number, near = 40, nearFull = 220): number {
  return smoothstep(near, nearFull, dz) * (1 - smoothstep(depth * 0.7, depth, dz))
}
