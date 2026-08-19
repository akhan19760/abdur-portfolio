import { render } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { axe } from "vitest-axe"
import { CustomCursor } from "./custom-cursor"

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockUseCursorPosition = vi.fn()
const mockUseCursorState = vi.fn()

vi.mock("@/hooks/cursor", () => ({
  useCursorPosition: (...args: unknown[]) => mockUseCursorPosition(...args),
  useCursorState: () => mockUseCursorState(),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function pos(x = 100, y = 200) {
  return { raw: { x, y }, lerp: { x, y } }
}

function cursorState(
  overrides: Partial<{ isHovering: boolean; isPressed: boolean; isVisible: boolean }> = {},
) {
  return { isHovering: false, isPressed: false, isVisible: true, ...overrides }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CustomCursor", () => {
  afterEach(() => {
    document.body.style.cursor = ""
    document.documentElement.style.removeProperty("--cursor-x")
    document.documentElement.style.removeProperty("--cursor-y")
    vi.clearAllMocks()
  })

  // ── Accessibility ───────────────────────────────────────────────────────────

  it("all rendered elements have aria-hidden", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState())

    const { container } = render(<CustomCursor />)
    const elements = container.querySelectorAll("*")
    elements.forEach((el) => {
      expect(el.getAttribute("aria-hidden")).toBe("true")
    })
  })

  it("passes axe accessibility audit", async () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState())

    const { container } = render(<CustomCursor />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  // ── Native cursor ───────────────────────────────────────────────────────────

  it("sets cursor: none on body on mount", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState())

    render(<CustomCursor />)
    expect(document.body.style.cursor).toBe("none")
  })

  it("restores body cursor style on unmount", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState())

    const { unmount } = render(<CustomCursor />)
    unmount()
    expect(document.body.style.cursor).toBe("")
  })

  // ── CSS custom properties ───────────────────────────────────────────────────

  it("sets --cursor-x and --cursor-y on documentElement", () => {
    mockUseCursorPosition.mockReturnValue(pos(150, 250))
    mockUseCursorState.mockReturnValue(cursorState())

    render(<CustomCursor />)
    expect(document.documentElement.style.getPropertyValue("--cursor-x")).toBe("150px")
    expect(document.documentElement.style.getPropertyValue("--cursor-y")).toBe("250px")
  })

  it("removes --cursor-x and --cursor-y on unmount", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState())

    const { unmount } = render(<CustomCursor />)
    unmount()
    expect(document.documentElement.style.getPropertyValue("--cursor-x")).toBe("")
    expect(document.documentElement.style.getPropertyValue("--cursor-y")).toBe("")
  })

  // ── Dot position ────────────────────────────────────────────────────────────

  it("dot is positioned via left/top at lerp coordinates", () => {
    mockUseCursorPosition.mockReturnValue(pos(150, 250))
    mockUseCursorState.mockReturnValue(cursorState())

    const { container } = render(<CustomCursor />)
    const dot = container.querySelector(".mix-blend-difference:not([data-testid])") as HTMLElement
    expect(dot.style.left).toBe("150px")
    expect(dot.style.top).toBe("250px")
  })

  it("forwards lerpFactor prop to useCursorPosition", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState())

    render(<CustomCursor lerpFactor={0.25} />)
    expect(mockUseCursorPosition).toHaveBeenCalledWith(0.25)
  })

  // ── Dot blend mode and shape ────────────────────────────────────────────────

  it("dot has mix-blend-difference class", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState())

    const { container } = render(<CustomCursor />)
    expect(container.querySelector(".mix-blend-difference")).not.toBeNull()
  })

  it("dot has no rounded-full class (square shape)", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState())

    const { container } = render(<CustomCursor />)
    const dot = container.querySelector(".mix-blend-difference:not([data-testid])")
    expect(dot?.classList.contains("rounded-full")).toBe(false)
  })

  // ── Dot colour ──────────────────────────────────────────────────────────────

  it("dot uses purple (#9900fa) fill in idle state", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState())

    const { container } = render(<CustomCursor />)
    const dot = container.querySelector(".mix-blend-difference:not([data-testid])")
    expect(dot?.classList.contains("bg-[#9900fa]")).toBe(true)
  })

  it("dot uses purple border when hovering", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState({ isHovering: true }))

    const { container } = render(<CustomCursor />)
    const dot = container.querySelector(".mix-blend-difference:not([data-testid])")
    expect(dot?.classList.contains("border-[#9900fa]")).toBe(true)
  })

  // ── Dot visibility ──────────────────────────────────────────────────────────

  it("dot is opacity-0 when isVisible is false", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState({ isVisible: false }))

    const { container } = render(<CustomCursor />)
    const dot = container.querySelector(".mix-blend-difference:not([data-testid])")
    expect(dot?.classList.contains("opacity-0")).toBe(true)
  })

  it("dot is opacity-100 when isVisible is true", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState({ isVisible: true }))

    const { container } = render(<CustomCursor />)
    const dot = container.querySelector(".mix-blend-difference:not([data-testid])")
    expect(dot?.classList.contains("opacity-100")).toBe(true)
  })

  // ── Dot state sizes ─────────────────────────────────────────────────────────

  it("dot shows ring (h-6 border-2) on hover", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState({ isHovering: true }))

    const { container } = render(<CustomCursor />)
    const dot = container.querySelector(".mix-blend-difference:not([data-testid])")
    expect(dot?.classList.contains("h-6")).toBe(true)
    expect(dot?.classList.contains("border-2")).toBe(true)
  })

  it("dot shrinks to h-2 on press", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState({ isPressed: true }))

    const { container } = render(<CustomCursor />)
    const dot = container.querySelector(".mix-blend-difference:not([data-testid])")
    expect(dot?.classList.contains("h-2")).toBe(true)
  })

  it("dot is h-3 in idle state", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState())

    const { container } = render(<CustomCursor />)
    const dot = container.querySelector(".mix-blend-difference:not([data-testid])")
    expect(dot?.classList.contains("h-3")).toBe(true)
  })

  // ── Coordinate readout ──────────────────────────────────────────────────────

  it("renders the coordinate readout", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState())

    const { getByTestId } = render(<CustomCursor />)
    expect(getByTestId("cursor-coords")).toBeTruthy()
  })

  it("displays raw coordinates in [x, y] format", () => {
    mockUseCursorPosition.mockReturnValue({ raw: { x: 312, y: 748 }, lerp: { x: 310, y: 745 } })
    mockUseCursorState.mockReturnValue(cursorState())

    const { getByTestId } = render(<CustomCursor />)
    expect(getByTestId("cursor-coords").textContent).toBe("[312, 748]")
  })

  it("rounds fractional raw coordinates to integers", () => {
    mockUseCursorPosition.mockReturnValue({ raw: { x: 100.7, y: 200.3 }, lerp: { x: 100, y: 200 } })
    mockUseCursorState.mockReturnValue(cursorState())

    const { getByTestId } = render(<CustomCursor />)
    expect(getByTestId("cursor-coords").textContent).toBe("[101, 200]")
  })

  it("coordinate readout is offset bottom-right from lerp position", () => {
    mockUseCursorPosition.mockReturnValue(pos(100, 200))
    mockUseCursorState.mockReturnValue(cursorState())

    const { getByTestId } = render(<CustomCursor />)
    const coords = getByTestId("cursor-coords") as HTMLElement
    expect(coords.style.left).toBe("112px")
    expect(coords.style.top).toBe("208px")
  })

  it("coordinate readout is opacity-0 when isVisible is false", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState({ isVisible: false }))

    const { getByTestId } = render(<CustomCursor />)
    expect(getByTestId("cursor-coords").classList.contains("opacity-0")).toBe(true)
  })

  it("coordinate readout is opacity-100 when isVisible is true", () => {
    mockUseCursorPosition.mockReturnValue(pos())
    mockUseCursorState.mockReturnValue(cursorState({ isVisible: true }))

    const { getByTestId } = render(<CustomCursor />)
    expect(getByTestId("cursor-coords").classList.contains("opacity-100")).toBe(true)
  })
})
