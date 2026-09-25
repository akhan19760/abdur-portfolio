import { useEffect, useRef } from "react"
import { canHover, prefersReducedMotion } from "@/lib/media"

type PointerTiltOptions = {
  /** Which descendants of the container tilt. */
  selector?: string
  /** 0–1 easing per frame toward the target tilt. */
  ease?: number
}

type Box = { left: number; top: number; width: number; height: number }

/**
 * Where a point sits relative to a box's centre, in half-sizes, clamped to
 * ±1: (-1, -1) is the top-left corner, (1, 1) the bottom-right.
 */
export function tiltFor(x: number, y: number, rect: Box): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  const clamp = (v: number) => Math.min(1, Math.max(-1, v))
  return {
    x: clamp((x - (rect.left + rect.width / 2)) / (rect.width / 2)),
    y: clamp((y - (rect.top + rect.height / 2)) / (rect.height / 2)),
  }
}

/**
 * Makes elements turn toward the cursor light in 3D.
 *
 * Each frame, every element matching `selector` inside the container gets
 * `--tilt-x` / `--tilt-y` (−1 to 1) easing toward where the lerped cursor is
 * relative to its centre. CSS turns that into rotation, parallax, etc., e.g.
 *   transform: perspective(1400px) rotateX(calc(var(--tilt-y) * -6deg))
 *              rotateY(calc(var(--tilt-x) * 8deg))
 * Elements inside `[data-light-off]` ease back to flat.
 *
 * Off (nothing written) with reduced motion or on devices that can't hover.
 * Runs only while the container is on screen.
 */
export function usePointerTilt<T extends HTMLElement = HTMLElement>({
  selector = "[data-tilt]",
  ease = 0.08,
}: PointerTiltOptions = {}) {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !canHover() || prefersReducedMotion()) return

    const current = new WeakMap<HTMLElement, { x: number; y: number }>()
    let rafId = 0
    let visible = typeof IntersectionObserver === "undefined"

    const tick = () => {
      rafId = 0
      if (!visible) return

      const style = document.documentElement.style
      const cx = parseFloat(style.getPropertyValue("--cursor-x"))
      const cy = parseFloat(style.getPropertyValue("--cursor-y"))
      const known = Number.isFinite(cx) && Number.isFinite(cy)
      const targets = Array.from(container.querySelectorAll<HTMLElement>(selector))

      // Read every rect before writing: one layout per frame.
      const goals = targets.map((el) =>
        known && !el.closest("[data-light-off]")
          ? tiltFor(cx, cy, el.getBoundingClientRect())
          : { x: 0, y: 0 }
      )
      targets.forEach((el, i) => {
        const now = current.get(el) ?? { x: 0, y: 0 }
        const next = {
          x: now.x + (goals[i].x - now.x) * ease,
          y: now.y + (goals[i].y - now.y) * ease,
        }
        if (
          Math.abs(next.x - now.x) < 0.0005 &&
          Math.abs(next.y - now.y) < 0.0005 &&
          current.has(el)
        )
          return
        current.set(el, next)
        el.style.setProperty("--tilt-x", next.x.toFixed(4))
        el.style.setProperty("--tilt-y", next.y.toFixed(4))
      })

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
      cancelAnimationFrame(rafId)
    }
  }, [selector, ease])

  return { containerRef }
}
