import { useEffect, useState } from "react"

export type LoadingState = "loading" | "exiting" | "done"

export type UseLoadingStateOptions = {
  /** How long to hold the loading screen before starting the exit animation (ms). */
  holdDuration?: number
  /** How long the exit animation plays before the overlay is removed (ms). */
  exitDuration?: number
}

/**
 * Drives the loading screen lifecycle.
 *
 * State machine:
 *   "loading"  →  (holdDuration ms)  →  "exiting"  →  (exitDuration ms)  →  "done"
 *
 * When the user prefers reduced motion the hook skips directly to "done" so
 * no animated overlay is shown and no time is wasted waiting.
 */
export function useLoadingState({
  holdDuration = 2200,
  exitDuration = 600,
}: UseLoadingStateOptions = {}): LoadingState {
  const [state, setState] = useState<LoadingState>("loading")

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    // Respect OS/browser motion preference — skip the animated intro entirely.
    if (prefersReducedMotion) {
      setState("done")
      return
    }

    // exitTimer is declared here so the cleanup closure can clear it even if
    // the component unmounts while the hold timer is still pending.
    let exitTimer: ReturnType<typeof setTimeout> | undefined

    const holdTimer = setTimeout(() => {
      setState("exiting")

      exitTimer = setTimeout(() => {
        setState("done")
      }, exitDuration)
    }, holdDuration)

    return () => {
      clearTimeout(holdTimer)
      clearTimeout(exitTimer) // clearTimeout(undefined) is a safe no-op
    }
  }, [holdDuration, exitDuration])

  return state
}
