import { afterEach, describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import { axe } from "vitest-axe"
import { TouchLight } from "./touch-light"

function mockMatchMedia(matching: string[]) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matching.includes(query),
    media: query,
  }))
}

/** A touch event carrying the given fingers (jsdom has no Touch constructor). */
function touch(type: string, points: { x: number; y: number }[]) {
  const event = new Event(type)
  Object.defineProperty(event, "touches", {
    value: points.map((p) => ({ clientX: p.x, clientY: p.y })),
  })
  window.dispatchEvent(event)
}

const cursorX = () => document.documentElement.style.getPropertyValue("--cursor-x")
const cursorY = () => document.documentElement.style.getPropertyValue("--cursor-y")

describe("TouchLight", () => {
  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
    document.documentElement.style.removeProperty("--cursor-x")
    document.documentElement.style.removeProperty("--cursor-y")
  })

  it("renders nothing", () => {
    mockMatchMedia([])
    const { container } = render(<TouchLight />)
    expect(container).toBeEmptyDOMElement()
  })

  it("puts the light where a touch lands on a touch screen", () => {
    mockMatchMedia([])
    render(<TouchLight />)
    touch("touchstart", [{ x: 120, y: 340 }])
    expect(cursorX()).toBe("120.0px")
    expect(cursorY()).toBe("340.0px")
  })

  it("removes the light when the last finger lifts", () => {
    mockMatchMedia([])
    render(<TouchLight />)
    touch("touchstart", [{ x: 50, y: 60 }])
    touch("touchend", [])
    expect(cursorX()).toBe("")
    expect(cursorY()).toBe("")
  })

  it("follows a moving finger straight away with reduced motion", () => {
    mockMatchMedia(["(prefers-reduced-motion: reduce)"])
    render(<TouchLight />)
    touch("touchstart", [{ x: 10, y: 10 }])
    touch("touchmove", [{ x: 200, y: 90 }])
    expect(cursorX()).toBe("200.0px")
    expect(cursorY()).toBe("90.0px")
  })

  it("leaves the light to the mouse on hover-capable devices", () => {
    mockMatchMedia(["(hover: hover) and (pointer: fine)"])
    render(<TouchLight />)
    touch("touchstart", [{ x: 120, y: 340 }])
    expect(cursorX()).toBe("")
  })

  it("cleans the light up on unmount", () => {
    mockMatchMedia([])
    const { unmount } = render(<TouchLight />)
    touch("touchstart", [{ x: 1, y: 2 }])
    unmount()
    expect(cursorX()).toBe("")
  })

  it("has no accessibility violations", async () => {
    mockMatchMedia([])
    const { container } = render(<TouchLight />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
