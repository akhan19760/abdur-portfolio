/**
 * Sparks — little bursts of light where something was just discovered
 * (a star traced, a case file decrypted, a satellite caught, a fragment found).
 *
 * A tiny synchronous event bus: whoever discovers something emits a burst at
 * a viewport point; whoever draws effects (the About section's FX canvas)
 * subscribes and animates it. Nothing is drawn if nobody is listening.
 */

export type SparkBurst = {
  x: number
  y: number
  /** How many sparks to throw. */
  count: number
  /** performance.now() when emitted. */
  time: number
}

type SparkListener = (burst: SparkBurst) => void

const listeners = new Set<SparkListener>()

export function emitSparks(
  x: number,
  y: number,
  count = 28,
  time = performance.now()
): SparkBurst {
  const burst = { x, y, count, time }
  for (const listener of listeners) listener(burst)
  return burst
}

/** Subscribes to spark bursts; returns the unsubscribe function. */
export function onSparks(listener: SparkListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Emits a burst from the centre of an element. */
export function sparkFrom(el: Element | null, count?: number): void {
  if (!el) return
  const r = el.getBoundingClientRect()
  emitSparks(r.left + r.width / 2, r.top + r.height / 2, count)
}
