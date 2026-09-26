import { useEffect, useRef, useState } from "react"
import type { CursorPosition, Point } from "@/types/cursor"

export type { CursorPosition }

const ORIGIN: Point = { x: 0, y: 0 }

/**
 * Tracks the real mouse position and produces a smoothed (lerp-eased)
 * position that trails behind it. This is the foundation the CustomCursor
 * component consumes to render its lagging glow/cursor.
 *
 * `raw` mirrors the actual mouse coordinates; `lerp` eases toward `raw` by
 * `lerpFactor` (0–1) on every animation frame, producing the trailing-lag
 * effect. State is committed at most once per requestAnimationFrame tick,
 * so re-renders track the display refresh rate rather than raw mousemove
 * event frequency.
 *
 * Respects `prefers-reduced-motion`: when set, `lerp` snaps straight to
 * `raw` on each mousemove instead of easing toward it, so no trailing
 * motion occurs.
 *
 * Purely an output hook — cursor position is a visual enhancement only and
 * never gates content or blocks interaction/keyboard access.
 */
export function useCursorPosition(lerpFactor = 0.1): CursorPosition {
  const [position, setPosition] = useState<CursorPosition>({
    raw: ORIGIN,
    lerp: ORIGIN,
  })

  const rawRef = useRef<Point>(ORIGIN)
  const lerpRef = useRef<Point>(ORIGIN)

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    function onMouseMove(event: MouseEvent) {
      const raw = { x: event.clientX, y: event.clientY }
      rawRef.current = raw

      // No trailing motion when reduced motion is requested — snap lerp
      // straight to raw instead of waiting for the rAF loop to ease in.
      if (prefersReducedMotion) {
        lerpRef.current = raw
        setPosition({ raw, lerp: raw })
      }
    }

    window.addEventListener("mousemove", onMouseMove)

    if (prefersReducedMotion) {
      return () => window.removeEventListener("mousemove", onMouseMove)
    }

    let rafId = 0
    let renderedRaw = rawRef.current

    function tick() {
      const raw = rawRef.current
      const lerp = lerpRef.current
      // Within a twentieth of a pixel it snaps home; from then on, until the
      // mouse moves again, nothing changes and nothing re-renders (every
      // render also rewrites --cursor-x/y, which costs style work).
      const settled = Math.abs(raw.x - lerp.x) < 0.05 && Math.abs(raw.y - lerp.y) < 0.05
      const nextLerp = settled
        ? raw
        : {
            x: lerp.x + (raw.x - lerp.x) * lerpFactor,
            y: lerp.y + (raw.y - lerp.y) * lerpFactor,
          }
      if (nextLerp.x !== lerp.x || nextLerp.y !== lerp.y || raw !== renderedRaw) {
        lerpRef.current = nextLerp
        renderedRaw = raw
        setPosition({ raw, lerp: nextLerp })
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      cancelAnimationFrame(rafId)
    }
  }, [lerpFactor])

  return position
}
