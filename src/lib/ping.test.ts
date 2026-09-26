import { describe, it, expect, vi } from "vitest"
import {
  PING_LIFE,
  PING_SPEED,
  PING_WIDTH,
  createPingTracker,
  emitPing,
  onPing,
  pingLevel,
  pingRadius,
} from "./ping"

describe("ping bus", () => {
  it("delivers pings to subscribers", () => {
    const listener = vi.fn()
    const off = onPing(listener)
    emitPing(10, 20, 5)
    expect(listener).toHaveBeenCalledWith({ x: 10, y: 20, time: 5 })
    off()
  })

  it("stops delivering after unsubscribe", () => {
    const listener = vi.fn()
    const off = onPing(listener)
    off()
    emitPing(0, 0)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe("pingRadius", () => {
  it("grows with age", () => {
    expect(pingRadius(0)).toBe(0)
    expect(pingRadius(100)).toBeCloseTo(100 * PING_SPEED)
  })

  it("never goes negative", () => {
    expect(pingRadius(-50)).toBe(0)
  })
})

describe("pingLevel", () => {
  it("is strongest right on the ring", () => {
    const age = 200
    expect(pingLevel(pingRadius(age), age)).toBeCloseTo(1 - age / PING_LIFE)
  })

  it("is 0 well inside or outside the ring", () => {
    const age = 400
    expect(pingLevel(pingRadius(age) + PING_WIDTH, age)).toBe(0)
    expect(pingLevel(Math.max(0, pingRadius(age) - PING_WIDTH), age)).toBe(0)
  })

  it("is 0 once the ping has expired, or before it starts", () => {
    expect(pingLevel(pingRadius(PING_LIFE), PING_LIFE)).toBe(0)
    expect(pingLevel(0, -1)).toBe(0)
  })
})

describe("createPingTracker", () => {
  it("collects live pings and drops expired ones", () => {
    const tracker = createPingTracker()
    emitPing(1, 1, 0)
    emitPing(2, 2, 1000)
    expect(tracker.active(1200)).toHaveLength(2)
    expect(tracker.active(PING_LIFE + 10)).toHaveLength(1)
    tracker.dispose()
  })

  it("stops collecting once disposed", () => {
    const tracker = createPingTracker()
    tracker.dispose()
    emitPing(0, 0, 0)
    expect(tracker.active(1)).toHaveLength(0)
  })
})
