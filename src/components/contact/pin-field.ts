/**
 * The Contact wall's pins: a grid of steel pins, like a pin-art toy, each
 * free to slide in and out of the wall.
 *
 * Each pin is a damped spring pulled back toward its resting height and a
 * little toward its neighbours, so a push anywhere spreads out as a ripple.
 * Resting heights come from the letters (pins that are part of a letter
 * stand out; they rise as the reveal front passes them) plus a slow, faint
 * swell so the wall is never quite still. The visitor's fingertip (the
 * cursor) is a rounded surface the pins can't stand in front of, so it
 * pushes them back where it presses; clicks and the paper plane's arrival
 * strike them, sending rings across the wall. When the visitor scrolls on
 * past Contact, a hole opens in the middle: the pins inside it slide right
 * back into the wall, a ring widening outward, so the camera can fly through.
 *
 * Units: 1 = the distance between two pins, both across the wall and in and
 * out of it. Cells are indexed row by row, row 0 at the top.
 *
 * Pure (typed arrays in, typed arrays out), so it's unit-tested; the wall
 * steps it every frame and uploads what `shadePins` writes to the GPU.
 */

/** The wall's size, in pins. */
export const PIN_GRID = { cols: 150, rows: 96 } as const

/** How far a letter's pins stand out from the wall. */
export const RELIEF_HEIGHT = 2.2

export const PIN_PHYSICS = {
  /** s⁻²: pull back toward the resting height. */
  spring: 30,
  /** s⁻²: pull toward the neighbours (what makes ripples travel). */
  coupling: 200,
  /** s⁻¹ */
  damping: 1.5,
  /**
   * s⁻¹: drag between neighbours moving at different speeds. It damps fine,
   * pin-to-pin jitter quickly while broad ripples travel on almost untouched.
   */
  viscosity: 3,
  /** Fixed step (s); frames are split into as many as they need. */
  step: 1 / 120,
  /** Most steps per frame (a long frame is simulated only this far). */
  maxSteps: 6,
} as const

/** The slow swell across the wall when nothing is touching it. */
const SWELL = { height: 0.14, speed: 0.6 }
/** How wide the band of pins rising at the reveal front is (cells). */
const REVEAL_BAND = 14
/**
 * The hole: pins inside it sink this far into the wall (out of sight), over
 * a band this wide (cells) at its edge.
 */
export const HOLE = { depth: -9, band: 7 } as const

export type PinField = {
  cols: number
  rows: number
  /** How far each pin stands out (units, + toward the viewer). */
  height: Float32Array
  velocity: Float32Array
  /** 0–1 per pin: how much of a letter it's part of. */
  relief: Float32Array
  /** Per pin: its distance (cells) from where the letters start rising. */
  reach: Float32Array
  /** Largest `reach`, so a reveal of 1 has passed every pin. */
  maxReach: number
  /** Per pin: where it's pulled back to (letters + swell, or the hole), this frame. */
  rest: Float32Array
  /** Per pin, 0–1: how far inside the hole it is this frame (0 outside it). */
  sunk: Float32Array
  /** Scratch: each pin's acceleration this step. */
  accel: Float32Array
  /** Scratch: the swell's two parts along a row, this frame. */
  swellSin: Float32Array
  swellCos: Float32Array
}

export function createPinField(
  cols: number = PIN_GRID.cols,
  rows: number = PIN_GRID.rows
): PinField {
  const n = cols * rows
  const field: PinField = {
    cols,
    rows,
    height: new Float32Array(n),
    velocity: new Float32Array(n),
    relief: new Float32Array(n),
    reach: new Float32Array(n),
    maxReach: 1,
    rest: new Float32Array(n),
    sunk: new Float32Array(n),
    accel: new Float32Array(n),
    swellSin: new Float32Array(cols),
    swellCos: new Float32Array(cols),
  }
  setRevealOrigin(field, (cols - 1) / 2, (rows - 1) / 2)
  return field
}

