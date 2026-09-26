import { useEffect, useRef } from "react"
import { canHover } from "@/lib/media"
import { createPingTracker, pingLevel } from "@/lib/ping"

type LightProximityOptions = {
  /** Which descendants of the container receive a --light value. */
  selector?: string
  /** Distance in px from an element's edge at which its light reaches 0. */
  radius?: number
  /** Light level (0–1) at which `onIlluminate` fires for an element. */
  threshold?: number
  /** Called once each time an element crosses `threshold` from below. */
  onIlluminate?: (element: HTMLElement) => void
}

/**
 * Smoothstep falloff from 1 (at the light) to 0 (at `radius` and beyond).
 * Exported for tests and for other light-driven effects.
 */
export function lightIntensity(distance: number, radius: number): number {
  if (radius <= 0) return 0
  const t = 1 - distance / radius
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t * t * (3 - 2 * t)
}

/** Distance from a point to the nearest edge of a rect; 0 when inside it. */
function distanceToRect(x: number, y: number, rect: DOMRect): number {
  const dx = Math.max(rect.left - x, 0, x - rect.right)
  const dy = Math.max(rect.top - y, 0, y - rect.bottom)
  return Math.hypot(dx, dy)
}

function readCursorVar(name: string): number {
  return parseFloat(document.documentElement.style.getPropertyValue(name))
}

type Reading = { level: number; dx: number; dy: number }

const DARK: Reading = { level: 0, dx: 0, dy: 0 }

/**
 * Drives how "lit" each target element is by its distance to the light, so
 * CSS can brighten text, reveal hidden items, make things lean, etc.
 *
 * Each frame, every element matching `selector` inside the container gets:
 * - `--light`: 0–1, from the lerped cursor light (--cursor-x / --cursor-y,
 *   published by CustomCursor) or a passing ping wave (lib/ping), whichever
 *   is stronger. A click near something hidden can reveal it.
 * - `--light-dx` / `--light-dy`: a vector pointing from the element toward
 *   whatever lights it, scaled by the level. Use it to lean toward the light
 *   (positive) or part away from it (negative).
 *
 * - Targets inside an element marked `[data-light-off]` are skipped and set to
 *   0. Scroll animations use this to switch off layers that are faded out.
 * - The loop only runs while the container is on screen.
 * - On devices that can't hover there is no light, so every target is set
 *   to 1 once and content shows at full strength.
 *
 * Styling is up to the consumer, e.g.
 *   opacity: calc(0.6 + var(--light, 0) * 0.4)
 */
export function useLightProximity<T extends HTMLElement = HTMLElement>({
  selector = "[data-light]",
  radius = 260,
  threshold = 0.8,
  onIlluminate,
}: LightProximityOptions = {}) {
  const containerRef = useRef<T>(null)

  // Keep the latest callback without restarting the loop when it changes.
  const onIlluminateRef = useRef(onIlluminate)
  useEffect(() => {
    onIlluminateRef.current = onIlluminate
  }, [onIlluminate])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const queryTargets = () =>
      Array.from(container.querySelectorAll<HTMLElement>(selector))

    if (!canHover()) {
      for (const el of queryTargets()) el.style.setProperty("--light", "1")
      return
    }

    const pings = createPingTracker()
    const last = new WeakMap<HTMLElement, Reading>()
    let rafId = 0
    let visible = typeof IntersectionObserver === "undefined"

    function apply(el: HTMLElement, reading: Reading) {
      const prev = last.get(el)
      if (
        prev &&
        Math.abs(prev.level - reading.level) < 0.005 &&
        Math.abs(prev.dx - reading.dx) < 0.01 &&
        Math.abs(prev.dy - reading.dy) < 0.01
      ) {
        return
      }
      last.set(el, reading)
      el.style.setProperty("--light", reading.level.toFixed(3))
      el.style.setProperty("--light-dx", reading.dx.toFixed(3))
      el.style.setProperty("--light-dy", reading.dy.toFixed(3))
      if ((prev?.level ?? 0) < threshold && reading.level >= threshold) {
        onIlluminateRef.current?.(el)
      }
    }

    function read(el: HTMLElement, cx: number, cy: number, now: number): Reading {
      if (el.closest("[data-light-off]")) return DARK
      const rect = el.getBoundingClientRect()
      const midX = rect.left + rect.width / 2
      const midY = rect.top + rect.height / 2

      let best = DARK
      if (Number.isFinite(cx) && Number.isFinite(cy)) {
        const level = lightIntensity(distanceToRect(cx, cy, rect), radius)
        if (level > 0) best = { level, ...toward(midX, midY, cx, cy, level) }
      }
      for (const ping of pings.active(now)) {
        const level = pingLevel(distanceToRect(ping.x, ping.y, rect), now - ping.time)
        if (level > best.level)
          best = { level, ...toward(midX, midY, ping.x, ping.y, level) }
      }
      return best
    }

    function tick(now: number) {
      rafId = 0
      if (!visible) return

      const cx = readCursorVar("--cursor-x")
      const cy = readCursorVar("--cursor-y")
      const targets = queryTargets()
      // Read every rect before writing any value: one layout per frame.
      const readings = targets.map((el) => read(el, cx, cy, now))
      targets.forEach((el, i) => apply(el, readings[i]))

      rafId = requestAnimationFrame(tick)
    }

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            if (visible && !rafId) rafId = requestAnimationFrame(tick)
          })

    observer?.observe(container)
    if (visible) rafId = requestAnimationFrame(tick)

    return () => {
      observer?.disconnect()
      pings.dispose()
      cancelAnimationFrame(rafId)
    }
  }, [selector, radius, threshold])

  return { containerRef }
}

/** Unit vector from (x, y) toward (tx, ty), scaled by `level`. */
function toward(x: number, y: number, tx: number, ty: number, level: number) {
  const d = Math.hypot(tx - x, ty - y)
  if (d < 0.01) return { dx: 0, dy: 0 }
  return { dx: ((tx - x) / d) * level, dy: ((ty - y) / d) * level }
}
