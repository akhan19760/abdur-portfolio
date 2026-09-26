/**
 * The loop's maths (how far off the name is, forward-only scrolling) and its
 * wiring (Lenis's infinite mode switched on and off, the arrival registered
 * for the Hero). The wrap itself, and how seamless it looks, are verified
 * manually in-browser, per the `testing` skill.
 */
import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { loopArrival } from "@/lib/page-loop"
import {
  ARRIVE_SCREENS,
  forwardOnly,
  hasWrapped,
  loopArrivalAt,
  settleScrollAnimations,
  usePageLoop,
} from "./use-page-loop"

// ScrollTrigger calls matchMedia while updating; jsdom doesn't provide it.
vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

type FakeLenis = {
  options: {
    infinite: boolean
    virtualScroll?: (data: { deltaX: number; deltaY: number; event: Event }) => boolean
  }
  targetScroll: number
  /** Where the page is (wrapped), as Lenis reports it. */
  scroll: number
  limit: number
  resize: () => void
  on: (event: "scroll", listener: () => void) => () => void
  /** Moves the page and tells the listeners, as Lenis does each frame. */
  scrollTo: (scroll: number) => void
}

const lenis = vi.hoisted(() => ({ current: null as FakeLenis | null }))
vi.mock("@/context/scroll", () => ({ useLenis: () => lenis.current }))

