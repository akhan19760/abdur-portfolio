import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { onPing } from "@/lib/ping"
import { useClickPing } from "./use-click-ping"

function pointerDown(button: number, x = 120, y = 80) {
  // jsdom has no PointerEvent constructor; a MouseEvent carries the same fields.
  window.dispatchEvent(new MouseEvent("pointerdown", { button, clientX: x, clientY: y }))
}

describe("useClickPing", () => {
  const unsubscribers: (() => void)[] = []
  afterEach(() => unsubscribers.splice(0).forEach((off) => off()))

  function listen() {
    const listener = vi.fn()
    unsubscribers.push(onPing(listener))
    return listener
  }

  it("sends a ping from the primary button's position", () => {
    const listener = listen()
    renderHook(() => useClickPing())
    pointerDown(0, 120, 80)
    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0][0]).toMatchObject({ x: 120, y: 80 })
  })

  it("ignores other buttons", () => {
    const listener = listen()
    renderHook(() => useClickPing())
    pointerDown(2)
    expect(listener).not.toHaveBeenCalled()
  })

  it("stops listening on unmount", () => {
    const listener = listen()
    const { unmount } = renderHook(() => useClickPing())
    unmount()
    pointerDown(0)
    expect(listener).not.toHaveBeenCalled()
  })
})
