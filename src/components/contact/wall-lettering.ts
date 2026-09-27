/**
 * The words the Contact wall's pins spell out ("SAY HELLO").
 *
 * They're drawn once onto a small canvas, a few samples per pin, in the
 * site's font, condensed and spaced out so each letter stands apart and as
 * tall as it can (and thickened a little, so every stroke is a few pins wide),
 * then each pin takes the share of its cell that's covered: 1 inside a
 * letter, 0 outside, and in between along the edges, so the letters come out
 * with soft, bevelled sides.
 *
 * `cellCoverage` is pure and unit-tested; `drawLettering` needs a real canvas
 * (the browser), so it's verified there.
 */

import type { LetteringBox } from "./wall-choreography"

/** Canvas samples per pin, each way. */
export const LETTER_SAMPLES = 4
/** Extra stroke around each letter, in pins. */
const STROKE = 0.45
/** Space between letters, as a share of the font size. */
const TRACKING = 0.12
/**
 * The font's narrowest width (its wdth axis): the letters can then stand
 * taller in the same space, and tall letters read best in pins.
 */
const STRETCH = "condensed"
const FONT_FAMILY = "'Stellar Core', system-ui, sans-serif"

function setFont(ctx: CanvasRenderingContext2D, size: number) {
  ctx.font = `${STRETCH} 400 ${size}px ${FONT_FAMILY}`
  // Not every browser can space letters on a canvas; they just sit closer there
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${(size * TRACKING).toFixed(2)}px`
}

/**
 * Splits words over `count` lines, as evenly as it can by length (e.g.
 * "SAY HELLO" over two lines is "SAY" / "HELLO"). Never more lines than words.
 */
export function splitLines(text: string, count: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (count <= 1 || words.length <= 1) return [words.join(" ")]
  if (count >= words.length) return words
  // Greedy: fill each line up to an even share of the characters
  const target = words.join(" ").length / count
  const lines: string[] = []
  let current: string[] = []
  for (const word of words) {
    const next = [...current, word].join(" ")
    const linesLeft = count - lines.length
    if (current.length > 0 && next.length > target && linesLeft > 1) {
      lines.push(current.join(" "))
      current = [word]
    } else {
      current.push(word)
    }
  }
  lines.push(current.join(" "))
  return lines
}

/**
 * Averages a canvas's alpha over each cell: `cols` × `rows` cells of
 * `samples` × `samples` pixels (RGBA data, row by row from the top).
 */
export function cellCoverage(
  data: Uint8ClampedArray,
  width: number,
  cols: number,
  rows: number,
  samples: number = LETTER_SAMPLES
): Float32Array {
  const out = new Float32Array(cols * rows)
  const height = data.length / 4 / Math.max(1, width)
  const area = samples * samples * 255
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0
      for (let y = r * samples; y < (r + 1) * samples && y < height; y++) {
        for (let x = c * samples; x < (c + 1) * samples && x < width; x++) {
          sum += data[(y * width + x) * 4 + 3]
        }
      }
      out[r * cols + c] = sum / area
    }
  }
  return out
}

/**
 * Draws `text` into `box` (cells) and returns each pin's coverage, row by
 * row, or null where there's no 2D canvas.
 */
export function drawLettering(
  text: string,
  box: LetteringBox,
  cols: number,
  rows: number
): Float32Array | null {
  if (typeof document === "undefined") return null
  const s = LETTER_SAMPLES
  const canvas = document.createElement("canvas")
  canvas.width = cols * s
  canvas.height = rows * s
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null

  const words = text.trim().toUpperCase()
  if (!words) return new Float32Array(cols * rows)
  const lines = splitLines(words, box.lines)

  // Measure at a reference size, then scale to fit the box both ways
  const reference = 100
  setFont(ctx, reference)
  const metrics = lines.map((line) => ctx.measureText(line))
  const ascent = Math.max(
    ...metrics.map((m) => m.actualBoundingBoxAscent || reference * 0.72)
  )
  const descent = Math.max(...metrics.map((m) => m.actualBoundingBoxDescent || 0))
  const inkWidth = Math.max(
    ...metrics.map(
      (m) => (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width)
    )
  )
  // Stacked lines sit this far apart, baseline to baseline, per unit of ink height
  const leading = 1.3
  const inkHeight = (ascent + descent) * (1 + leading * (lines.length - 1))
  const stroke = STROKE * s
  const fit = Math.min(
    (box.width * s - stroke) / Math.max(1, inkWidth),
    (box.height * s - stroke) / Math.max(1, inkHeight)
  )
  const size = reference * fit

  setFont(ctx, size)
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#fff"
  ctx.strokeStyle = "#fff"
  ctx.lineJoin = "round"
  ctx.lineWidth = stroke
  // Letter spacing trails the last letter too; shift back by half of it
  const x = (box.col + 0.5) * s + (size * TRACKING) / 2
  // Centre the ink (not the em box) on the box's middle
  const step = (ascent + descent) * fit * leading
  const first =
    (box.row + 0.5) * s + ((ascent - descent) * fit) / 2 - (step * (lines.length - 1)) / 2
  lines.forEach((line, i) => {
    ctx.fillText(line, x, first + step * i)
    ctx.strokeText(line, x, first + step * i)
  })

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return cellCoverage(image.data, canvas.width, cols, rows, s)
}
