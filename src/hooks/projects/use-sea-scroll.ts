import { useCallback, useEffect, useRef } from "react"
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
 * The handoff from About: the Work section's top rising from the bottom of the
 * view to the top while About's stage scrolls away above it. The sea's camera
 * comes down from About's dawn horizon over exactly this stretch.
 */
export const SEA_HANDOFF = 1
/**
 * Screens after the section ends until the sea has gone: it turns to look
 * down at the water for Process's sheet of paper to land on, then fades out
 * under it (sea-choreography).
 */
export const SEA_EXIT = 1.6

const INTRO = 0.1 // the camera settles before the first project rises
const RISE = 0.55 // a project's screen rising out of the water (overlaps the last one sinking)
const HOLD = 0.8 // resting on a project so it can be read
const GLIDE = 0.7 // gliding sideways to the next one
const TAIL = 0.4 // after the last project, before the section ends

export type SeaPhases = {
  /** End of the handoff (the section's top reaches the top of the view). */
  handoff: number
  /** Per project: its screen starts rising out of the water. */
  riseStarts: number[]
  /** Per project: the camera has settled on it and its screen is fully up. */
  arrivals: number[]
  /** Per project: reading time ends and the glide to the next one starts. */
  holdEnds: number[]
  /** Whole timeline, in screens: the section's height. */
  total: number
  /** Section height in vh. */
  sectionVh: number
}

/**
 * Timeline landmarks for `count` projects, in screens from the moment the
 * section's top meets the bottom of the view.
 */
export function seaPhases(count: number): SeaPhases {
  const first = SEA_HANDOFF + INTRO + RISE
  const arrivals = Array.from({ length: count }, (_, i) => first + i * (HOLD + GLIDE))
  const holdEnds = arrivals.map((a) => a + HOLD)
  const total = (holdEnds[holdEnds.length - 1] ?? first) + TAIL
  return {
    handoff: SEA_HANDOFF,
    riseStarts: arrivals.map((a) => a - RISE),
    arrivals,
    holdEnds,
    total,
    sectionVh: Math.ceil(total * 100),
  }
}

/** Timeline position (screens) in the middle of a project's reading time. */
export function projectMidpoint(phases: SeaPhases, index: number): number {
  return phases.arrivals[index] + HOLD / 2
}

type SeaScrollOptions = {
  /** False in the flat fallback (touch, reduced motion, narrow screens). */
  enabled: boolean
  /** Called with the timeline position (screens) every time it renders. */
  onProgress?: (units: number) => void
}

const VISIBLE_OPACITY = 0.5 // below this a panel is treated as "off"

/**
 * The Work section's sideways glide from project to project.
 *
 * A scrubbed timeline spans the section from the moment its top enters the
 * view (the handoff from About) to its end. It fades in the HUD after the
 * handoff (`[data-sea-hud]`) and each project's details (`[data-sea-panel]`,
 * in order) as its screen rises out of the water, then sends them off as the
 * camera glides on to the next. The last project stays until the section ends.
 *
 * - `readUnits()` gives the live timeline position straight from the scroll
 *   position, with no scrub lag. The sea reads it every frame so its horizon
 *   stays locked to About's while About's stage scrolls away. It's negative
 *   before the section arrives and −1 while disabled.
 * - `scrollToProject(i)` jumps to a project (the section's project list).
 *
 * Accessibility:
 * - Details that are faded out get `data-light-off` (consumers turn off their
 *   pointer events); they stay focusable.
 * - Keyboard focus moving into a project that isn't showing scrolls straight
 *   to it, so a focused element is never invisible.
 * - Callers pass `enabled: false` for touch, reduced motion and narrow
 *   screens; everything then stays in normal flow and nothing animates.
 */
export function useSeaScroll<T extends HTMLElement = HTMLElement>({
  enabled,
  onProgress,
}: SeaScrollOptions) {
  registerPlugins()
  const sectionRef = useRef<T>(null)
  const triggerRef = useRef<ScrollTrigger | null>(null)
  const jumpRef = useRef<(index: number) => void>(() => {})

  const onProgressRef = useRef(onProgress)
  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])

  const readUnits = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return -1
    return (window.scrollY - trigger.start) / window.innerHeight
  }, [])

  const scrollToProject = useCallback((index: number) => jumpRef.current(index), [])

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!enabled || !section) return

      const panels = gsap.utils.toArray<HTMLElement>("[data-sea-panel]", section)
      const hud = gsap.utils.toArray<HTMLElement>("[data-sea-hud]", section)
      const phases = seaPhases(panels.length)
      const last = panels.length - 1

      const syncPanels = () => {
        for (const panel of panels) {
          const on = Number(gsap.getProperty(panel, "opacity")) >= VISIBLE_OPACITY
          panel.toggleAttribute("data-light-off", !on)
        }
      }

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom bottom",
          // No smoothing: the text stays in step with the sea, which reads the
          // raw (Lenis-smoothed) scroll position.
          scrub: true,
        },
        onUpdate: () => {
          syncPanels()
          onProgressRef.current?.(tl.progress() * phases.total)
        },
      })
      triggerRef.current = tl.scrollTrigger ?? null

      if (hud.length > 0) {
        tl.fromTo(
          hud,
          { opacity: 0 },
          { opacity: 1, duration: 0.3 },
          phases.handoff - 0.1
        )
      }
      panels.forEach((panel, i) => {
        tl.fromTo(
          panel,
          { opacity: 0, y: 36 },
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
          phases.arrivals[i] - 0.35
        )
        if (i < last) {
          tl.to(
            panel,
            { opacity: 0, y: -24, duration: 0.2, ease: "power1.in" },
            phases.holdEnds[i] + 0.1
          )
        }
      })
      // Empty tween that pads the timeline to its full length.
      tl.to({}, { duration: Math.max(0, phases.total - tl.duration()) }, tl.duration())

      syncPanels()
      onProgressRef.current?.(0)

      jumpRef.current = (index: number) => {
        const st = tl.scrollTrigger
        if (!st || index < 0 || index > last) return
        const units = projectMidpoint(phases, index)
        window.scrollTo({
          top: st.start + units * window.innerHeight,
          behavior: "instant",
        })
        tl.progress(units / phases.total)
      }

      // Keyboard: jump to a project when focus lands in it while it's hidden.
      const onFocusIn = (event: FocusEvent) => {
        const panel = (event.target as Element | null)?.closest<HTMLElement>(
          "[data-sea-panel]"
        )
        if (!panel || !panel.hasAttribute("data-light-off")) return
        jumpRef.current(panels.indexOf(panel))
      }
      section.addEventListener("focusin", onFocusIn)

      return () => {
        section.removeEventListener("focusin", onFocusIn)
        triggerRef.current = null
        jumpRef.current = () => {}
      }
    },
    { scope: sectionRef, dependencies: [enabled], revertOnUpdate: true }
  )

  return { sectionRef, readUnits, scrollToProject }
}
