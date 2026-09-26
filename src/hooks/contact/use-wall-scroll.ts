import { useCallback, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"

// Registered on first use rather than at import, so importing the hooks barrel
// has no side effects (ScrollTrigger reads window.matchMedia when registered).
let pluginsRegistered = false
function registerPlugins() {
  if (pluginsRegistered) return
  gsap.registerPlugin(ScrollTrigger, useGSAP)
  pluginsRegistered = true
}

// ── Timeline shape, in screens (viewport heights of scroll) ─────────────────
/**
 * The handoff from Process: the Contact section's top rising from the bottom
 * of the view to the top while Process's last step scrolls away above it.
 * Process's plane has already reached the wall by then (lib/paper-plane);
 * over this stretch the camera comes in to the wall and the letters rise.
 */
export const WALL_HANDOFF = 1
/** When the section's text starts to fade in. */
const HUD_IN = 0.55
const HUD_FADE = 0.35
/**
 * The whole timeline. Everything has settled by the end of the handoff; the
 * rest is a hold, long enough that nobody scrolls past the email address by
 * accident, before the page loops back round to the Hero (use-page-loop).
 */
const TOTAL = 1.75

export type WallPhases = {
  /** End of the handoff (the section's top reaches the top of the view). */
  handoff: number
  /** The section's text fades in from here… */
  hudIn: number
  /** …to here. */
  hudShown: number
  /** Whole timeline, in screens: the section's height. */
  total: number
  /** Section height in vh. */
  sectionVh: number
}

/** Timeline landmarks, in screens from the moment the section's top meets the bottom of the view. */
export function wallPhases(): WallPhases {
  return {
    handoff: WALL_HANDOFF,
    hudIn: HUD_IN,
    hudShown: HUD_IN + HUD_FADE,
    total: TOTAL,
    sectionVh: Math.ceil(TOTAL * 100),
  }
}

type WallScrollOptions = {
  /** False in the flat fallback (touch, reduced motion, narrow screens). */
  enabled: boolean
}

const VISIBLE_OPACITY = 0.5 // below this the text is treated as "off"

/**
 * The Contact section's scroll. A scrubbed timeline spans the section from
 * the moment its top enters the view (the handoff from Process) to its end,
 * where the page loop takes over. It fades the section's text
 * (`[data-wall-hud]`) in as the wall's letters finish rising; the wall itself
 * reads `readUnits()`, which carries on past the section into the loop.
 *
 * - `readUnits()` gives the live timeline position straight from the scroll
 *   position, with no scrub lag, for the wall to read every frame. It's
 *   negative before the section arrives and −1 while disabled.
 *
 * Accessibility:
 * - While the text is faded out it gets `data-light-off` (consumers turn off
 *   its pointer events); it stays in the reading order.
 * - Keyboard focus moving into the section before its text has faded in
 *   scrolls straight to the section's end, where it's all showing, so a
 *   focused link is never invisible.
 * - Callers pass `enabled: false` for touch, reduced motion and narrow
 *   screens; everything then stays in normal flow and nothing animates.
 */
export function useWallScroll<T extends HTMLElement = HTMLElement>({
  enabled,
}: WallScrollOptions) {
  registerPlugins()
  const sectionRef = useRef<T>(null)
  const triggerRef = useRef<ScrollTrigger | null>(null)

  const readUnits = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return -1
    return (window.scrollY - trigger.start) / window.innerHeight
  }, [])

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!enabled || !section) return

      const hud = gsap.utils.toArray<HTMLElement>("[data-wall-hud]", section)
      const phases = wallPhases()

      const syncHud = () => {
        for (const el of hud) {
          const on = Number(gsap.getProperty(el, "opacity")) >= VISIBLE_OPACITY
          el.toggleAttribute("data-light-off", !on)
        }
      }

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom bottom",
          // No smoothing: the text stays in step with the wall, which reads
          // the raw (Lenis-smoothed) scroll position.
          scrub: true,
        },
        onUpdate: syncHud,
      })
      triggerRef.current = tl.scrollTrigger ?? null

      if (hud.length > 0) {
        tl.fromTo(
          hud,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: phases.hudShown - phases.hudIn,
            ease: "power2.out",
            stagger: 0.04,
          },
          phases.hudIn
        )
      }
      // Empty tween that pads the timeline to its full length.
      tl.to({}, { duration: Math.max(0, phases.total - tl.duration()) }, tl.duration())
      syncHud()

      // Keyboard: show the text when focus lands in it before it has faded in.
      const onFocusIn = (event: FocusEvent) => {
        const el = (event.target as Element | null)?.closest<HTMLElement>(
          "[data-wall-hud]"
        )
        const st = tl.scrollTrigger
        if (!el || !el.hasAttribute("data-light-off") || !st) return
        window.scrollTo({ top: st.end, behavior: "instant" })
        tl.progress(1)
      }
      section.addEventListener("focusin", onFocusIn)

      return () => {
        section.removeEventListener("focusin", onFocusIn)
        triggerRef.current = null
      }
    },
    { scope: sectionRef, dependencies: [enabled], revertOnUpdate: true }
  )

  return { sectionRef, readUnits }
}
