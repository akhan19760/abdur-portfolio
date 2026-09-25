/**
 * Sonar pings — the page-wide "click anywhere" interaction.
 *
 * A click sends a ring of light expanding from the click point. Anything can
 * subscribe: the SignalField draws the ring and shoves particles outward,
 * light-driven elements flare as the wave passes them, the 3D core pulses,
 * satellites get knocked along their orbits, the Hero's letters jolt.
 *
 * This module is a tiny synchronous event bus plus the maths for how strong
 * the wave is at a given distance and age, so every subscriber agrees on it.
 */

export type Ping = {
  x: number
  y: number
  /** performance.now() when the ping was sent. */
  time: number
}

type PingListener = (ping: Ping) => void

/** px the ring travels per ms. */
export const PING_SPEED = 1.1
/** ms before a ping has fully faded. */
export const PING_LIFE = 1400
/** px — thickness of the lit band of the ring. */
export const PING_WIDTH = 110

const listeners = new Set<PingListener>()

export function emitPing(x: number, y: number, time = performance.now()): Ping {
  const ping = { x, y, time }
  for (const listener of listeners) listener(ping)
  return ping
}

/** Subscribes to pings; returns the unsubscribe function. */
export function onPing(listener: PingListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Radius of a ping's ring after `age` ms. */
export function pingRadius(age: number): number {
  return Math.max(0, age) * PING_SPEED
}

/**
 * How lit something `distance` px from a ping's origin is, `age` ms after it:
 * 1 right on the ring, falling to 0 at PING_WIDTH/2 either side, and fading
 * out over the ping's life.
 */
export function pingLevel(distance: number, age: number): number {
  if (age < 0 || age >= PING_LIFE) return 0
  const offset = Math.abs(distance - pingRadius(age))
  const band = Math.max(0, 1 - offset / (PING_WIDTH / 2))
  return band * (1 - age / PING_LIFE)
}

/** Keeps a list of the pings that are still alive, for per-frame consumers. */
export function createPingTracker() {
  let pings: Ping[] = []
  const unsubscribe = onPing((ping) => {
    pings.push(ping)
  })
  return {
    /** Live pings at `now`; expired ones are dropped. */
    active(now: number): readonly Ping[] {
      if (pings.length) pings = pings.filter((p) => now - p.time < PING_LIFE)
      return pings
    },
    dispose: unsubscribe,
  }
}
