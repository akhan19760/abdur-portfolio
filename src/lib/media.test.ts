import { describe, it, expect, vi, afterEach } from "vitest"
import {
  canHover,
  isCompact,
  matchesMedia,
  prefersImmersive,
  prefersPageLoop,
  prefersReducedMotion,
} from "./media"

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

  const HOVER = "(hover: hover) and (pointer: fine)"
  const WIDE = "(min-width: 1024px)"
  const REDUCE = "(prefers-reduced-motion: reduce)"

  describe("prefersImmersive", () => {
    it("is true on any device without a reduced-motion preference", () => {
      mockMatchMedia([HOVER, WIDE])
      expect(prefersImmersive()).toBe(true)
      // A phone: touch, narrow
      mockMatchMedia([])
      expect(prefersImmersive()).toBe(true)
    })

    it("is false with reduced motion", () => {
      mockMatchMedia([HOVER, WIDE, REDUCE])
      expect(prefersImmersive()).toBe(false)
    })
  })

  describe("isCompact", () => {
    it("is true below 1024px and false from 1024px up", () => {
      mockMatchMedia([])
      expect(isCompact()).toBe(true)
      mockMatchMedia([WIDE])
      expect(isCompact()).toBe(false)
    })

    it("assumes a wide screen without matchMedia", () => {
      expect(isCompact()).toBe(false)
    })
  })

  describe("prefersPageLoop", () => {
    it("is true with a mouse and no reduced-motion preference", () => {
      mockMatchMedia([HOVER])
      expect(prefersPageLoop()).toBe(true)
    })

    it("is false on touch or with reduced motion", () => {
      mockMatchMedia([WIDE])
      expect(prefersPageLoop()).toBe(false)
      mockMatchMedia([HOVER, REDUCE])
      expect(prefersPageLoop()).toBe(false)
    })
  })
})
