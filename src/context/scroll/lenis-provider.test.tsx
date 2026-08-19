import { render, renderHook, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { axe } from "vitest-axe"
import type { ReactNode } from "react"
import { LenisProvider, useLenis } from "./lenis-provider"

// ── Module mocks ────────────────────────────────────────────────────────────
// Lenis and GSAP are animation-runtime dependencies — they have no meaningful
// behaviour in jsdom. We mock them to verify wiring, not animation outcomes.

vi.mock("lenis", () => ({
  default: vi.fn().mockReturnValue({
    raf: vi.fn(),
    destroy: vi.fn(),
  }),
}))

// vi.hoisted lifts these declarations so they're in scope when vi.mock
// factories are evaluated (vi.mock is hoisted to the top of the file).
const { mockTickerAdd, mockTickerRemove, mockTickerLagSmoothing } = vi.hoisted(() => ({
  mockTickerAdd: vi.fn(),
  mockTickerRemove: vi.fn(),
  mockTickerLagSmoothing: vi.fn(),
}))

vi.mock("gsap", () => ({
  gsap: {
    ticker: {
      add: mockTickerAdd,
      remove: mockTickerRemove,
      lagSmoothing: mockTickerLagSmoothing,
    },
  },
}))

// ── matchMedia helper ───────────────────────────────────────────────────────

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("LenisProvider", () => {
  beforeEach(() => {
    setReducedMotion(false) // default: smooth scroll enabled
    vi.clearAllMocks()
  })

  it("renders children", () => {
    render(
      <LenisProvider>
        <p>scroll content</p>
      </LenisProvider>
    )
    expect(screen.getByText("scroll content")).toBeInTheDocument()
  })

  it("registers a GSAP ticker function on mount", () => {
    render(
      <LenisProvider>
        <span />
      </LenisProvider>
    )
    expect(mockTickerAdd).toHaveBeenCalledOnce()
    expect(mockTickerLagSmoothing).toHaveBeenCalledWith(0)
  })

  it("does NOT register a GSAP ticker when prefers-reduced-motion is set", () => {
    setReducedMotion(true)
    render(
      <LenisProvider>
        <span />
      </LenisProvider>
    )
    expect(mockTickerAdd).not.toHaveBeenCalled()
  })

  it("removes the GSAP ticker and destroys Lenis on unmount", async () => {
    const Lenis = (await import("lenis")).default
    const { unmount } = render(
      <LenisProvider>
        <span />
      </LenisProvider>
    )
    unmount()
    expect(mockTickerRemove).toHaveBeenCalledOnce()
    // destroy() is on the mock instance returned by the Lenis constructor
    const instance = (Lenis as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(instance.destroy).toHaveBeenCalledOnce()
  })

  it("has no accessibility violations", async () => {
    const { container } = render(
      <LenisProvider>
        <main>
          <h1>Portfolio</h1>
        </main>
      </LenisProvider>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe("useLenis", () => {
  beforeEach(() => {
    setReducedMotion(false)
    vi.clearAllMocks()
  })

  it("throws when called outside <LenisProvider>", () => {
    // Suppress the React error boundary console.error noise for this test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => renderHook(() => useLenis())).toThrow(
      "[LenisProvider] useLenis must be called inside <LenisProvider>."
    )
    spy.mockRestore()
  })

  it("returns null when prefers-reduced-motion is active", () => {
    setReducedMotion(true)
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LenisProvider>{children}</LenisProvider>
    )
    const { result } = renderHook(() => useLenis(), { wrapper })
    expect(result.current).toBeNull()
  })
})
