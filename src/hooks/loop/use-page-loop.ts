import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useLenis } from "@/context/scroll"
import { registerLoop } from "@/lib/page-loop"

// ── The loop's shape, in screens (viewport heights of scroll) ───────────────
/**
 * How long the stretch after Contact is. Over its first part the camera flies
 * through the hole that opens in Contact's pin wall (Contact's wall must be
 * gone before the name's approach ends; see wall-choreography's EXIT).
 */
export const LOOP_SCREENS = 2
/**
 * Its last part: the Hero's name comes toward you out of the dark. It starts
 * while the camera is still coming in to the wall, so the name is already
 * there, tiny, through the hole.
 */
export const ARRIVE_SCREENS = 1.5

function clamp(x: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, x))
}

/**
 * How far off the Hero's name is (1 far, 0 arrived) given where the loop
 * stretch is on screen (its top and bottom, px from the top of the view), or
 * null when it's out of view. It reaches 0 as the stretch's bottom meets the
 * bottom of the view: the page's end, where the scroll wraps.
 */
export function loopArrivalAt(
  top: number,
  bottom: number,
  viewport: number
): number | null {
  if (viewport <= 0 || top >= viewport || bottom <= 0) return null
  return clamp((bottom - viewport) / (ARRIVE_SCREENS * viewport))
}

/**
 * Keeps a scroll moving forward only: an upward delta can take the target no
 * further back than the start of the lap it's on (the top of the page), so
 * the page never wraps backwards from the Hero into the loop.
 *
 * `target` is the smooth scroll's unwrapped target (it keeps growing lap
 * after lap); `limit` is the page's scrollable height, one lap.
 */
export function forwardOnly(target: number, delta: number, limit: number): number {
  if (limit <= 0 || delta >= 0) return delta
  const lapStart = Math.floor(target / limit) * limit
  return Math.max(delta, lapStart - target)
}

/**
 * True when the scroll has just wrapped from the end of the page back to the
 * top: it dropped by more than half the page in one step, which no ordinary
 * scroll does. `limit` is the page's scrollable height.
 */
export function hasWrapped(previous: number, next: number, limit: number): boolean {
  return limit > 0 && previous - next > limit / 2
}

/**
 * Brings every scroll-driven animation straight to where the scroll now is.
 *
 * Some sections smooth their scroll timelines (About's is scrubbed over
 * 0.8s), so after a jump they'd ease their way over from the end of the page
 * to the top, playing their whole section in reverse over the Hero on the
 * way. Right after the wrap, each one is updated and its smoothing finished
 * at once, so the first frame at the top is the Hero and nothing else.
 */
export function settleScrollAnimations(): void {
  ScrollTrigger.update()
  for (const trigger of ScrollTrigger.getAll()) {
    // The scrub tween, if the trigger is smoothed (undefined otherwise)
    const smoothing = trigger.getTween() as gsap.core.Tween | undefined
    smoothing?.progress(1)
  }
}

type PageLoopOptions = {
  /** False in the flat fallback (touch, reduced motion, narrow screens): the page just ends. */
  enabled: boolean
}

/**
 * Turns the page into a loop. Scrolling past Contact runs on through the loop
 * stretch (`loopRef`), which ends on an exact copy of the top of the page
 * (`copyRef`, the Hero's text), and there the scroll wraps back to the top
 * with no visible jump. Only forward: scrolling up at the top does nothing.
 *
 * - Lenis's own infinite mode does the wrap, so the scroll keeps its speed.
 *   The moment it wraps, every scroll animation is settled at the top at
 *   once (settleScrollAnimations), so nothing eases over from the end.
 * - The loop registers a reader with lib/page-loop, so the Hero's canvas
 *   knows how far its name has come in.
 * - The copy of the Hero's text fades in as the name arrives (its
 *   `--hero-exit` runs from 1 down to 0, mirroring the real one's fade out).
 *
 * Needs the page's Lenis instance. Everything is put back as it was on
 * unmount or when disabled.
 */
export function usePageLoop<
  L extends HTMLElement = HTMLElement,
  C extends HTMLElement = HTMLElement,
>({ enabled }: PageLoopOptions) {
  const lenis = useLenis()
  const loopRef = useRef<L>(null)
  const copyRef = useRef<C>(null)

  useEffect(() => {
    const loop = loopRef.current
    if (!enabled || !lenis || !loop) return

    const read = () => {
      const rect = loop.getBoundingClientRect()
      return loopArrivalAt(rect.top, rect.bottom, window.innerHeight)
    }
    const offLoop = registerLoop(read)

    const options = lenis.options
    const before = { infinite: options.infinite, virtualScroll: options.virtualScroll }
    options.infinite = true
    options.virtualScroll = (data) => {
      // Lenis reads the delta after this, so trimming it here is enough
      data.deltaY = forwardOnly(lenis.targetScroll, data.deltaY, lenis.limit)
      return before.virtualScroll ? before.virtualScroll(data) : true
    }

    // The moment the scroll wraps, nothing may ease over from the end of the page
    let lastScroll = lenis.scroll
    const offScroll = lenis.on("scroll", () => {
      const scroll = lenis.scroll
      if (hasWrapped(lastScroll, scroll, lenis.limit)) settleScrollAnimations()
      lastScroll = scroll
    })

    const copy = copyRef.current
    let last = -1
    const tick = () => {
      const arrive = read() ?? 1
      if (copy && Math.abs(arrive - last) > 0.0005) {
        copy.style.setProperty("--hero-exit", arrive.toFixed(4))
        last = arrive
      }
    }
    tick()
    gsap.ticker.add(tick)

    return () => {
      gsap.ticker.remove(tick)
      offScroll()
      offLoop()
      options.infinite = before.infinite
      options.virtualScroll = before.virtualScroll
      // Back to a single lap, in case the scroll had gone round
      lenis.resize()
    }
  }, [enabled, lenis])

  return { loopRef, copyRef }
}
