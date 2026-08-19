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
    const tick = () => {
      waveRef.current.offset += 1.5
      drawWaveFrame(
        ctx,
        canvas.width,
        canvas.height,
        waveRef.current.offset,
        waveRef.current.amplitude,
        waveRef.current.corrupted
      )
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [canvasRef, waveRef])
}
