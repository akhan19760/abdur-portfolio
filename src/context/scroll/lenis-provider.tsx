import { createContext, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import Lenis from "lenis"
import { gsap } from "gsap"

// Sentinel values in this context:
//   undefined  — hook called outside any <LenisProvider> (triggers the throw)
//   null       — inside provider, but smooth scroll intentionally disabled
//               (user has prefers-reduced-motion set)
//   Lenis      — active smooth-scroll instance
const LenisContext = createContext<Lenis | null | undefined>(undefined)

/**
 * Returns the active Lenis instance for programmatic scroll control
 * (e.g. scrollTo on nav link click). Returns null when the user has
 * prefers-reduced-motion enabled — callers should handle null gracefully.
 * Throws a developer error when called outside <LenisProvider>.
 */
export function useLenis(): Lenis | null {
  const ctx = useContext(LenisContext)
  if (ctx === undefined) {
    throw new Error("[LenisProvider] useLenis must be called inside <LenisProvider>.")
  }
  return ctx
}

type LenisProviderProps = {
  children: ReactNode
}

/**
 * Initialises Lenis smooth scroll and drives it through GSAP's RAF loop so
 * ScrollTrigger animations stay perfectly in sync. Must wrap the router/app
 * root. Skips Lenis entirely when the user prefers reduced motion, falling
 * back to native browser scroll.
 */
export function LenisProvider({ children }: LenisProviderProps) {
  const [lenis, setLenis] = useState<Lenis | null>(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    // Respect OS/browser motion preference — skip smooth scroll entirely.
    if (prefersReducedMotion) return

    const instance = new Lenis({
      duration: 1.2,
      // Exponential ease-out — settles quickly, never feels sluggish
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      touchMultiplier: 2,
    })

    setLenis(instance)

    function onTick(time: number) {
      // GSAP ticker gives seconds; Lenis.raf expects milliseconds
      instance.raf(time * 1000)
    }

    gsap.ticker.add(onTick)
    // Prevent GSAP from compensating for missed frames — Lenis owns timing
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(onTick)
      instance.destroy()
      setLenis(null)
    }
  }, [])

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
}
