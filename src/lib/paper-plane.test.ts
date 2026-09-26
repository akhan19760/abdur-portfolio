import { afterEach, describe, expect, it, vi } from "vitest"
import { PLANE_ARRIVAL, onPlaneArrival, planeSighting, trackPlane } from "./paper-plane"

const at = (flight: number) => ({ sx: 0.6, sy: 0.4, flight })

describe("paper-plane", () => {
  afterEach(() => trackPlane(null))

  it("has no sighting until the plane flies", () => {
    expect(planeSighting()).toBeNull()
  })

  it("keeps the latest sighting, and forgets it when the plane stops flying", () => {
    trackPlane(at(0.3))
    expect(planeSighting()).toEqual(at(0.3))
    trackPlane(null)
    expect(planeSighting()).toBeNull()
  })

  it("announces the arrival when a sighting crosses it", () => {
    const listener = vi.fn()
    const off = onPlaneArrival(listener)
    trackPlane(at(0.5))
    trackPlane(at(PLANE_ARRIVAL - 0.01))
    expect(listener).not.toHaveBeenCalled()
    trackPlane(at(PLANE_ARRIVAL + 0.01))
    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(at(PLANE_ARRIVAL + 0.01))
    // Still arrived: no second announcement
    trackPlane(at(1))
    expect(listener).toHaveBeenCalledOnce()
    off()
  })

  it("announces again after the plane flies back and arrives a second time", () => {
    const listener = vi.fn()
    const off = onPlaneArrival(listener)
    trackPlane(at(0.9))
    trackPlane(at(1))
    trackPlane(at(0.8)) // scrolled back up
    trackPlane(at(1))
    expect(listener).toHaveBeenCalledTimes(2)
    off()
  })

  it("stays quiet when the flight is skipped over or already over", () => {
    const listener = vi.fn()
    const off = onPlaneArrival(listener)
    trackPlane(at(1)) // first sighting is already past the wall
    trackPlane(null)
    trackPlane(at(1))
    expect(listener).not.toHaveBeenCalled()
    off()
  })

  it("stops telling a listener once it unsubscribes", () => {
    const listener = vi.fn()
    onPlaneArrival(listener)()
    trackPlane(at(0.5))
    trackPlane(at(1))
    expect(listener).not.toHaveBeenCalled()
  })
})
