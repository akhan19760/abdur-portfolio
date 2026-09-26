import { render } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { axe } from "vitest-axe"
import { CursorLight } from "./cursor-light"

// ── matchMedia helper ─────────────────────────────────────────────────────────

function mockCanHover(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CursorLight", () => {
  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
    vi.clearAllMocks()
  })

  // ── Rendering ───────────────────────────────────────────────────────────────

  it("renders the overlay on hover-capable devices", () => {
    mockCanHover(true)
    const { getByTestId } = render(<CursorLight />)
    expect(getByTestId("cursor-light")).toBeInTheDocument()
  })

  it("renders when matchMedia is unavailable", () => {
    const { getByTestId } = render(<CursorLight />)
    expect(getByTestId("cursor-light")).toBeInTheDocument()
  })

  it("renders nothing on devices that can't hover (touch)", () => {
    mockCanHover(false)
    const { container } = render(<CursorLight />)
    expect(container).toBeEmptyDOMElement()
  })

  it("queries for a hover-capable fine pointer", () => {
    mockCanHover(true)
    render(<CursorLight />)
    expect(window.matchMedia).toHaveBeenCalledWith("(hover: hover) and (pointer: fine)")
  })

  // ── Scoping ─────────────────────────────────────────────────────────────────

  it("is absolutely positioned to fill its parent, not fixed to the viewport", () => {
    const { getByTestId } = render(<CursorLight />)
    const el = getByTestId("cursor-light")
    expect(el).toHaveClass("absolute", "inset-0")
    expect(el).not.toHaveClass("fixed")
  })

  it("lays the gradient out against the viewport via a fixed background", () => {
    const { getByTestId } = render(<CursorLight />)
    expect(getByTestId("cursor-light").style.backgroundAttachment).toBe("fixed")
  })

  it("does not intercept pointer events", () => {
    const { getByTestId } = render(<CursorLight />)
    expect(getByTestId("cursor-light")).toHaveClass("pointer-events-none")
  })

  // ── Gradient ────────────────────────────────────────────────────────────────

  it("centres the light on the --cursor-x / --cursor-y variables", () => {
    const { getByTestId } = render(<CursorLight />)
    const style = getByTestId("cursor-light").getAttribute("style") ?? ""
    expect(style).toContain("var(--cursor-x, 50%) var(--cursor-y, 50%)")
  })

  it("uses the Hero's original radius and darkness by default", () => {
    const { getByTestId } = render(<CursorLight />)
    const style = getByTestId("cursor-light").getAttribute("style") ?? ""
    expect(style).toContain("rgba(0,0,0,0.85) 900px")
  })

  it("applies custom radius and darkness", () => {
    const { getByTestId } = render(<CursorLight radius={500} darkness={0.6} />)
    const style = getByTestId("cursor-light").getAttribute("style") ?? ""
    expect(style).toContain("rgba(0,0,0,0.6) 500px")
  })

  // ── Layering ────────────────────────────────────────────────────────────────

  it("sits above section content (z-10) by default", () => {
    const { getByTestId } = render(<CursorLight />)
    expect(getByTestId("cursor-light")).toHaveClass("z-[11]")
  })

  it("lets className override the z-index", () => {
    const { getByTestId } = render(<CursorLight className="z-30" />)
    const el = getByTestId("cursor-light")
    expect(el).toHaveClass("z-30")
    expect(el).not.toHaveClass("z-[11]")
  })

  // ── Accessibility ───────────────────────────────────────────────────────────

  it("is hidden from assistive technology", () => {
    const { getByTestId } = render(<CursorLight />)
    expect(getByTestId("cursor-light")).toHaveAttribute("aria-hidden", "true")
  })

  it("passes axe accessibility audit", async () => {
    const { container } = render(
      <section aria-label="Test section" className="relative">
        <p>Content under the light</p>
        <CursorLight />
      </section>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
