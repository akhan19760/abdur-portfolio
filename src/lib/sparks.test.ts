import { describe, it, expect, vi } from "vitest"
import { emitSparks, onSparks, sparkFrom } from "./sparks"

describe("sparks bus", () => {
  it("delivers bursts to subscribers", () => {
    const listener = vi.fn()
    const off = onSparks(listener)
    emitSparks(10, 20, 5, 100)
    expect(listener).toHaveBeenCalledWith({ x: 10, y: 20, count: 5, time: 100 })
    off()
  })

  it("stops delivering after unsubscribe", () => {
    const listener = vi.fn()
    onSparks(listener)()
    emitSparks(0, 0)
    expect(listener).not.toHaveBeenCalled()
  })

  it("bursts from the centre of an element", () => {
    const listener = vi.fn()
    const off = onSparks(listener)
    const el = document.createElement("div")
    el.getBoundingClientRect = () =>
      ({ left: 100, top: 50, width: 40, height: 20 }) as DOMRect
    sparkFrom(el, 3)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ x: 120, y: 60, count: 3 })
    )
    off()
  })

  it("ignores a missing element", () => {
    const listener = vi.fn()
    const off = onSparks(listener)
    sparkFrom(null)
    expect(listener).not.toHaveBeenCalled()
    off()
  })
})
