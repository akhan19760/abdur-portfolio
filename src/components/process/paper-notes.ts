/**
 * The pencil notes on the Process sheet (Discover): the questions you ask
 * before building anything, jotted around a rough sketch of a page. Drawn
 * once into a canvas that maps onto the flat sheet (its top edge is the
 * sheet's nose edge).
 *
 * The paper shader uses the drawing's alpha as graphite. Each item (a note,
 * or the sketch) is drawn in its own shade of red, its ID, so the shader can
 * make just the one under the cursor glow purple; `regions` says where each
 * item is, so the paper can tell which one that is (`noteAt`).
 */

import { SHEET_LENGTH, SHEET_WIDTH } from "./paper-fold"

/** Where each note sits (0–1 across and down the sheet), its tilt and size (px at 1024 wide). */
const SLOTS = [
  { x: 0.08, y: 0.13, tilt: -0.06, size: 64 },
  { x: 0.08, y: 0.3, tilt: 0.03, size: 50 },
  { x: 0.5, y: 0.47, tilt: -0.05, size: 58 },
  { x: 0.1, y: 0.62, tilt: 0.05, size: 54 },
  { x: 0.44, y: 0.76, tilt: -0.03, size: 54 },
  { x: 0.12, y: 0.9, tilt: 0.02, size: 58 },
] as const

/** How many items the drawing can hold (the shader keeps a glow for each). */
export const NOTE_ITEMS = 8
/** Red-channel step between item IDs: item `id` is drawn in red (id + 1) × this / 255. */
export const NOTE_ID_STEP = 28
/** The sketch's ID (after the notes). */
const SKETCH_ID = SLOTS.length

/** An item's box on the canvas (px), in its own tilted frame. */
export type NoteRegion = {
  id: number
  /** The frame's origin and tilt (radians). */
  x: number
  y: number
  tilt: number
  left: number
  top: number
  right: number
  bottom: number
}

export type NotesDrawing = {
  canvas: HTMLCanvasElement
  regions: NoteRegion[]
}

/** The ID of the item at a point on the canvas (px), or −1. */
export function noteAt(regions: readonly NoteRegion[], px: number, py: number): number {
  for (const r of regions) {
    const dx = px - r.x
    const dy = py - r.y
    const c = Math.cos(r.tilt)
    const s = Math.sin(r.tilt)
    const lx = dx * c + dy * s
    const ly = -dx * s + dy * c
    if (lx >= r.left && lx <= r.right && ly >= r.top && ly <= r.bottom) return r.id
  }
  return -1
}

const idColour = (id: number) => `rgb(${(id + 1) * NOTE_ID_STEP}, 0, 0)`

/** Deterministic randomness, so the sketch is the same every time. */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Pt = [number, number]

/** A wobbly, twice-traced pencil line through `points`. */
function sketchLine(ctx: CanvasRenderingContext2D, points: Pt[], rand: () => number) {
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalAlpha = pass === 0 ? 0.85 : 0.35
    ctx.beginPath()
    points.forEach(([x, y], i) => {
      const jx = (rand() - 0.5) * 5
      const jy = (rand() - 0.5) * 5
      if (i === 0) ctx.moveTo(x + jx, y + jy)
      else ctx.lineTo(x + jx, y + jy)
    })
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function sketchRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rand: () => number
) {
  sketchLine(
    ctx,
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y + 2],
    ],
    rand
  )
}

/**
 * Draws the notes; returns null where there's no 2D canvas (tests, very old
 * browsers). `width` is the canvas width in px; its height follows the sheet.
 */
