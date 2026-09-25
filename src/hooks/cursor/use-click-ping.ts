import { useEffect } from "react"
import { emitPing } from "@/lib/ping"

/**
 * Sends a ping (lib/ping) from wherever the visitor presses the primary
 * button, anywhere on the page: the Hero's letters jolt, About's lights and
 * particles swell, and the Work sea ripples out from the spot.
 *
 * Mount once, at page level. The listener is passive and on the capture
 * phase, so it never delays or blocks the click itself.
 */
export function useClickPing() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 0) emitPing(event.clientX, event.clientY)
    }
    window.addEventListener("pointerdown", onPointerDown, {
      capture: true,
      passive: true,
    })
    return () =>
      window.removeEventListener("pointerdown", onPointerDown, { capture: true })
  }, [])
}
