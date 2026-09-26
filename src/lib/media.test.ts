import { describe, it, expect, vi, afterEach } from "vitest"
import { canHover, matchesMedia, prefersImmersive, prefersReducedMotion } from "./media"

function mockMatchMedia(matching: string[]) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matching.includes(query),
    media: query,
  }))
}

describe("media helpers", () => {
  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
  })

  describe("matchesMedia", () => {
    it("returns the query result when matchMedia exists", () => {
      mockMatchMedia(["(min-width: 1024px)"])
      expect(matchesMedia("(min-width: 1024px)", false)).toBe(true)
      expect(matchesMedia("(min-width: 2000px)", true)).toBe(false)
    })

    it("returns the fallback when matchMedia is missing", () => {
      expect(matchesMedia("(min-width: 1024px)", true)).toBe(true)
      expect(matchesMedia("(min-width: 1024px)", false)).toBe(false)
    })
  })

  describe("canHover", () => {
    it("is true for a hover-capable fine pointer", () => {
      mockMatchMedia(["(hover: hover) and (pointer: fine)"])
      expect(canHover()).toBe(true)
    })

    it("is false on touch devices", () => {
      mockMatchMedia([])
      expect(canHover()).toBe(false)
    })

    it("assumes a mouse without matchMedia", () => {
      expect(canHover()).toBe(true)
    })
  })

  describe("prefersReducedMotion", () => {
    it("is true when reduced motion is requested", () => {
      mockMatchMedia(["(prefers-reduced-motion: reduce)"])
      expect(prefersReducedMotion()).toBe(true)
    })

    it("is false otherwise", () => {
      mockMatchMedia([])
      expect(prefersReducedMotion()).toBe(false)
    })

    it("assumes no preference without matchMedia", () => {
      expect(prefersReducedMotion()).toBe(false)
    })
  })

  describe("prefersImmersive", () => {
    const HOVER = "(hover: hover) and (pointer: fine)"
    const WIDE = "(min-width: 1024px)"

    it("is true for a wide screen with a mouse and no motion preference", () => {
      mockMatchMedia([HOVER, WIDE])
      expect(prefersImmersive()).toBe(true)
    })

    it("is false on touch, narrow screens or with reduced motion", () => {
      mockMatchMedia([WIDE])
      expect(prefersImmersive()).toBe(false)
      mockMatchMedia([HOVER])
      expect(prefersImmersive()).toBe(false)
      mockMatchMedia([HOVER, WIDE, "(prefers-reduced-motion: reduce)"])
      expect(prefersImmersive()).toBe(false)
    })
  })
})
