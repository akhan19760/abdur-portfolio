import { describe, it, expect, vi } from "vitest"
import {
  REVEAL_DIM,
  REVEAL_SOFT,
  applyStatementReveal,
  charColor,
  charReveal,
} from "./statement-reveal"

describe("charReveal", () => {
  it("leaves every character unrevealed at 0", () => {
    for (let i = 0; i < 20; i++) expect(charReveal(0, i, 20)).toBe(0)
  })

  it("finishes every character, including the last, at 1", () => {
    for (let i = 0; i < 20; i++) expect(charReveal(1, i, 20)).toBe(1)
  })

  it("sweeps in reading order: earlier characters are always further along", () => {
    for (const reveal of [0.2, 0.5, 0.8]) {
      for (let i = 1; i < 20; i++) {
        expect(charReveal(reveal, i - 1, 20)).toBeGreaterThanOrEqual(
          charReveal(reveal, i, 20)
        )
      }
    }
  })

  it("blends over a soft edge rather than snapping", () => {
    const amounts = Array.from({ length: 40 }, (_, i) => charReveal(0.5, i, 40))
    const partial = amounts.filter((a) => a > 0 && a < 1)
    expect(partial.length).toBeGreaterThanOrEqual(REVEAL_SOFT - 1)
    expect(partial.length).toBeLessThanOrEqual(REVEAL_SOFT)
  })

  it("stays within 0–1 outside the sweep", () => {
    expect(charReveal(-1, 0, 10)).toBe(0)
    expect(charReveal(2, 9, 10)).toBe(1)
  })
})

describe("charColor", () => {
  it("is the dim grey when unrevealed", () => {
    expect(charColor(0)).toBe(REVEAL_DIM)
  })

  it("is empty (the character's own colour) when fully revealed", () => {
    expect(charColor(1)).toBe("")
  })

  it("blends toward the character's own colour in between", () => {
    expect(charColor(0.37)).toBe(`color-mix(in srgb, currentcolor 37%, ${REVEAL_DIM})`)
  })
})

function statement(text: string) {
  const p = document.createElement("p")
  for (const char of text) {
    const span = document.createElement("span")
    span.dataset.char = ""
    span.textContent = char
    p.appendChild(span)
  }
  return p
}

describe("applyStatementReveal", () => {
  it("dims every character at 0 and clears them all at 1", () => {
    const p = statement("hello world")
    const chars = Array.from(p.querySelectorAll<HTMLElement>("[data-char]"))

    applyStatementReveal(p, 0)
    for (const c of chars) expect(c.style.getPropertyValue("color")).not.toBe("")

    applyStatementReveal(p, 1)
    for (const c of chars) expect(c.style.getPropertyValue("color")).toBe("")
  })

  it("only writes the characters whose colour changed", () => {
    const p = statement("a sentence long enough to have a quiet middle")
    const chars = Array.from(p.querySelectorAll<HTMLElement>("[data-char]"))
    applyStatementReveal(p, 0.5)

    const spies = chars.map((c) => [
      vi.spyOn(c.style, "setProperty"),
      vi.spyOn(c.style, "removeProperty"),
    ])
    applyStatementReveal(p, 0.5)
    for (const [set, remove] of spies) {
      expect(set).not.toHaveBeenCalled()
      expect(remove).not.toHaveBeenCalled()
    }

    applyStatementReveal(p, 0.52)
    const touched = spies.filter(
      ([set, remove]) => set.mock.calls.length + remove.mock.calls.length > 0
    )
    expect(touched.length).toBeGreaterThan(0)
    expect(touched.length).toBeLessThanOrEqual(REVEAL_SOFT + 1)
  })
})
