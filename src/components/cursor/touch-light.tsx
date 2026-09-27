import { useEffect, useState } from "react"
import { canHover, prefersReducedMotion } from "@/lib/media"

// How quickly the light catches up with the finger each frame (0–1)
const FOLLOW = 0.35

type Point = { x: number; y: number }

/**
 * The cursor light, for touch screens: a finger on the glass is the light.
 *
 * Every light effect on the page (the 3D scenes, the Hero's letters, About's
 * core) reads the light's position from `--cursor-x` / `--cursor-y` on
 * `:root`, which CustomCursor publishes for a mouse. On touch devices, where
 * CustomCursor doesn't render, this publishes them from the finger instead:
 * they appear where a touch starts, follow it (eased, like the cursor) while
 * it moves or scrolls, and are removed when it lifts, so the scenes fall back
 * to their resting light.
 *
 * Renders nothing, and does nothing with a mouse. The listeners are passive,
 * so scrolling is never held up. It's a visual effect only: nothing on the
 * page needs the light to be read or used.
 */
export function TouchLight() {
  // Input type doesn't change mid-session in practice
  const [enabled] = useState(() => !canHover())

  useEffect(() => {
    if (!enabled) return
    const root = document.documentElement.style
    const snap = prefersReducedMotion()
    let target: Point | null = null
    let pos: Point | null = null
    let rafId = 0

    const write = (p: Point) => {
      root.setProperty("--cursor-x", `${p.x.toFixed(1)}px`)
      root.setProperty("--cursor-y", `${p.y.toFixed(1)}px`)
    }

    const tick = () => {
      rafId = 0
      if (!target || !pos) return
      pos = {
        x: pos.x + (target.x - pos.x) * FOLLOW,
        y: pos.y + (target.y - pos.y) * FOLLOW,
      }
      write(pos)
      if (Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 0.5) {
        rafId = requestAnimationFrame(tick)
      }
    }

    const onTouch = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
      target = { x: touch.clientX, y: touch.clientY }
      // A new touch lights up where it lands; a moving one is followed
      if (!pos || e.type === "touchstart" || snap) {
        pos = target
        write(pos)
      } else if (!rafId) {
        rafId = requestAnimationFrame(tick)
      }
    }

    const onLift = (e: TouchEvent) => {
      if (e.touches.length > 0) return
      target = null
      pos = null
      cancelAnimationFrame(rafId)
      rafId = 0
      root.removeProperty("--cursor-x")
      root.removeProperty("--cursor-y")
    }

    window.addEventListener("touchstart", onTouch, { passive: true })
    window.addEventListener("touchmove", onTouch, { passive: true })
    window.addEventListener("touchend", onLift)
    window.addEventListener("touchcancel", onLift)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("touchstart", onTouch)
      window.removeEventListener("touchmove", onTouch)
      window.removeEventListener("touchend", onLift)
      window.removeEventListener("touchcancel", onLift)
      root.removeProperty("--cursor-x")
      root.removeProperty("--cursor-y")
    }
  }, [enabled])

  return null
}
