import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { LENS_OFF, toLocalPoint, useLightLens } from "./use-light-lens"

// ── toLocalPoint ──────────────────────────────────────────────────────────────

describe("toLocalPoint", () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 }

  it("returns element-local coordinates", () => {
    expect(toLocalPoint(150, 80, rect, 200, 100, 0)).toEqual({ x: 50, y: 30 })
  })

  it("undoes an on-screen scale (e.g. from a 3D transform)", () => {
    // Laid out at 400×200 but drawn at half size
    expect(toLocalPoint(150, 80, rect, 400, 200, 0)).toEqual({ x: 100, y: 60 })
  })

  it("accepts points within the margin", () => {
    expect(toLocalPoint(90, 50, rect, 200, 100, 20)).toEqual({ x: -10, y: 0 })
  })

  it("returns null beyond the margin", () => {
    expect(toLocalPoint(0, 0, rect, 200, 100, 20)).toBeNull()
  })

  it("returns null for an empty rect", () => {
    expect(
      toLocalPoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }, 0, 0, 100)
    ).toBeNull()
  })
})

// ── useLightLens ──────────────────────────────────────────────────────────────

let frames: FrameRequestCallback[] = []
const runFrame = () => {
  const pending = frames
  frames = []
  pending.forEach((cb) => cb(performance.now()))
}

function element(
  left: number,
  top: number,
  width: number,
  height: number,
  attrs: string[] = []
) {
  const el = document.createElement("div")
  attrs.forEach((a) => el.setAttribute(a, ""))
  el.getBoundingClientRect = () =>
    ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect
  Object.defineProperty(el, "offsetWidth", { value: width })
  Object.defineProperty(el, "offsetHeight", { value: height })
  return el
}

function renderWithContainer(container: HTMLElement) {
  return renderHook(() => {
    const result = useLightLens()
    ;(result.containerRef as { current: HTMLElement | null }).current = container
    return result
  })
}

describe("useLightLens", () => {
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

  it("writes local lens coordinates on the container and its targets", () => {
    const container = element(0, 0, 500, 500)
    const line = element(100, 200, 300, 40, ["data-lens"])
    container.append(line)
    document.documentElement.style.setProperty("--cursor-x", "150px")
    document.documentElement.style.setProperty("--cursor-y", "210px")

    renderWithContainer(container)
    runFrame()

    expect(container.style.getPropertyValue("--lens-x")).toBe("150.0px")
    expect(line.style.getPropertyValue("--lens-x")).toBe("50.0px")
    expect(line.style.getPropertyValue("--lens-y")).toBe("10.0px")
  })

  it("parks the lens far away when the light isn't near", () => {
    const container = element(0, 0, 100, 100)
    document.documentElement.style.setProperty("--cursor-x", "5000px")
    document.documentElement.style.setProperty("--cursor-y", "5000px")

    renderWithContainer(container)
    runFrame()

    expect(container.style.getPropertyValue("--lens-x")).toBe(`${LENS_OFF}px`)
  })

  it("parks the lens inside [data-light-off]", () => {
    const off = element(0, 0, 500, 500, ["data-light-off"])
    const container = element(0, 0, 500, 500)
    off.append(container)
    document.documentElement.style.setProperty("--cursor-x", "10px")
    document.documentElement.style.setProperty("--cursor-y", "10px")

    renderWithContainer(container)
    runFrame()

    expect(container.style.getPropertyValue("--lens-x")).toBe(`${LENS_OFF}px`)
  })

  it("does nothing on devices that can't hover", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    const container = element(0, 0, 100, 100)

    renderWithContainer(container)

    expect(frames).toHaveLength(0)
    expect(container.style.getPropertyValue("--lens-x")).toBe("")
  })

  it("unmounts without throwing", () => {
    const { unmount } = renderWithContainer(element(0, 0, 10, 10))
    expect(() => unmount()).not.toThrow()
  })
})
