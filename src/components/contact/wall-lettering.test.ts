import { afterEach, describe, expect, it, vi } from "vitest"
import { cellCoverage, drawLettering, splitLines } from "./wall-lettering"

/** RGBA pixels `width` × `height`, with alpha from `alpha(x, y)`. */
function pixels(width: number, height: number, alpha: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data[(y * width + x) * 4 + 3] = alpha(x, y)
  return data
}

describe("cellCoverage", () => {
  it("is 1 for a fully covered cell and 0 for an empty one", () => {
    // 2 × 1 cells of 4 × 4 samples: the left one full, the right one empty
    const data = pixels(8, 4, (x) => (x < 4 ? 255 : 0))
    expect(Array.from(cellCoverage(data, 8, 2, 1, 4))).toEqual([1, 0])
  })

  it("gives the share covered along an edge", () => {
    // Half of each 4-sample column is covered
    const data = pixels(4, 4, (x) => (x < 2 ? 255 : 0))
    expect(cellCoverage(data, 4, 1, 1, 4)[0]).toBeCloseTo(0.5)
  })

  it("goes row by row, from the top", () => {
    const data = pixels(2, 4, (_, y) => (y < 2 ? 255 : 0))
    expect(Array.from(cellCoverage(data, 2, 1, 2, 2))).toEqual([1, 0])
  })

  it("treats cells past the drawing's edge as empty", () => {
    const data = pixels(2, 2, () => 255)
    expect(Array.from(cellCoverage(data, 2, 2, 1, 2))).toEqual([1, 0])
  })
})

describe("splitLines", () => {
  it("keeps everything on one line when asked for one", () => {
    expect(splitLines("SAY HELLO", 1)).toEqual(["SAY HELLO"])
  })

  it("stacks the words for two lines", () => {
    expect(splitLines("SAY HELLO", 2)).toEqual(["SAY", "HELLO"])
  })

  it("balances longer text by length", () => {
    expect(splitLines("GET IN TOUCH NOW", 2)).toEqual(["GET IN", "TOUCH NOW"])
  })

  it("never makes more lines than there are words", () => {
    expect(splitLines("HELLO", 2)).toEqual(["HELLO"])
    expect(splitLines("SAY HELLO", 3)).toEqual(["SAY", "HELLO"])
  })
})

describe("drawLettering", () => {
  const box = { col: 20, row: 10, width: 30, height: 8, lines: 1 }

  afterEach(() => vi.restoreAllMocks())

  it("gives up quietly where there's no 2D canvas", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    expect(drawLettering("Say hello", box, 40, 20)).toBeNull()
  })

  it("draws nothing for blank text", () => {
    const ctx = { font: "" } as unknown as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as RenderingContext
    )
    const coverage = drawLettering("   ", box, 40, 20)
    expect(coverage).toHaveLength(800)
    expect(coverage!.every((v) => v === 0)).toBe(true)
  })
})