/** Sets which pins make up the letters (0–1 each, row by row). */
export function setRelief(field: PinField, coverage: Float32Array | null): void {
  if (!coverage || coverage.length !== field.relief.length) {
    field.relief.fill(0)
    return
  }
  for (let i = 0; i < coverage.length; i++)
    field.relief[i] = Math.min(1, Math.max(0, coverage[i]))
}

/** Sets where the letters start rising from (a cell; the front spreads out from there). */
export function setRevealOrigin(field: PinField, col: number, row: number): void {
  const { cols, rows, reach } = field
  let max = 1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = Math.hypot(c - col, r - row)
      reach[r * cols + c] = d
      if (d > max) max = d
    }
  }
  field.maxReach = max
}

/** 0–1: how far a pin `reach` cells from the origin has risen, with the front at `reveal` (0–1). */
export function riseAt(reach: number, reveal: number, maxReach: number): number {
  if (reveal <= 0) return 0
  if (reveal >= 1) return 1
  const front = reveal * (maxReach + REVEAL_BAND)
  const t = Math.min(1, Math.max(0, (front - reach) / REVEAL_BAND))
  return t * t * (3 - 2 * t)
}

/**
 * The visitor's fingertip: a rounded surface centred on a cell. At its
 * middle it reaches `depth` units into the wall; toward its rim it curves
 * back out to the wall's face and beyond, so it only moves the pins it
 * actually meets.
 */
export type Press = { col: number; row: number; radius: number; depth: number }

/** Where the fingertip's surface is, `distance` cells from its middle (Infinity outside it). */
export function pressSurface(press: Press, distance: number): number {
  if (distance >= press.radius) return Infinity
  const t = distance / press.radius
  // A cup: deepest in the middle, rising steeply toward the rim
  return -press.depth + (press.depth + RELIEF_HEIGHT + 1) * t * t
}

/** A round opening in the wall, centred on a cell; `radius` in cells (0 = none). */
export type Hole = { col: number; row: number; radius: number }

/** 0–1: how far inside a hole of `radius` a pin `distance` cells from its middle is. */
export function holeSink(distance: number, radius: number): number {
  if (radius <= 0) return 0
  const t = Math.min(1, Math.max(0, (radius - distance) / HOLE.band))
  return t * t * (3 - 2 * t)
}

export type PinInput = {
  /** 0–1: how far the letters have risen (the reveal front). */
  reveal: number
  /** Seconds, for the swell. */
  time: number
  /** The fingertip, or null when the cursor is away. */
  press: Press | null
  /** The opening the camera flies through at the end, if it has started. */
  hole?: Hole | null
}

/** Works out every pin's resting height for this frame (letters + swell, or the hole). */
function updateRest(field: PinField, input: PinInput): void {
  const { cols, rows, relief, reach, rest, sunk, maxReach, swellSin, swellCos } = field
  const t = input.time * SWELL.speed
  const hole = input.hole && input.hole.radius > 0 ? input.hole : null
  // The swell is SWELL.height · sin(0.11c + 0.04r − t) · sin(0.09r + 0.7t),
  // split so it takes a few sines per row and column rather than per pin
  for (let c = 0; c < cols; c++) {
    swellSin[c] = Math.sin(c * 0.11 - t)
    swellCos[c] = Math.cos(c * 0.11 - t)
  }
  for (let r = 0; r < rows; r++) {
    const wr = SWELL.height * Math.sin(r * 0.09 + t * 0.7)
    const a = wr * Math.cos(r * 0.04)
    const b = wr * Math.sin(r * 0.04)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      const swell = a * swellSin[c] + b * swellCos[c]
      const letter =
        relief[i] > 0 ? relief[i] * riseAt(reach[i], input.reveal, maxReach) : 0
      const sink = hole
        ? holeSink(Math.hypot(c - hole.col, r - hole.row), hole.radius)
        : 0
      sunk[i] = sink
      rest[i] = (letter * RELIEF_HEIGHT + swell) * (1 - sink) + HOLE.depth * sink
    }
  }
}

