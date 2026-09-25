import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { PING_SPEED, emitPing } from "@/lib/ping"
import { lightIntensity, useLightProximity } from "./use-light-proximity"

// ── Helpers ───────────────────────────────────────────────────────────────────

let frames: FrameRequestCallback[] = []

function runFrame() {
  const pending = frames
  frames = []
  pending.forEach((cb) => cb(performance.now()))
}

function rect(left: number, top: number, width = 20, height = 20): DOMRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }
}

function target(r: DOMRect, attrs: Record<string, string> = { "data-light": "" }) {
  const el = document.createElement("span")
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
  el.getBoundingClientRect = () => r
  return el
}

function setCursor(x: number, y: number) {
  document.documentElement.style.setProperty("--cursor-x", `${x}px`)
  document.documentElement.style.setProperty("--cursor-y", `${y}px`)
}

/** Renders the hook and attaches `container` as its ref before effects run. */
function renderWithContainer(
  container: HTMLElement,
  options?: Parameters<typeof useLightProximity>[0]
) {
  return renderHook(() => {
    const result = useLightProximity(options)
    ;(result.containerRef as { current: HTMLElement | null }).current = container
    return result
  })
}

// ── lightIntensity ────────────────────────────────────────────────────────────

describe("lightIntensity", () => {
  it("is 1 at the light", () => {
    expect(lightIntensity(0, 100)).toBe(1)
  })

  it("is 0 at and beyond the radius", () => {
    expect(lightIntensity(100, 100)).toBe(0)
    expect(lightIntensity(500, 100)).toBe(0)
  })

  it("is 0.5 halfway (smoothstep is symmetric)", () => {
    expect(lightIntensity(50, 100)).toBeCloseTo(0.5)
  })

  it("falls off monotonically", () => {
    expect(lightIntensity(20, 100)).toBeGreaterThan(lightIntensity(40, 100))
  })

  it("is 0 for a non-positive radius", () => {
    expect(lightIntensity(0, 0)).toBe(0)
  })
})

// ── useLightProximity ─────────────────────────────────────────────────────────

describe("useLightProximity", () => {
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

  it("returns a container ref", () => {
    const { result } = renderHook(() => useLightProximity())
    expect(result.current.containerRef).toBeDefined()
  })

  it("sets --light to 1 for a target under the cursor", () => {
    const container = document.createElement("div")
    const el = target(rect(100, 100))
    container.append(el)
    setCursor(110, 110)

    renderWithContainer(container)
    runFrame()

    expect(el.style.getPropertyValue("--light")).toBe("1.000")
  })

  it("sets --light to 0 for a target outside the radius", () => {
    const container = document.createElement("div")
    const el = target(rect(1000, 1000))
    container.append(el)
    setCursor(0, 0)

    renderWithContainer(container, { radius: 200 })
    runFrame()

    expect(el.style.getPropertyValue("--light")).toBe("0.000")
  })

  it("measures from the element's nearest edge, not its centre", () => {
    const container = document.createElement("div")
    const wide = target(rect(0, 0, 1000, 20))
    container.append(wide)
    setCursor(900, 10) // inside the rect, far from its centre

    renderWithContainer(container)
    runFrame()

    expect(wide.style.getPropertyValue("--light")).toBe("1.000")
  })

  it("only affects elements matching the selector", () => {
    const container = document.createElement("div")
    const other = target(rect(100, 100), {})
    container.append(other)
    setCursor(110, 110)

    renderWithContainer(container)
    runFrame()

    expect(other.style.getPropertyValue("--light")).toBe("")
  })

  it("skips targets inside [data-light-off]", () => {
    const container = document.createElement("div")
    const off = document.createElement("div")
    off.setAttribute("data-light-off", "")
    const el = target(rect(100, 100))
    off.append(el)
    container.append(off)
    setCursor(110, 110)

    renderWithContainer(container)
    runFrame()

    expect(el.style.getPropertyValue("--light")).toBe("0.000")
  })

  it("calls onIlluminate once when a target crosses the threshold", () => {
    const container = document.createElement("div")
    const el = target(rect(100, 100))
    container.append(el)
    const onIlluminate = vi.fn()
    setCursor(110, 110)

    renderWithContainer(container, { onIlluminate })
    runFrame()
    runFrame() // still lit — no second call

    expect(onIlluminate).toHaveBeenCalledOnce()
    expect(onIlluminate).toHaveBeenCalledWith(el)
  })

  it("stays dark before the cursor position is known", () => {
    const container = document.createElement("div")
    const el = target(rect(100, 100))
    container.append(el)

    renderWithContainer(container)
    runFrame()

    expect(el.style.getPropertyValue("--light")).toBe("0.000")
  })

  it("points --light-dx/dy toward the light, scaled by the level", () => {
    const container = document.createElement("div")
    const el = target(rect(100, 100)) // centre (110, 110)
    container.append(el)
    setCursor(125, 110) // 5px right of the rect, directly right of centre

    renderWithContainer(container)
    runFrame()

    const level = Number(el.style.getPropertyValue("--light"))
    expect(Number(el.style.getPropertyValue("--light-dx"))).toBeCloseTo(level, 2)
    expect(Number(el.style.getPropertyValue("--light-dy"))).toBeCloseTo(0, 2)
  })

  it("lights targets as a ping's ring passes them", () => {
    const container = document.createElement("div")
    const el = target(rect(300, 0))
    container.append(el)
    setCursor(5000, 5000) // cursor far away
    const now = vi.spyOn(performance, "now")

    renderWithContainer(container)
    now.mockReturnValue(0)
    emitPing(0, 0, 0)
    // Ring reaches ~300px after ~270ms
    const pending = frames
    frames = []
    pending.forEach((cb) => cb(300 / PING_SPEED))

    expect(Number(el.style.getPropertyValue("--light"))).toBeGreaterThan(0.5)
  })

  it("lights everything fully on devices that can't hover", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    const container = document.createElement("div")
    const el = target(rect(5000, 5000))
    container.append(el)

    renderWithContainer(container)

    expect(el.style.getPropertyValue("--light")).toBe("1")
    expect(frames).toHaveLength(0)
  })

  it("cancels its frame loop on unmount without throwing", () => {
    const container = document.createElement("div")
    const { unmount } = renderWithContainer(container)
    expect(() => unmount()).not.toThrow()
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })
})
