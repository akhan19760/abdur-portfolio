import { useEffect, type RefObject } from "react"
import type { WaveState } from "@/types/loading-screen"
import { drawWaveFrame } from "@/components/loading-screen/draw"

export function useWaveCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  waveRef: RefObject<WaveState>
): void {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = canvas.offsetWidth || window.innerWidth
    canvas.height = canvas.offsetHeight || 140
    let rafId = 0
    let frame = 0
    const tick = () => {
      frame++
      // Pass the raw frame counter as `time` so drawWaveFrame can evolve the
      // wave shape over time — each frequency component drifts independently,
      // producing a constantly changing waveform that stays within canvas bounds.
      drawWaveFrame(
        ctx,
        canvas.width,
        canvas.height,
        frame,
        waveRef.current.amplitude,
        waveRef.current.corrupted
      )
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [canvasRef, waveRef])
}
