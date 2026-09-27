import { describe, expect, it } from "vitest"
import { heroFontSize } from "./hero-name"

describe("heroFontSize", () => {
  it("uses 13% of the width on wide screens", () => {
    expect(heroFontSize(1280, 900)).toBeCloseTo(166.4)
  })

  it("never grows past 192px", () => {
    expect(heroFontSize(2560, 1440)).toBe(192)
  })

  it("takes a larger share of the width on tablets and phones", () => {
    expect(heroFontSize(810, 1080)).toBeCloseTo(145.8)
    expect(heroFontSize(390, 844)).toBeCloseTo(85.8)
  })

  it("is capped by the height on short screens", () => {
    // A phone on its side: the width alone would give 152px
    expect(heroFontSize(844, 390)).toBeCloseTo(93.6)
  })
})
