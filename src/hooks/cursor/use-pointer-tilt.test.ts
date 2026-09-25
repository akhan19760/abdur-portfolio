import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { tiltFor, usePointerTilt } from "./use-pointer-tilt"

describe("tiltFor", () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 }

  it("is 0 at the centre", () => {
    expect(tiltFor(100, 50, rect)).toEqual({ x: 0, y: 0 })
  })

  it("is ±1 at the edges", () => {
    expect(tiltFor(200, 0, rect)).toEqual({ x: 1, y: -1 })
  })

  it("clamps points outside the box", () => {
    expect(tiltFor(-1000, 1000, rect)).toEqual({ x: -1, y: 1 })
  })

  it("is 0 for an empty box", () => {
    expect(tiltFor(5, 5, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
    })
  })
})

let frames: FrameRequestCallback[] = []
const runFrame = () => {
  const pending = frames
  frames = []
  pending.forEach((cb) => cb(performance.now()))
}

function target(attrs: string[] = ["data-tilt"]) {
  const el = document.createElement("div")
  attrs.forEach((a) => el.setAttribute(a, ""))
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }) as DOMRect
  return el
}

function renderWithContainer(container: HTMLElement) {
  return renderHook(() => {
    const result = usePointerTilt({ ease: 1 })
    ;(result.containerRef as { current: HTMLElement | null }).current = container
    return result
  })
}

describe("usePointerTilt", () => {
  beforeEach(() => {
    frames = []
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb)
      return frames.length
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
    document.documentElement.style.removeProperty("--cursor-x")
    document.documentElement.style.removeProperty("--cursor-y")
  })

  it("tilts targets toward the cursor", () => {
    const container = document.createElement("div")
    const el = target()
    container.append(el)
    document.documentElement.style.setProperty("--cursor-x", "200px")
    document.documentElement.style.setProperty("--cursor-y", "100px")

    renderWithContainer(container)
    runFrame()

    expect(el.style.getPropertyValue("--tilt-x")).toBe("1.0000")
    expect(el.style.getPropertyValue("--tilt-y")).toBe("1.0000")
  })

  it("keeps switched-off targets flat", () => {
    const container = document.createElement("div")
    const off = document.createElement("div")
    off.setAttribute("data-light-off", "")
    const el = target()
    off.append(el)
    container.append(off)
    document.documentElement.style.setProperty("--cursor-x", "200px")
    document.documentElement.style.setProperty("--cursor-y", "100px")

    renderWithContainer(container)
    runFrame()

    expect(el.style.getPropertyValue("--tilt-x")).toBe("0.0000")
  })

  it("does nothing with reduced motion", () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes("reduce") || q.includes("hover"),
    }))
    const container = document.createElement("div")
    container.append(target())

    renderWithContainer(container)

    expect(frames).toHaveLength(0)
  })

  it("unmounts without throwing", () => {
    const { unmount } = renderWithContainer(document.createElement("div"))
    expect(() => unmount()).not.toThrow()
  })
})
