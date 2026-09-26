import { useCallback, useEffect, useRef, useState } from "react"

export type CopyStatus = "idle" | "copied" | "failed"

/**
 * Copies text to the clipboard and reports how it went, for a "Copy email"
 * button. The status goes back to "idle" after `resetAfter` ms, so the
 * button's label returns to normal.
 *
 * `copy()` resolves to whether it worked. It fails (status "failed") when the
 * Clipboard API is missing or the browser refuses, e.g. on an insecure page.
 */
export function useCopyText(resetAfter = 2400) {
  const [status, setStatus] = useState<CopyStatus>("idle")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  const copy = useCallback(
    async (text: string) => {
      let ok = false
      try {
        if (!navigator.clipboard?.writeText) throw new Error("No clipboard")
        await navigator.clipboard.writeText(text)
        ok = true
      } catch {
        ok = false
      }
      setStatus(ok ? "copied" : "failed")
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setStatus("idle"), resetAfter)
      return ok
    },
    [resetAfter]
  )

  return { status, copy }
}
