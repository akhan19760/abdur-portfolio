import { useEffect, type RefObject } from "react"
import { drawGrainFrame } from "@/components/loading-screen/draw"

// 300×200 canvas scaled to full screen; bilinear browser scaling blurs
// individual random pixels into a continuous film-grain texture at ~5.5% opacity.
export function useGrainCanvas(
  grainCanvasRef: RefObject<HTMLCanvasElement | null>
): void {
  useEffect(() => {
    const canvas = grainCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width  = 300
    canvas.height = 200
    let rafId = 0
    const tick = () => {
      drawGrainFrame(ctx, 300, 200)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [grainCanvasRef])
}
