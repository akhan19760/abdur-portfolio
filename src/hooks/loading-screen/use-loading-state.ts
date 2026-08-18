import { useEffect, useState } from "react"
import type { LoadingState, UseLoadingStateOptions } from "@/types/loading-screen"

export type { LoadingState, UseLoadingStateOptions }

/**
 * Manages the three-phase lifecycle of the loading screen:
 *   "loading" → "exiting" → "done"
 *
 * Respects `prefers-reduced-motion`: immediately transitions to "done"
 * without rendering animations if the user requests reduced motion.
 */
export function useLoadingState({
  holdDuration = 3000,
  exitDuration = 1000,
}: UseLoadingStateOptions = {}): LoadingState {
  const [state, setState] = useState<LoadingState>(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return "done"
    }
    return "loading"
  })

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return
    }

    // Phase 1 → Phase 2: hold until time to begin exit animation
    const holdTimer = setTimeout(() => {
      setState("exiting")
    }, holdDuration)

    // Phase 2 → Phase 3: allow exit animation to complete, then unmount
    const exitTimer = setTimeout(() => {
      setState("done")
    }, holdDuration + exitDuration)

    return () => {
      clearTimeout(holdTimer)
      clearTimeout(exitTimer)
    }
  }, [holdDuration, exitDuration])

  return state
}