/**
 * One fixed step of the springs, then the fingertip pushing pins back.
 *
 * The pull toward the neighbours acts on how far each pin is from its own
 * resting height, not on the height itself: a push spreads out as a ripple,
 * but the letters' edges stay sharp once everything is still.
 */
function integrate(field: PinField, dt: number, press: Press | null): void {
  const { cols, rows, height: h, velocity: v, rest, accel } = field
  const { spring, coupling, damping, viscosity } = PIN_PHYSICS
  const last = cols - 1
  for (let r = 0; r < rows; r++) {
    const row = r * cols
    const up = r > 0 ? row - cols : row
    const down = r < rows - 1 ? row + cols : row
    for (let c = 0; c < cols; c++) {
      const i = row + c
      const off = h[i] - rest[i]
      const l = c > 0 ? i - 1 : i
      const rt = c < last ? i + 1 : i
      const u = up + c
      const d = down + c
      const lap =
        h[l] -
        rest[l] +
        (h[rt] - rest[rt]) +
        (h[u] - rest[u]) +
        (h[d] - rest[d]) -
        4 * off
      const drag = v[l] + v[rt] + v[u] + v[d] - 4 * v[i]
      accel[i] = -spring * off + coupling * lap + viscosity * drag - damping * v[i]
    }
  }
  for (let i = 0; i < h.length; i++) {
    v[i] += accel[i] * dt
    h[i] += v[i] * dt
  }

  // Well inside the hole the pins are gone at once, however fast the
  // visitor scrolls, so the camera never meets one; its edge still springs
  const { sunk } = field
  for (let i = 0; i < h.length; i++) {
    if (sunk[i] > 0.5 && h[i] > rest[i]) {
      h[i] = rest[i]
      if (v[i] > 0) v[i] = 0
    }
  }

  if (!press) return
  const reach = Math.ceil(press.radius)
  const c0 = Math.max(0, Math.floor(press.col - reach))
  const c1 = Math.min(last, Math.ceil(press.col + reach))
  const r0 = Math.max(0, Math.floor(press.row - reach))
  const r1 = Math.min(rows - 1, Math.ceil(press.row + reach))
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const surface = pressSurface(press, Math.hypot(c - press.col, r - press.row))
      const i = r * cols + c
      if (h[i] > surface) {
        h[i] = surface
        if (v[i] > 0) v[i] = 0
      }
    }
  }
}

/**
 * Advances the pins by `dt` seconds (split into fixed steps). Returns the
 * number of steps taken.
 */
export function stepPins(field: PinField, dt: number, input: PinInput): number {
  if (!(dt > 0)) return 0
  updateRest(field, input)
  const steps = Math.min(
    PIN_PHYSICS.maxSteps,
    Math.max(1, Math.round(dt / PIN_PHYSICS.step))
  )
  const h = Math.min(dt, PIN_PHYSICS.step * PIN_PHYSICS.maxSteps) / steps
  for (let s = 0; s < steps; s++) integrate(field, h, input.press)
  return steps
}

/**
 * Strikes the pins around a cell, driving them into the wall at up to
 * `strength` units a second, most at the middle: a ring spreads out from it.
 */
export function strikePins(
  field: PinField,
  col: number,
  row: number,
  strength: number,
  radius: number
): void {
  const { cols, rows, velocity } = field
  const reach = Math.ceil(radius * 2.5)
  const c0 = Math.max(0, Math.floor(col - reach))
  const c1 = Math.min(cols - 1, Math.ceil(col + reach))
  const r0 = Math.max(0, Math.floor(row - reach))
  const r1 = Math.min(rows - 1, Math.ceil(row + reach))
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const d2 = ((c - col) ** 2 + (r - row) ** 2) / (radius * radius)
      velocity[r * cols + c] -= strength * Math.exp(-d2)
    }
  }
}

