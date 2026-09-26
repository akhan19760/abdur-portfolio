import { afterEach, describe, expect, it, vi } from "vitest"
import { NOTE_ID_STEP, NOTE_ITEMS, drawNotes, noteAt } from "./paper-notes"
import type { NoteRegion } from "./paper-notes"
import { SHEET_LENGTH, SHEET_WIDTH } from "./paper-fold"

/** Just enough of a 2D context to record what gets drawn, and in which colour. */
function stubContext() {
  const drawn: { text: string; colour: string }[] = []
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    fillText: vi.fn((text: string) => drawn.push({ text, colour: ctx.fillStyle })),
    measureText: vi.fn(() => ({ width: 200 })),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
  }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  )
  return { ctx, drawn }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("drawNotes", () => {
  it("returns null where there's no 2D canvas", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    expect(drawNotes(["who is it for?"])).toBeNull()
  })

  it("draws a canvas shaped like the sheet", () => {
    stubContext()
    const { canvas } = drawNotes(["a", "b"], 512)!
    expect(canvas.width).toBe(512)
    expect(canvas.height).toBe(Math.round((512 * SHEET_LENGTH) / SHEET_WIDTH))
  })

  it("writes every note, up to six, each in its own ID colour", () => {
    const { drawn } = stubContext()
    const notes = ["one", "two", "three", "four", "five", "six", "seven"]
    drawNotes(notes)
    expect([...new Set(drawn.map((d) => d.text))]).toEqual(notes.slice(0, 6))
    const colours = notes
      .slice(0, 6)
      .map((note) => drawn.find((d) => d.text === note)!.colour)
    expect(colours).toEqual(
      colours.map((_, id) => `rgb(${(id + 1) * NOTE_ID_STEP}, 0, 0)`)
    )
    // Every ID fits in a colour channel and in the shader's glow list
    expect(NOTE_ITEMS * NOTE_ID_STEP).toBeLessThanOrEqual(255)
  })

  it("maps out where each note and the sketch are", () => {
    stubContext()
    const { regions } = drawNotes(["one", "two", "three"])!
    expect(regions.map((r) => r.id).sort()).toEqual([0, 1, 2, 6])
    regions.forEach((r) => {
      expect(r.right).toBeGreaterThan(r.left)
      expect(r.bottom).toBeGreaterThan(r.top)
    })
  })

  it("sketches a page even with no notes", () => {
    const { ctx } = stubContext()
    const { regions } = drawNotes([])!
    expect(ctx.fillText).not.toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
    expect(regions).toHaveLength(1)
  })
})

describe("noteAt", () => {
  const flat: NoteRegion = {
    id: 3,
    x: 100,
    y: 200,
    tilt: 0,
    left: 0,
    top: -40,
    right: 300,
    bottom: 10,
  }
  const tilted: NoteRegion = { ...flat, id: 5, y: 600, tilt: Math.PI / 2 }

  it("finds the item under a point", () => {
    expect(noteAt([flat], 250, 190)).toBe(3)
    expect(noteAt([flat], 99, 190)).toBe(-1)
    expect(noteAt([flat], 250, 215)).toBe(-1)
  })

  it("follows an item's tilt", () => {
    // Turned a quarter turn, its box runs down the page from its origin
    expect(noteAt([tilted], 105, 800)).toBe(5)
    expect(noteAt([tilted], 300, 610)).toBe(-1)
  })

  it("returns −1 with nothing drawn", () => {
    expect(noteAt([], 10, 10)).toBe(-1)
  })
})
