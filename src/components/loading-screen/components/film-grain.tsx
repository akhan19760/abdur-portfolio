import type { RefObject } from "react"

export function FilmGrain({
  grainCanvasRef,
}: {
  grainCanvasRef: RefObject<HTMLCanvasElement | null>
}) {
  return (
    <canvas
      ref={grainCanvasRef}
      className="pointer-events-none absolute inset-0 z-30 h-full w-full opacity-[0.055]"
    />
  )
}
