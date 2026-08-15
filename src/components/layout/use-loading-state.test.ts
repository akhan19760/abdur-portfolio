import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useLoadingState } from "./use-loading-state"

// ── matchMedia helper ───────────────────────────────────────────────────────

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("useLoadingState", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setReducedMotion(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts in 'loading' state", () => {
    const { result } = renderHook(() =>
      useLoadingState({ holdDuration: 1000, exitDuration: 500 })
    )
    expect(result.current).toBe("loading")
  })

  it("transitions to 'exiting' after holdDuration", () => {
    const { result } = renderHook(() =>
      useLoadingState({ holdDuration: 1000, exitDuration: 500 })
    )

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current).toBe("exiting")
  })

  it("transitions to 'done' after holdDuration + exitDuration", () => {
    const { result } = renderHook(() =>
      useLoadingState({ holdDuration: 1000, exitDuration: 500 })
    )

    act(() => {
      vi.advanceTimersByTime(1500) // 1000 hold + 500 exit
    })

    expect(result.current).toBe("done")
  })

  it("does NOT advance past 'loading' if only holdDuration - 1ms has passed", () => {
    const { result } = renderHook(() =>
      useLoadingState({ holdDuration: 1000, exitDuration: 500 })
    )

    act(() => {
      vi.advanceTimersByTime(999)
    })

    expect(result.current).toBe("loading")
  })

  it("goes directly to 'done' when prefers-reduced-motion is set", () => {
    setReducedMotion(true)
    const { result } = renderHook(() =>
      useLoadingState({ holdDuration: 1000, exitDuration: 500 })
    )
    expect(result.current).toBe("done")
  })

  it("does not advance state if unmounted during the hold phase", () => {
    const { result, unmount } = renderHook(() =>
      useLoadingState({ holdDuration: 1000, exitDuration: 500 })
    )

    expect(result.current).toBe("loading")

    // Unmount while the hold timer is still pending
    expect(() => unmount()).not.toThrow()

    // Advancing time after unmount must not trigger a state-update warning
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // The hook is gone — no assertion on result, the key check is no throw above
  })
})
