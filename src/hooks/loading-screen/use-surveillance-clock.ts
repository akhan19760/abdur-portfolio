import { useEffect, type RefObject } from "react"

export function useSurveillanceClock(clockRef: RefObject<HTMLSpanElement | null>): void {
  useEffect(() => {
    let elapsed = 0
    const id = setInterval(() => {
      elapsed += 16
      if (clockRef.current) {
        const ms = String(elapsed % 1000).padStart(3, "0")
        const s = String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")
        const m = String(Math.floor(elapsed / 60000) % 60).padStart(2, "0")
        clockRef.current.textContent = `${m}:${s}.${ms}`
      }
    }, 16)
    return () => clearInterval(id)
  }, [clockRef])
}