export function drawNotes(notes: readonly string[], width = 1280): NotesDrawing | null {
  if (typeof document === "undefined") return null
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = Math.round((width * SHEET_LENGTH) / SHEET_WIDTH)
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  const s = width / 1024
  const H = canvas.height
  const pad = 22 * s
  const rand = seeded(7)
  const regions: NoteRegion[] = []
  ctx.clearRect(0, 0, width, H)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.lineWidth = 3.6 * s

  // ── A rough sketch of a page, top right ──
  const sx = 0.56 * width
  const sy = 0.08 * H
  const sw = 0.34 * width
  const sh = 0.25 * H
  ctx.strokeStyle = idColour(SKETCH_ID)
  sketchRect(ctx, sx, sy, sw, sh, rand) // the window
  sketchLine(
    ctx,
    [
      [sx, sy + 0.12 * sh],
      [sx + sw, sy + 0.12 * sh],
    ],
    rand
  ) // its bar
  sketchRect(ctx, sx + 0.08 * sw, sy + 0.2 * sh, 0.84 * sw, 0.34 * sh, rand) // a big block
  for (let i = 0; i < 3; i++) {
    sketchRect(
      ctx,
      sx + (0.08 + i * 0.29) * sw,
      sy + 0.62 * sh,
      0.26 * sw,
      0.28 * sh,
      rand
    )
  }
  // Scribbled lines of text inside the big block
  for (let i = 0; i < 3; i++) {
    const y = sy + (0.29 + i * 0.08) * sh
    sketchLine(
      ctx,
      [
        [sx + 0.14 * sw, y],
        [sx + (0.6 - i * 0.12) * sw, y + 2 * s],
      ],
      rand
    )
  }
  regions.push({
    id: SKETCH_ID,
    x: sx,
    y: sy,
    tilt: 0,
    left: -pad,
    top: -pad,
    right: sw + pad,
    bottom: sh + pad,
  })

  // ── The questions ──
  const count = Math.min(notes.length, SLOTS.length)
  notes.slice(0, count).forEach((note, i) => {
    const slot = SLOTS[i]
    const size = slot.size * s
    const x = slot.x * width
    const y = slot.y * H
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(slot.tilt)
    ctx.font = `400 ${Math.round(size)}px 'Stellar Core', system-ui, sans-serif`
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = idColour(i)
    ctx.strokeStyle = idColour(i)
    ctx.globalAlpha = 0.9
    ctx.fillText(note, 0, 0)
    ctx.globalAlpha = 0.3
    ctx.fillText(note, 1.2 * s, 0.8 * s)
    ctx.globalAlpha = 1
    const w = ctx.measureText(note).width
    const region = {
      id: i,
      x,
      y,
      tilt: slot.tilt,
      left: -pad,
      top: -size * 0.85 - pad,
      right: w + pad,
      bottom: size * 0.3 + pad,
    }

    if (i === 0) {
      // An arrow from the first question over to the sketch
      const c = Math.cos(slot.tilt)
      const sn = Math.sin(slot.tilt)
      const ex = x + (w + 20 * s) * c + size * 0.35 * sn
      const ey = y + (w + 20 * s) * sn - size * 0.35 * c
      const tipX = sx - 16 * s
      const tipY = sy + 0.4 * sh
      ctx.restore()
      ctx.save()
      ctx.strokeStyle = idColour(SKETCH_ID)
      sketchLine(
        ctx,
        [
          [ex, ey],
          [(ex + tipX) / 2, Math.min(ey, tipY) - 40 * s],
          [tipX, tipY],
        ],
        rand
      )
      sketchLine(
        ctx,
        [
          [tipX - 22 * s, tipY - 4 * s],
          [tipX, tipY],
          [tipX - 8 * s, tipY - 22 * s],
        ],
        rand
      )
    } else if (i === 2) {
      // A circle round the third one
      const rx = w / 2 + 36 * s
      const ry = size * 0.95
      const ring: Pt[] = []
      for (let a = 0; a <= Math.PI * 2.15; a += 0.2) {
        ring.push([w / 2 + Math.cos(a) * rx, -size * 0.3 + Math.sin(a) * ry])
      }
      sketchLine(ctx, ring, rand)
      region.left = Math.min(region.left, w / 2 - rx - pad)
      region.right = Math.max(region.right, w / 2 + rx + pad)
      region.top = Math.min(region.top, -size * 0.3 - ry - pad)
      region.bottom = Math.max(region.bottom, -size * 0.3 + ry + pad)
    } else if (i === count - 1) {
      // Underline the last one: the plan
      sketchLine(
        ctx,
        [
          [0, 14 * s],
          [w * 0.5, 18 * s],
          [w, 12 * s],
        ],
        rand
      )
    }
    ctx.restore()
    regions.push(region)
  })

  return { canvas, regions }
}
