import { describe, expect, it } from "vitest"
import { isPortrait, paperScreen, portraitAmount } from "./stage-framing"

describe("stage framing", () => {
  it("treats a view at least as tall as it is wide as portrait", () => {
    expect(isPortrait(390 / 844)).toBe(true)
    expect(isPortrait(1)).toBe(true)
    expect(isPortrait(1440 / 900)).toBe(false)
  })

  it("measures how tall a portrait view is, from square to a tall phone", () => {
    expect(portraitAmount(1.6)).toBe(0)
    expect(portraitAmount(1)).toBe(0)
    expect(portraitAmount(0.73)).toBeCloseTo(0.5, 1)
    expect(portraitAmount(0.46)).toBe(1)
    expect(portraitAmount(0.3)).toBe(1)
  })

  it("puts the paper right of centre in landscape and centred up top in portrait", () => {
    expect(paperScreen(1.6)).toEqual({ sx: 0.63, sy: 0.5 })
    const portrait = paperScreen(0.5)
    expect(portrait.sx).toBe(0.5)
    expect(portrait.sy).toBeLessThan(0.4)
  })
})
