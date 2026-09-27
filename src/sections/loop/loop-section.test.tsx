/**
 * The loop section's structure in both modes. The wrap back to the top, the
 * hole in the wall and the name's approach are verified manually in-browser
 * (per the `testing` skill).
 */
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"
import "@/lib/i18n"
import en from "@/locales/en.json"
import { LOOP_SCREENS } from "@/hooks/loop"
import { LoopSection } from "./loop-section"

const media = vi.hoisted(() => {
  const state = { matching: new Set<string>() }
  window.matchMedia = ((query: string) => ({
    matches: state.matching.has(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
  return state
})

const HOVER = "(hover: hover) and (pointer: fine)"
const WIDE = "(min-width: 1024px)"
const REDUCE = "(prefers-reduced-motion: reduce)"

const lenis = vi.hoisted(() => ({
  current: {
    options: { infinite: false } as Record<string, unknown>,
    targetScroll: 0,
    scroll: 0,
    limit: 1000,
    resize: () => {},
    on: () => () => {},
  },
}))
vi.mock("@/context/scroll", () => ({ useLenis: () => lenis.current }))

describe("LoopSection", () => {
  afterEach(() => {
    media.matching = new Set()
  })

  describe("without the loop (touch, reduced motion)", () => {
    for (const [name, queries] of [
      ["touch", []],
      ["touch, wide", [WIDE]],
      ["reduced motion", [HOVER, WIDE, REDUCE]],
    ] as const) {
      it(`isn't there: the page ends at Contact (${name})`, () => {
        media.matching = new Set(queries)
        const { container } = render(<LoopSection />)
        expect(container).toBeEmptyDOMElement()
      })
    }
  })

  it("loops in a narrow window too, as long as there's a mouse", () => {
    media.matching = new Set([HOVER])
    const { container } = render(<LoopSection />)
    expect(container).not.toBeEmptyDOMElement()
  })

  describe("immersive mode", () => {
    beforeEach(() => {
      media.matching = new Set([HOVER, WIDE])
    })

    it("adds the loop's scroll length after Contact", () => {
      const { container } = render(<LoopSection />)
      const loop = container.querySelector<HTMLElement>("[data-page-loop]")!
      expect(loop.style.height).toBe(`${LOOP_SCREENS * 100}vh`)
    })

    it("ends on a copy of the Hero's text, hidden from assistive tech and inert", () => {
      const { container } = render(<LoopSection />)
      const loop = container.querySelector<HTMLElement>("[data-page-loop]")!
      expect(loop).toHaveAttribute("aria-hidden", "true")
      expect(loop).toHaveAttribute("inert")
      expect(loop).toHaveTextContent(en.hero.tagline)
      // Nothing in it is reachable
      expect(screen.queryByRole("link")).not.toBeInTheDocument()
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })

    it("switches Lenis to its infinite scroll", () => {
      render(<LoopSection />)
      expect(lenis.current.options.infinite).toBe(true)
    })

    it("has no accessibility violations", async () => {
      const { container } = render(<LoopSection />)
      expect(await axe(container)).toHaveNoViolations()
    })
  })
})
