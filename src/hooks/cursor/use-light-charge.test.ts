import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { nextCharge, useLightCharge } from "./use-light-charge"

describe("nextCharge", () => {
  it("fills in proportion to the light", () => {
    expect(nextCharge(0, 1, 500, 1000, 0.35)).toBeCloseTo(0.5)
    expect(nextCharge(0, 0.5, 500, 1000, 0.35)).toBeCloseTo(0.25)
  })

  it("drains, more slowly, below the threshold", () => {
    expect(nextCharge(0.5, 0.1, 160, 1000, 0.35)).toBeCloseTo(0.4)
  })

  it("is clamped to 0–1", () => {
    expect(nextCharge(0.9, 1, 1000, 1000, 0.35)).toBe(1)
    expect(nextCharge(0.01, 0, 1000, 1000, 0.35)).toBe(0)
  })

  it("ignores a frame that arrives before the last one", () => {
    expect(nextCharge(0.2, 0, -2000, 1000, 0.35)).toBe(0.2)
    expect(nextCharge(0.2, 1, -2000, 1000, 0.35)).toBe(0.2)
  })
})

let frames: FrameRequestCallback[] = []
let now = 0
const runFrame = (step = 16) => {
  now += step
  const pending = frames
  frames = []
  pending.forEach((cb) => cb(now))
}

function renderWithContainer(container: HTMLElement, onCharged = vi.fn()) {
  renderHook(() => {
    const result = useLightCharge({ duration: 100, onCharged })
    ;(result.containerRef as { current: HTMLElement | null }).current = container
    return result
  })
  return onCharged
}

describe("useLightCharge", () => {
  beforeEach(() => {
    frames = []
    now = 0
    vi.spyOn(performance, "now").mockImplementation(() => now)
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb)
      return frames.length
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
  })

  it("charges a lit element and fires once when full", () => {
    const container = document.createElement("div")
    const el = document.createElement("button")
    el.setAttribute("data-charge", "")
    el.style.setProperty("--light", "1")
    container.append(el)

    const onCharged = renderWithContainer(container)
    for (let i = 0; i < 12; i++) runFrame()

    expect(el.style.getPropertyValue("--charge")).toBe("1.000")
    expect(onCharged).toHaveBeenCalledOnce()
    expect(onCharged).toHaveBeenCalledWith(el)
  })

  it("doesn't charge an unlit element", () => {
    const container = document.createElement("div")
    const el = document.createElement("button")
    el.setAttribute("data-charge", "")
    container.append(el)

    const onCharged = renderWithContainer(container)
    for (let i = 0; i < 12; i++) runFrame()

    expect(el.style.getPropertyValue("--charge")).toBe("0.000")
    expect(onCharged).not.toHaveBeenCalled()
  })

  it("does nothing on devices that can't hover", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    renderWithContainer(document.createElement("div"))
    expect(frames).toHaveLength(0)
  })
})