function fakeLenis(): FakeLenis {
  const listeners = new Set<() => void>()
  const lenis: FakeLenis = {
    options: { infinite: false },
    targetScroll: 0,
    scroll: 0,
    limit: 10_000,
    resize: vi.fn(),
    on: (_event, listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    scrollTo: (scroll) => {
      lenis.scroll = scroll
      for (const listener of listeners) listener()
    },
  }
  return lenis
}

const VIEW = 800

describe("loopArrivalAt", () => {
  it("is null while the loop is below or above the view", () => {
    expect(loopArrivalAt(VIEW + 10, VIEW * 3, VIEW)).toBeNull()
    expect(loopArrivalAt(-VIEW * 3, -10, VIEW)).toBeNull()
  })

  it("is 1 (far off) until the last stretch, then eases to 0 at the page's end", () => {
    // The loop's bottom still two screens below the view's bottom
    expect(loopArrivalAt(0, VIEW * 3, VIEW)).toBe(1)
    // Half way through the approach
    const half = VIEW + (ARRIVE_SCREENS * VIEW) / 2
    expect(loopArrivalAt(half - VIEW * 2, half, VIEW)).toBeCloseTo(0.5)
    // The loop's bottom on the view's bottom: arrived
    expect(loopArrivalAt(-VIEW, VIEW, VIEW)).toBe(0)
  })

  it("is null with no view to speak of", () => {
    expect(loopArrivalAt(0, 100, 0)).toBeNull()
  })
})

describe("hasWrapped", () => {
  const limit = 1000

  it("spots the jump from the end of the page back to the top", () => {
    expect(hasWrapped(990, 12, limit)).toBe(true)
  })

  it("ignores ordinary scrolling, however fast, either way", () => {
    expect(hasWrapped(500, 520, limit)).toBe(false)
    expect(hasWrapped(520, 500, limit)).toBe(false)
    expect(hasWrapped(700, 300, limit)).toBe(false)
    expect(hasWrapped(12, 990, limit)).toBe(false)
  })

  it("never fires on a page with no scroll", () => {
    expect(hasWrapped(10, 0, 0)).toBe(false)
  })
})

describe("settleScrollAnimations", () => {
  afterEach(() => vi.restoreAllMocks())

  it("updates every trigger, then finishes any smoothing at once", () => {
    const update = vi.spyOn(ScrollTrigger, "update").mockImplementation(() => {})
    const smoothing = { progress: vi.fn() }
    vi.spyOn(ScrollTrigger, "getAll").mockReturnValue([
      { getTween: () => smoothing },
      { getTween: () => 0 }, // not smoothed: GSAP gives 0
      { getTween: () => undefined },
    ] as unknown as ScrollTrigger[])
    settleScrollAnimations()
    expect(update).toHaveBeenCalledOnce()
    expect(smoothing.progress).toHaveBeenCalledWith(1)
  })
})

describe("forwardOnly", () => {
  const limit = 1000

  it("leaves forward scrolling alone", () => {
    expect(forwardOnly(0, 120, limit)).toBe(120)
    expect(forwardOnly(990, 120, limit)).toBe(120) // on round the loop
  })

  it("lets the scroll go back up within a lap", () => {
    expect(forwardOnly(500, -120, limit)).toBe(-120)
    expect(forwardOnly(1500, -120, limit)).toBe(-120)
  })

  it("stops at the top instead of wrapping backwards", () => {
    expect(forwardOnly(0, -120, limit)).toBe(0)
    expect(forwardOnly(50, -120, limit)).toBe(-50)
    // After going round once, the top of the page is at one lap
    expect(forwardOnly(1000, -120, limit)).toBe(0)
    expect(forwardOnly(1030, -120, limit)).toBe(-30)
  })

  it("does nothing on a page with no scroll", () => {
    expect(forwardOnly(0, -120, 0)).toBe(-120)
  })
})

type HarnessProps = { enabled: boolean }

function Harness({ enabled }: HarnessProps) {
  const { loopRef, copyRef } = usePageLoop<HTMLDivElement, HTMLDivElement>({ enabled })
  return (
    <div ref={loopRef} data-testid="loop">
      <div ref={copyRef} data-testid="copy" />
    </div>
  )
}

describe("usePageLoop", () => {
  afterEach(() => {
    lenis.current = null
  })

  it("turns Lenis's infinite scroll on, and back off on unmount", () => {
    const instance = fakeLenis()
    lenis.current = instance
    const { unmount } = render(<Harness enabled />)
    expect(instance.options.infinite).toBe(true)
    expect(typeof instance.options.virtualScroll).toBe("function")
    unmount()
    expect(instance.options.infinite).toBe(false)
    expect(instance.options.virtualScroll).toBeUndefined()
    expect(instance.resize).toHaveBeenCalled()
  })

  it("stops a scroll up at the top of the page", () => {
    const instance = fakeLenis()
    lenis.current = instance
    render(<Harness enabled />)
    const data = { deltaX: 0, deltaY: -80, event: new Event("wheel") }
    instance.targetScroll = 0
    expect(instance.options.virtualScroll!(data)).toBe(true)
    expect(data.deltaY).toBe(0)
    const down = { deltaX: 0, deltaY: 80, event: new Event("wheel") }
    instance.options.virtualScroll!(down)
    expect(down.deltaY).toBe(80)
  })

  it("tells the Hero how far off its name is", () => {
    lenis.current = fakeLenis()
    const { getByTestId, unmount } = render(<Harness enabled />)
    // jsdom lays nothing out: the loop sits at 0 × 0, above the view's bottom
    vi.spyOn(getByTestId("loop"), "getBoundingClientRect").mockReturnValue({
      top: -window.innerHeight,
      bottom: window.innerHeight,
    } as DOMRect)
    expect(loopArrival()).toBe(0)
    unmount()
    expect(loopArrival()).toBeNull()
  })

  it("fades the copy of the Hero's text with the name's approach", () => {
    lenis.current = fakeLenis()
    const { getByTestId } = render(<Harness enabled />)
    expect(getByTestId("copy").style.getPropertyValue("--hero-exit")).not.toBe("")
  })

  it("settles the page's scroll animations the moment the scroll wraps, and only then", () => {
    const instance = fakeLenis()
    lenis.current = instance
    const update = vi.spyOn(ScrollTrigger, "update").mockImplementation(() => {})
    vi.spyOn(ScrollTrigger, "getAll").mockReturnValue([])
    const { unmount } = render(<Harness enabled />)
    instance.scrollTo(4000)
    instance.scrollTo(9_900)
    expect(update).not.toHaveBeenCalled()
    instance.scrollTo(30) // round the loop
    expect(update).toHaveBeenCalledOnce()
    unmount()
    instance.scrollTo(9_900)
    instance.scrollTo(30)
    expect(update).toHaveBeenCalledOnce()
    vi.restoreAllMocks()
  })

  it("leaves Lenis alone when disabled, or when there's no smooth scroll", () => {
    const instance = fakeLenis()
    lenis.current = instance
    render(<Harness enabled={false} />)
    expect(instance.options.infinite).toBe(false)
    lenis.current = null
    expect(() => render(<Harness enabled />)).not.toThrow()
    expect(loopArrival()).toBeNull()
  })
})
