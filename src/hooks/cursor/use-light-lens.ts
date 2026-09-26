import { useEffect, useRef } from "react"
import { canHover } from "@/lib/media"

/** Coordinate written when the lens is away from an element — far off-canvas. */
export const LENS_OFF = -9999

type LightLensOptions = {
  /** Which descendants (besides the container itself) receive lens coordinates. */
  selector?: string
  /** px around an element within which the lens still counts as over it. */
  margin?: number
}

type Box = { left: number; top: number; width: number; height: number }

/**
 * Converts a viewport point into an element's own (untransformed) pixel
 * coordinates, so it can be used in that element's CSS masks or gradients.
 * `localWidth/localHeight` are the element's layout size (offsetWidth/Height);
 * the ratio to its on-screen rect undoes any scale from 3D transforms.
 * Returns null when the point is further than `margin` from the element.
 */
export function toLocalPoint(
  x: number,
  y: number,
  rect: Box,
  localWidth: number,
  localHeight: number,
  margin: number
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null
  const outside =
    x < rect.left - margin ||
    x > rect.left + rect.width + margin ||
    y < rect.top - margin ||
    y > rect.top + rect.height + margin
  if (outside) return null
  return {
    x: (x - rect.left) * (localWidth / rect.width),
    y: (y - rect.top) * (localHeight / rect.height),
  }
}

/**
 * Turns the cursor light into a lens that elements can mask themselves with.
 *
 * Each frame, the container and every descendant matching `selector` get
 * `--lens-x` / `--lens-y` set to the lerped light position in that element's
 * own coordinates (or far away when the light isn't near it, or when the
 * element is inside `[data-light-off]`). A CSS mask such as
 *   radial-gradient(circle 110px at var(--lens-x) var(--lens-y), #000, transparent)
 * then reveals only what's under the light.
 *
 * Runs only while the container is on screen, and never on devices that
 * can't hover (callers show content unmasked there).
 */
export function useLightLens<T extends HTMLElement = HTMLElement>({
  selector = "[data-lens]",
  margin = 140,
}: LightLensOptions = {}) {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !canHover()) return

    let rafId = 0
    let visible = typeof IntersectionObserver === "undefined"

    const write = (el: HTMLElement, point: { x: number; y: number } | null) => {
      el.style.setProperty("--lens-x", `${point ? point.x.toFixed(1) : LENS_OFF}px`)
      el.style.setProperty("--lens-y", `${point ? point.y.toFixed(1) : LENS_OFF}px`)
    }

    const tick = () => {
      rafId = 0
      if (!visible) return

      const style = document.documentElement.style
      const cx = parseFloat(style.getPropertyValue("--cursor-x"))
      const cy = parseFloat(style.getPropertyValue("--cursor-y"))
      const targets = [container, ...container.querySelectorAll<HTMLElement>(selector)]

      // Read every rect before writing: one layout per frame.
      const points = targets.map((el) =>
        Number.isFinite(cx) && Number.isFinite(cy) && !el.closest("[data-light-off]")
          ? toLocalPoint(
              cx,
              cy,
              el.getBoundingClientRect(),
              el.offsetWidth,
              el.offsetHeight,
              margin
            )
          : null
      )
      targets.forEach((el, i) => write(el, points[i]))

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
  }, [selector, margin])

  return { containerRef }
}
