import { render } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { axe } from "vitest-axe"
import { LoadingScreen } from "./loading-screen"
import { useLoadingState } from "@/hooks/loading-screen/use-loading-state"

// ── Module mocks ─────────────────────────────────────────────────────────────
// GSAP, @gsap/react, and useLoadingState are mocked so tests verify DOM
// structure and accessibility, not animation timing.

vi.mock("gsap", () => ({
  gsap: {
    to: vi.fn(),
    fromTo: vi.fn(),
    from: vi.fn(),
    set: vi.fn(),
    delayedCall: vi.fn(),
  },
}))

vi.mock("@gsap/react", () => ({
  useGSAP: vi.fn(),
}))

vi.mock("@/hooks/loading-screen/use-loading-state", () => ({
  useLoadingState: vi.fn().mockReturnValue("loading"),
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LoadingScreen", () => {
  beforeEach(() => {
    vi.mocked(useLoadingState).mockReturnValue("loading")
  })

  it("renders the overlay when state is 'loading'", () => {
    const { container } = render(<LoadingScreen />)
    expect(container.firstChild).not.toBeNull()
  })

  it("renders all eight terminal log lines", () => {
    render(<LoadingScreen />)
    expect(document.querySelectorAll(".js-log-line")).toHaveLength(8)
  })

  it("renders the ERROR log line in a distinct red colour class", () => {
    render(<LoadingScreen />)
    const logLines = Array.from(document.querySelectorAll(".js-log-line"))
    const errorLine = logLines.find((el) => el.textContent?.includes("ERROR"))
    expect(errorLine).toBeDefined()
    expect(errorLine?.className).toMatch(/text-\[#ff4444\]/)
  })

  it("marks the overlay as aria-hidden", () => {
    const { container } = render(<LoadingScreen />)
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true")
  })

  it("renders the counter element starting at 000", () => {
    render(<LoadingScreen />)
    // Counter starts at static "000" in JSX; GSAP (mocked) would overwrite at runtime
    const counters = document.querySelectorAll(".tabular-nums")
    expect(counters.length).toBeGreaterThan(0)
    expect(counters[0].textContent).toBe("000")
  })

  it("renders the five distinct background elements", () => {
    render(<LoadingScreen />)
    // EQ bars
    expect(document.querySelectorAll(".js-eq-bar")).toHaveLength(10)
    // Status bars
    expect(document.querySelectorAll(".js-status-bar")).toHaveLength(4)
    // Ghost text watermark (initial text is GHOST_TEXT constant)
    const ghostTexts = document.querySelectorAll("[style*='10vw'], [style*='11 vw']")
    expect(ghostTexts.length).toBeGreaterThan(0)
    // Targeting reticle (contains "TGT_LOCK" label)
    expect(document.body.innerHTML).toContain("TGT_LOCK")
    // Radar canvas (has a canvas sibling to the "SCAN_ACTIVE" label)
    expect(document.body.innerHTML).toContain("SCAN_ACTIVE")
  })

  it("renders nothing when state is 'done'", () => {
    vi.mocked(useLoadingState).mockReturnValue("done")
    const { container } = render(<LoadingScreen />)
    expect(container.firstChild).toBeNull()
  })

  it("has no accessibility violations", async () => {
    const { container } = render(
      <div>
        <main>
          <h1>Portfolio</h1>
        </main>
        <LoadingScreen />
      </div>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
