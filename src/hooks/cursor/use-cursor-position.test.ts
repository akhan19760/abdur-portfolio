import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useCursorPosition } from "./use-cursor-position"

// Manual rAF queue — lets tests advance the animation loop frame-by-frame
// without relying on real timers.
let rafCallbacks: FrameRequestCallback[] = []

function flushRaf(time = 16) {
  const callbacks = rafCallbacks
  rafCallbacks = []
  act(() => {
    callbacks.forEach((cb) => cb(time))
  })
}

function moveMouseTo(x: number, y: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y }))
  })
}

describe("useCursorPosition", () => {
  beforeEach(() => {
    rafCallbacks = []
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        rafCallbacks.push(cb)
        return rafCallbacks.length
      })
    )
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
  })

  it("starts at the origin for both raw and lerp", () => {
    const { result } = renderHook(() => useCursorPosition())
    expect(result.current.raw).toEqual({ x: 0, y: 0 })
    expect(result.current.lerp).toEqual({ x: 0, y: 0 })
  })

  it("updates raw position on mousemove", () => {
    const { result } = renderHook(() => useCursorPosition())
    moveMouseTo(100, 200)
    flushRaf()
    expect(result.current.raw).toEqual({ x: 100, y: 200 })
  })

  it("eases lerp toward raw over successive rAF ticks without reaching it immediately", () => {
    const { result } = renderHook(() => useCursorPosition(0.1))
    moveMouseTo(100, 0)

    flushRaf()
    const afterOneTick = result.current.lerp.x
    expect(afterOneTick).toBeCloseTo(10) // 0 + (100 - 0) * 0.1
    expect(afterOneTick).toBeLessThan(100)

    flushRaf()
    const afterTwoTicks = result.current.lerp.x
    expect(afterTwoTicks).toBeGreaterThan(afterOneTick)
    expect(afterTwoTicks).toBeLessThan(100)
  })

  it("snaps lerp to raw instantly when prefers-reduced-motion is active", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { result } = renderHook(() => useCursorPosition())
    moveMouseTo(50, 75)

    expect(result.current.raw).toEqual({ x: 50, y: 75 })
    expect(result.current.lerp).toEqual({ x: 50, y: 75 })
    // No rAF loop should have been scheduled when motion is reduced.
    expect(rafCallbacks.length).toBe(0)
  })

  it("cleans up the mousemove listener and rAF loop on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")
    const { unmount } = renderHook(() => useCursorPosition())

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith("mousemove", expect.any(Function))
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
    removeEventListenerSpy.mockRestore()
  })
})
