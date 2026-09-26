import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useCopyText } from "./use-copy-text"

const original = Object.getOwnPropertyDescriptor(navigator, "clipboard")

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true })
}

describe("useCopyText", () => {
  beforeEach(() => vi.useFakeTimers())

  afterEach(() => {
    vi.useRealTimers()
    if (original) Object.defineProperty(navigator, "clipboard", original)
    else Reflect.deleteProperty(navigator, "clipboard")
  })

  it("starts idle", () => {
    const { result } = renderHook(() => useCopyText())
    expect(result.current.status).toBe("idle")
  })

  it("copies the text and says so, then goes back to idle", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    const { result } = renderHook(() => useCopyText(1000))
    let ok = false
    await act(async () => {
      ok = await result.current.copy("hello@example.com")
    })
    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith("hello@example.com")
    expect(result.current.status).toBe("copied")
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.status).toBe("idle")
  })

  it("reports a failure when the browser refuses", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) })
    const { result } = renderHook(() => useCopyText())
    let ok = true
    await act(async () => {
      ok = await result.current.copy("x")
    })
    expect(ok).toBe(false)
    expect(result.current.status).toBe("failed")
  })

  it("reports a failure when there's no clipboard at all", async () => {
    setClipboard(undefined)
    const { result } = renderHook(() => useCopyText())
    await act(async () => {
      await result.current.copy("x")
    })
    expect(result.current.status).toBe("failed")
  })

  it("unmounts cleanly with a reset still pending", async () => {
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) })
    const { result, unmount } = renderHook(() => useCopyText())
    await act(async () => {
      await result.current.copy("x")
    })
    expect(() => unmount()).not.toThrow()
    expect(() => vi.runAllTimers()).not.toThrow()
  })
})
