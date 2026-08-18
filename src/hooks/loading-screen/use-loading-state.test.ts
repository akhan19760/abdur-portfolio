import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useLoadingState } from "./use-loading-state"

describe("useLoadingState", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
  })

  it("starts in 'loading' state", () => {
    const { result } = renderHook(() => useLoadingState())
    expect(result.current).toBe("loading")
  })

  it("transitions to 'exiting' after holdDuration", () => {
    const { result } = renderHook(() =>
      useLoadingState({ holdDuration: 2000, exitDuration: 500 })
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current).toBe("exiting")
  })

  it("transitions to 'done' after holdDuration + exitDuration", () => {
    const { result } = renderHook(() =>
      useLoadingState({ holdDuration: 2000, exitDuration: 500 })
    )

    act(() => {
      vi.advanceTimersByTime(2500)
    })

    expect(result.current).toBe("done")
  })

  it("uses default durations (3000ms hold, 1000ms exit)", () => {
    const { result } = renderHook(() => useLoadingState())

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current).toBe("exiting")

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe("done")
  })

  it("immediately returns 'done' when prefers-reduced-motion is active", () => {
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

    const { result } = renderHook(() => useLoadingState())
    expect(result.current).toBe("done")
  })

  it("cleans up timers on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout")
    const { unmount } = renderHook(() => useLoadingState())

    unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})
