import { describe, expect, it } from "vitest"
import { SLOT_HEIGHT, SLOT_WIDTH, atlasLayout, coverCrop, slotOrigin } from "./sea-panels"

describe("atlasLayout", () => {
  it("packs two screens per row", () => {
    expect(atlasLayout(4)).toEqual({
      columns: 2,
      rows: 2,
      width: 2 * SLOT_WIDTH,
      height: 2 * SLOT_HEIGHT,
    })
    expect(atlasLayout(5).rows).toBe(3)
  })

  it("always has at least one row", () => {
    expect(atlasLayout(0).rows).toBe(1)
  })

  it("keeps the screens' 16:9 shape", () => {
    expect(SLOT_WIDTH / SLOT_HEIGHT).toBeCloseTo(16 / 9)
  })
})

describe("slotOrigin", () => {
  it("fills rows left to right, top to bottom", () => {
    const layout = atlasLayout(4)
    expect(slotOrigin(0, layout)).toEqual({ x: 0, y: 0 })
    expect(slotOrigin(1, layout)).toEqual({ x: SLOT_WIDTH, y: 0 })
    expect(slotOrigin(2, layout)).toEqual({ x: 0, y: SLOT_HEIGHT })
  })
})

describe("coverCrop", () => {
  it("crops the sides of a wide image", () => {
    const crop = coverCrop(3200, 1000)
    expect(crop.sh).toBe(1000)
    expect(crop.sw / crop.sh).toBeCloseTo(16 / 9)
    expect(crop.sx).toBeCloseTo((3200 - crop.sw) / 2)
  })

  it("crops the top and bottom of a tall image", () => {
    const crop = coverCrop(1000, 2000)
    expect(crop.sw).toBe(1000)
    expect(crop.sw / crop.sh).toBeCloseTo(16 / 9)
    expect(crop.sy).toBeCloseTo((2000 - crop.sh) / 2)
  })
})
