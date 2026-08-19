import { useEffect, type RefObject } from "react"
import type { RadarBlip } from "@/types/loading-screen"
import { drawRadarFrame } from "@/components/loading-screen/draw"

export function useRadarCanvas(
  radarCanvasRef: RefObject<HTMLCanvasElement | null>,
  radarAngleRef: RefObject<number>,
  radarBlipsRef: RefObject<RadarBlip[]>
): void {
  useEffect(() => {
    const canvas = radarCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const SIZE = 130
    canvas.width = SIZE
    canvas.height = SIZE
    const blips = radarBlipsRef.current
    let rafId = 0

    const tick = () => {
      radarAngleRef.current = (radarAngleRef.current + 0.022) % (Math.PI * 2)
      const angle = radarAngleRef.current

      // Occasionally spawn a blip just behind the sweep head
      if (Math.random() < 0.007) {
        const a = angle - 0.05 + (Math.random() - 0.5) * 0.3
        const d = 0.25 + Math.random() * 0.68
        blips.push({ a, d, alpha: 1 })
      }

      drawRadarFrame(ctx, SIZE, angle, blips)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [radarAngleRef, radarBlipsRef, radarCanvasRef])
}