/** Puts every pin back at rest, e.g. when the wall comes back into view. */
export function settlePins(field: PinField, input: PinInput): void {
  updateRest(field, input)
  field.height.set(field.rest)
  field.velocity.fill(0)
}

// ── Light ────────────────────────────────────────────────────────────────────
/** Channels per pin in what `shadePins` writes. */
export const PIN_CHANNELS = 4

/**
 * The soft light over the wall comes from the top left (straight along the
 * diagonal), low enough that the letters throw a short shadow down and to
 * the right: how steeply it climbs, in units per cell along that diagonal.
 */
const KEY_SLOPE = 0.55
/** Pins further than this (cells) from the cursor's light aren't shadowed by it. */
const LAMP_REACH = 30

export type Lamp = {
  /** The cursor's light, over the wall: cell position and height (units). */
  col: number
  row: number
  height: number
  /** 0 when it's off, so nothing needs working out for it. */
  on: number
}

function heightAt(field: PinField, col: number, row: number): number {
  const c = Math.round(col)
  const r = Math.round(row)
  if (c < 0 || r < 0 || c >= field.cols || r >= field.rows) return -Infinity
  return field.height[r * field.cols + c]
}

/** 0–1: how much the pins between a pin and the cursor's light block it. */
function blocked(
  field: PinField,
  col: number,
  row: number,
  h: number,
  dc: number,
  dr: number,
  slope: number
): number {
  let shadow = 0
  for (let k = 1; k <= 3; k++) {
    const step = k * 1.2
    const over = heightAt(field, col + dc * step, row + dr * step) - (h + slope * step)
    if (over > 0) shadow += Math.min(1, over / 0.7)
  }
  return Math.min(1, shadow)
}

/**
 * Everything the shader needs per pin, four floats each (row by row):
 *   0 height (units)
 *   1 open-ness, 0–1: how much of the soft light reaches it (1 = all; lower
 *     where taller neighbours crowd it or a letter shades it)
 *   2 how much the cursor's light is blocked from it, 0–1
 *   3 how fast it's moving (units a second), for the glints on a ripple
 */
export function shadePins(field: PinField, lamp: Lamp, out: Float32Array): Float32Array {
  const { cols, rows, height: h, velocity: v } = field
  const last = cols - 1
  for (let r = 0; r < rows; r++) {
    const row = r * cols
    const up = r > 0 ? row - cols : row
    const down = r < rows - 1 ? row + cols : row
    for (let c = 0; c < cols; c++) {
      const i = row + c
      const hi = h[i]
      const crowd =
        Math.max(0, h[c > 0 ? i - 1 : i] - hi) +
        Math.max(0, h[c < last ? i + 1 : i] - hi) +
        Math.max(0, h[up + c] - hi) +
        Math.max(0, h[down + c] - hi)
      const ao = Math.max(0.3, 1 - crowd * 0.16)

      // The soft light's shadow: the pins one, two and three steps up and
      // left along the diagonal (each step √2 cells toward the light)
      let keyShadow = 0
      for (let k = 1; k <= 3 && k <= c && k <= r; k++) {
        const over = h[i - k * (cols + 1)] - (hi + KEY_SLOPE * Math.SQRT2 * k)
        if (over > 0) keyShadow += Math.min(1, over / 0.7)
      }
      keyShadow = Math.min(1, keyShadow)

      let lampShadow = 0
      if (lamp.on > 0) {
        const dc = lamp.col - c
        const dr = lamp.row - r
        const d = Math.hypot(dc, dr)
        if (d > 1 && d < LAMP_REACH) {
          lampShadow = blocked(field, c, r, hi, dc / d, dr / d, (lamp.height - hi) / d)
        }
      }

      const o = i * PIN_CHANNELS
      out[o] = hi
      out[o + 1] = ao * (1 - 0.65 * keyShadow)
      out[o + 2] = lampShadow
      out[o + 3] = Math.abs(v[i])
    }
  }
  return out
}
