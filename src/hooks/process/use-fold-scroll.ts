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
 * The handoff from Work: the Process section's top rising from the bottom of
 * the view to the top while Work's stage scrolls away above it. Work's camera
 * turns to look straight down at the water over this stretch, and the sheet
 * of paper drifts down onto it.
 */
export const FOLD_HANDOFF = 1
/**
 * When the sheet settles on the water. Work's sea sends a ring out from under
 * it at the same moment (sea-choreography's PAPER_LANDING must match).
 */
export const PAPER_LANDING = 1.05

const FIRST_STEP = 1.1 // the first step takes the stage just after the landing
/** Screens each step holds the stage: Discover, Design, Build, Refine, Launch. */
const STEP_LENGTHS = [1.1, 1.1, 2, 1.3, 1.4] as const
const TAIL = 0.3 // after the plane has gone, before the section ends
/** Where to jump to for each step, in screens after it starts. */
const FOCUS_AT = [0.5, 0.85, 1.95, 1, 0.3] as const

/** The number of steps: the paper's folds are choreographed around five. */
export const STEP_COUNT = STEP_LENGTHS.length

export type FoldPhases = {
  /** End of the handoff (the section's top reaches the top of the view). */
  handoff: number
  /** The sheet lands on the water. */
  landing: number
  /** Per step: when it takes the stage. */
  starts: number[]
  /** Per step: when it hands over to the next (the last: when its hold ends). */
  ends: number[]
  /** Per step: the moment that shows it best, for jumps from the step list. */
  focus: number[]
  /** Whole timeline, in screens: the section's height. */
  total: number
  /** Section height in vh. */
  sectionVh: number
}

/** Timeline landmarks, in screens from the moment the section's top meets the bottom of the view. */
export function foldPhases(): FoldPhases {
  const starts: number[] = []
  const ends: number[] = []
  let at = FIRST_STEP
  for (const length of STEP_LENGTHS) {
    starts.push(at)
    at += length
    ends.push(at)
  }
  const total = at + TAIL
  return {
    handoff: FOLD_HANDOFF,
    landing: PAPER_LANDING,
    starts,
    ends,
    focus: starts.map((start, i) => start + FOCUS_AT[i]),
    total,
    sectionVh: Math.ceil(total * 100),
  }
}

/** The step on stage at timeline position `u` (the first before it starts, the last after). */
export function stepAt(u: number, phases: FoldPhases): number {
  const i = phases.ends.findIndex((end) => u < end)
  return i === -1 ? phases.ends.length - 1 : i
}

type FoldScrollOptions = {
  /** False in the flat fallback (touch, reduced motion, narrow screens). */
  enabled: boolean
  /** Called with the timeline position (screens) every time it renders. */
  onProgress?: (units: number) => void
}

const VISIBLE_OPACITY = 0.5 // below this a step is treated as "off"

/**
 * The Process section's scroll: one step on stage at a time while the paper
 * folds behind them.
 *
 * A scrubbed timeline spans the section from the moment its top enters the
 * view (the handoff from Work) to its end. It fades in the HUD
 * (`[data-fold-hud]`) as the sheet lands, and shows each step
 * (`[data-fold-step]`, in order) in turn: its title (`[data-fold-title]`)
 * unfolds down toward you like a flap of paper and its text
 * (`[data-fold-body]`) rises in, then it folds away as the next step takes
 * over. The last step stays until the section ends.
 *
 * - `readUnits()` gives the live timeline position straight from the scroll
 *   position, with no scrub lag, for the paper to read every frame. It's
 *   negative before the section arrives and −1 while disabled.
 * - `scrollToStep(i)` jumps to a step (the section's step list).
 *
 * Accessibility:
 * - Steps that are faded out get `data-light-off` (consumers turn off their
 *   pointer events); they stay in the reading order.
 * - Keyboard focus moving into a step that isn't showing scrolls straight
 *   to it, so a focused element is never invisible.
 * - Callers pass `enabled: false` for touch, reduced motion and narrow
 *   screens; everything then stays in normal flow and nothing animates.
 */
export function useFoldScroll<T extends HTMLElement = HTMLElement>({
  enabled,
  onProgress,
}: FoldScrollOptions) {
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

  const scrollToStep = useCallback((index: number) => jumpRef.current(index), [])

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!enabled || !section) return

      const steps = gsap.utils.toArray<HTMLElement>("[data-fold-step]", section)
      const hud = gsap.utils.toArray<HTMLElement>("[data-fold-hud]", section)
      const phases = foldPhases()
      const last = steps.length - 1

      const syncSteps = () => {
        for (const step of steps) {
          const on = Number(gsap.getProperty(step, "opacity")) >= VISIBLE_OPACITY
          step.toggleAttribute("data-light-off", !on)
        }
      }

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom bottom",
          // No smoothing: the text stays in step with the paper, which reads
          // the raw (Lenis-smoothed) scroll position.
          scrub: true,
        },
        onUpdate: () => {
          syncSteps()
          onProgressRef.current?.(tl.progress() * phases.total)
        },
      })
      triggerRef.current = tl.scrollTrigger ?? null

      if (hud.length > 0) {
        tl.fromTo(
          hud,
          { opacity: 0 },
          { opacity: 1, duration: 0.3 },
          phases.landing - 0.15
        )
      }
      steps.forEach((step, i) => {
        const start = phases.starts[i] ?? phases.starts[phases.starts.length - 1]
        const end = phases.ends[i] ?? phases.total
        const title = step.querySelector<HTMLElement>("[data-fold-title]")
        const body = step.querySelectorAll<HTMLElement>("[data-fold-body]")
        const at = start - 0.05

        tl.fromTo(step, { opacity: 0 }, { opacity: 1, duration: 0.12 }, at)
        if (title) {
          // Hinged at its top edge, swinging down toward you
          tl.fromTo(
            title,
            { rotationX: -92, transformOrigin: "50% 0%", transformPerspective: 900 },
            { rotationX: 0, duration: 0.32, ease: "power2.out" },
            at
          )
        }
        if (body.length > 0) {
          tl.fromTo(
            body,
            { opacity: 0, y: 28 },
            { opacity: 1, y: 0, duration: 0.25, ease: "power2.out", stagger: 0.05 },
            at + 0.1
          )
        }
        if (i < last) {
          const out = end - 0.15
          tl.to(step, { opacity: 0, duration: 0.15, ease: "power1.in" }, out)
          if (title)
            tl.to(title, { rotationX: -70, duration: 0.15, ease: "power1.in" }, out)
        }
      })
      // Empty tween that pads the timeline to its full length.
      tl.to({}, { duration: Math.max(0, phases.total - tl.duration()) }, tl.duration())

      syncSteps()
      onProgressRef.current?.(0)

      jumpRef.current = (index: number) => {
        const st = tl.scrollTrigger
        if (!st || index < 0 || index > last) return
        const units = phases.focus[index] ?? phases.starts[index]
        window.scrollTo({
          top: st.start + units * window.innerHeight,
          behavior: "instant",
        })
        tl.progress(units / phases.total)
      }

      // Keyboard: jump to a step when focus lands in it while it's hidden.
      const onFocusIn = (event: FocusEvent) => {
        const step = (event.target as Element | null)?.closest<HTMLElement>(
          "[data-fold-step]"
        )
        if (!step || !step.hasAttribute("data-light-off")) return
        jumpRef.current(steps.indexOf(step))
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

  return { sectionRef, readUnits, scrollToStep }
}
