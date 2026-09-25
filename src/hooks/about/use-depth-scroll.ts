import { useEffect, useRef } from "react"
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

// ── Timeline shape (timeline units, mapped onto the section's scroll range) ──
/** Viewport heights of scroll per timeline unit. */
export const DEPTH_UNIT_VH = 60
/**
 * How much the About section overlaps the Hero (the Hero's height). The first
 * layer's approach spans exactly this stretch, so it flies in while the Hero's
 * name breaks apart.
 */
export const HANDOFF_VH = 100

const INTRO = HANDOFF_VH / DEPTH_UNIT_VH // the handoff (Hero scrolling away), in units
const QUIET = INTRO * 0.5 // nothing from About shows for the first half of the handoff
const FIRST_LANDING = 0.35 // the first layer lands this long after the Hero has gone
const APPROACH = 1 // fly in from the far plane to z = 0
const HOLD = 0.9 // rest at z = 0 so the layer can be explored
const DEPART = 0.8 // fly past the camera; overlaps the next layer's approach
const TAIL = 1.4 // extra scroll after the last layer settles (core bursts, beacon)
const SPACING = HOLD + APPROACH // arrival-to-arrival distance

const FAR_Z = -2400 // px behind the screen plane (perspective is 1200px)
const PAST_Z = 700 // px in front of it — scaled up ~2.4× as it passes
const VISIBLE_OPACITY = 0.5 // below this a layer is treated as "off"
const ARRIVE_ROLL = 10 // deg a layer is rolled by when it starts its approach
const DEPART_ROLL = 6 // deg it rolls the other way as it flies past

export type DepthPhases = {
  /** Length of the Hero handoff, in units. */
  intro: number
  /** Unit at which the first layer starts approaching (end of the quiet stretch). */
  quietUntil: number
  /** Unit at which each layer reaches z = 0. */
  arrivals: number[]
  /** [start, end] units during which each layer rests at z = 0. */
  holds: [number, number][]
  /** Unit at which the last layer's hold ends and the tail begins. */
  tailStart: number
  /** Total timeline length in units. */
  total: number
  /** Section height (vh) so the timeline spans the section's full scroll. */
  sectionVh: number
}

/**
 * Timeline landmarks for `layerCount` layers. The section's scroll distance
 * (height − one viewport) equals `total × DEPTH_UNIT_VH`.
 */
export function depthPhases(layerCount: number): DepthPhases {
  const first = INTRO + FIRST_LANDING
  const arrivals = Array.from({ length: layerCount }, (_, i) => first + i * SPACING)
  const tailStart = (arrivals[arrivals.length - 1] ?? 0) + HOLD
  const total = tailStart + TAIL
  return {
    intro: INTRO,
    quietUntil: QUIET,
    arrivals,
    holds: arrivals.map((a) => [a, a + HOLD] as [number, number]),
    tailStart,
    total,
    sectionVh: Math.ceil(total * DEPTH_UNIT_VH) + 100,
  }
}

type DepthScrollOptions = {
  /** False in the flat fallback (touch, reduced motion, narrow screens). */
  enabled: boolean
  /** Called with the scrubbed 0–1 progress every time the timeline renders. */
  onProgress?: (progress: number) => void
}

/**
 * The About section's z-axis dive.
 *
 * Every `[data-depth-layer]` inside the section is stacked in the same spot
 * of a sticky, perspective stage. As the section scrolls past, a scrubbed
 * timeline brings each layer in from far behind the screen, holds it, then
 * flies it past the camera while the next one approaches. Layers roll a
 * little as they come and go. The first layer waits out the first half of the
 * handoff (while the About section still overlaps the Hero, see HANDOFF_VH)
 * and lands just after the Hero has gone.
 *
 * The stage is kept in place with CSS `position: sticky` rather than a
 * ScrollTrigger pin, because pinning may add a transform to the stage, and
 * CursorLight's fixed background stops tracking the cursor under a transform.
 *
 * Accessibility:
 * - Layers that are faded out get `data-light-off` (the light ignores them,
 *   and the consumer's styles turn off their pointer events).
 * - Keyboard focus moving into a layer that isn't showing scrolls straight to
 *   that layer, so a focused element is never invisible.
 * - Callers pass `enabled: false` for touch, reduced motion and narrow
 *   screens; the layers then stay in normal flow and nothing animates.
 */
export function useDepthScroll<T extends HTMLElement = HTMLElement>({
  enabled,
  onProgress,
}: DepthScrollOptions) {
  registerPlugins()
  const sectionRef = useRef<T>(null)

  const onProgressRef = useRef(onProgress)
  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!enabled || !section) return

      const layers = gsap.utils.toArray<HTMLElement>("[data-depth-layer]", section)
      if (layers.length === 0) return

      const last = layers.length - 1
      const { arrivals, quietUntil, total } = depthPhases(layers.length)

      const syncLayers = () => {
        for (const layer of layers) {
          const on = Number(gsap.getProperty(layer, "opacity")) >= VISIBLE_OPACITY
          layer.toggleAttribute("data-light-off", !on)
        }
      }

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.8,
        },
        onUpdate: () => {
          syncLayers()
          onProgressRef.current?.(tl.progress())
        },
      })

      layers.forEach((layer, i) => {
        const approach = i === 0 ? arrivals[0] - quietUntil : APPROACH
        const start = arrivals[i] - approach
        const roll = i % 2 === 0 ? 1 : -1
        // Position races in and settles; opacity lags so it comes out of the dark.
        tl.fromTo(
          layer,
          { z: FAR_Z, rotationZ: ARRIVE_ROLL * roll },
          { z: 0, rotationZ: 0, duration: approach, ease: "power3.out" },
          start
        )
        tl.fromTo(
          layer,
          { opacity: 0 },
          { opacity: 1, duration: approach, ease: "power1.in" },
          start
        )
        if (i < last) {
          tl.to(
            layer,
            {
              z: PAST_Z,
              rotationZ: -DEPART_ROLL * roll,
              opacity: 0,
              duration: DEPART,
              ease: "power2.in",
            },
            arrivals[i] + HOLD
          )
        }
      })
      // Empty tween that pads the timeline to its full length (the tail).
      tl.to({}, { duration: total - tl.duration() }, tl.duration())

      syncLayers()
      onProgressRef.current?.(0)

      // Keyboard: jump to a layer when focus lands inside it while it's hidden.
      const onFocusIn = (event: FocusEvent) => {
        const layer = (event.target as Element | null)?.closest<HTMLElement>(
          "[data-depth-layer]"
        )
        if (!layer || !layer.hasAttribute("data-light-off")) return
        const st = tl.scrollTrigger
        const index = layers.indexOf(layer)
        if (!st || index < 0) return

        const progress = (arrivals[index] + HOLD / 2) / tl.duration()
        window.scrollTo({
          top: st.start + progress * (st.end - st.start),
          behavior: "instant",
        })
        tl.progress(progress)
      }
      section.addEventListener("focusin", onFocusIn)

      return () => section.removeEventListener("focusin", onFocusIn)
    },
    { scope: sectionRef, dependencies: [enabled], revertOnUpdate: true }
  )

  return { sectionRef }
}
