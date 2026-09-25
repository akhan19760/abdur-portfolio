import { useEffect, useRef } from "react"
import { canHover } from "@/lib/media"

type LightChargeOptions = {
  /** Which descendants of the container can be charged. */
  selector?: string
  /** ms of full light needed to charge an element completely. */
  duration?: number
  /** Minimum --light level that charges; below it the charge drains. */
  threshold?: number
  /** Called once when an element's charge reaches 1. */
  onCharged?: (element: HTMLElement) => void
}

/**
 * Next charge value after `dt` ms: fills in proportion to the light while the
 * light is at or above `threshold`, drains more slowly below it. Clamped 0–1.
 * A frame timestamp can arrive slightly before the previous reading; a
 * negative `dt` changes nothing (otherwise the drain would fill instead).
 */
export function nextCharge(
  charge: number,
  light: number,
  dt: number,
  duration: number,
  threshold: number
): number {
  if (!(dt > 0)) return charge
  const delta = light >= threshold ? (dt / duration) * light : -dt / (duration * 1.6)
  return Math.min(1, Math.max(0, charge + delta))
}

/**
 * "Hold the light on it" — charges elements while the cursor light rests on
 * them, for things that shouldn't trigger the instant the light brushes past
 * (scanning a case file, locking a tractor beam onto a satellite).
 *
 * Each frame, every element matching `selector` inside the container reads
 * its own `--light` (written by useLightProximity), fills or drains its
 * charge, and gets `--charge` (0–1) for CSS progress bars and rings. When a
 * charge completes, `onCharged` fires once for that element; remove the
 * element's selector attribute once it's done to stop charging it.
 *
 * Mouse devices only: without a light nothing charges, so callers must also
 * offer a click / keyboard path (they all do).
 */
export function useLightCharge<T extends HTMLElement = HTMLElement>({
  selector = "[data-charge]",
  duration = 1100,
  threshold = 0.35,
  onCharged,
}: LightChargeOptions = {}) {
  const containerRef = useRef<T>(null)

  const onChargedRef = useRef(onCharged)
  useEffect(() => {
    onChargedRef.current = onCharged
  }, [onCharged])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !canHover()) return

    const charges = new WeakMap<HTMLElement, number>()
    const fired = new WeakSet<HTMLElement>()
    let rafId = 0
    let last = performance.now()
    let visible = typeof IntersectionObserver === "undefined"

    const tick = (now: number) => {
      rafId = 0
      if (!visible) return
      const dt = Math.min(now - last, 50)
      last = now

      for (const el of container.querySelectorAll<HTMLElement>(selector)) {
        const light = parseFloat(el.style.getPropertyValue("--light")) || 0
        const prev = charges.get(el) ?? 0
        const next = nextCharge(prev, light, dt, duration, threshold)
        if (next === prev && charges.has(el)) continue
        charges.set(el, next)
        el.style.setProperty("--charge", next.toFixed(3))
        if (next >= 1 && !fired.has(el)) {
          fired.add(el)
          onChargedRef.current?.(el)
        }
      }

      rafId = requestAnimationFrame(tick)
    }

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            if (visible && !rafId) {
              last = performance.now()
              rafId = requestAnimationFrame(tick)
            }
          })

    observer?.observe(container)
    if (visible) rafId = requestAnimationFrame(tick)

    return () => {
      observer?.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [selector, duration, threshold])

  return { containerRef }
}
