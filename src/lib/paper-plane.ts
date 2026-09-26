/**
 * Process's paper plane, handed on to Contact's wall of pins.
 *
 * The plane that Process folds flies off into the dark at the end of that
 * section, and it flies into the wall of pins that Contact opens on: the
 * wall lights up where the plane is heading and dents where it arrives.
 * The two sections draw in separate canvases, so Process reports where the
 * plane is on screen each frame it flies (`trackPlane`), and Contact reads
 * that (`planeSighting`) and hears the moment it arrives (`onPlaneArrival`).
 *
 * A tiny synchronous store plus event, like lib/ping.
 */

/**
 * How far through its flight (0–1) the plane is when it reaches the wall.
 * Process hides the plane from here on; Contact dents the wall at this moment.
 */
export const PLANE_ARRIVAL = 0.97

export type PlaneSighting = {
  /** Where the plane is on screen, 0–1 from the top left. */
  sx: number
  sy: number
  /** 0–1 through its flight. */
  flight: number
}

type ArrivalListener = (at: PlaneSighting) => void

let current: PlaneSighting | null = null
const listeners = new Set<ArrivalListener>()

/**
 * Process reports the plane each frame it flies, and null when it isn't
 * flying (resting, or out of range). The arrival fires only when a sighting
 * actually crosses PLANE_ARRIVAL, so jumping past the flight, or scrolling
 * back into view of a plane that has already arrived, doesn't fire it.
 */
export function trackPlane(next: PlaneSighting | null): void {
  const before = current
  current = next
  if (before && next && before.flight < PLANE_ARRIVAL && next.flight >= PLANE_ARRIVAL) {
    for (const listener of listeners) listener(next)
  }
}

/** The plane's latest sighting, or null when it isn't flying. */
export function planeSighting(): PlaneSighting | null {
  return current
}

/** Subscribes to the plane's arrival; returns the unsubscribe function. */
export function onPlaneArrival(listener: ArrivalListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
