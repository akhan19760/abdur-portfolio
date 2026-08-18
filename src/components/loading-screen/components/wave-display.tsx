import type { RefObject } from "react"

export function WaveDisplay({
  canvasRef,
  labelRef,
  counterRef,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>
  labelRef: RefObject<HTMLSpanElement | null>
  counterRef: RefObject<HTMLSpanElement | null>
}) {
  return (
    <>
      {/* Wave canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute left-0 top-1/2 z-20 h-[140px] w-full -translate-y-1/2"
      />

      {/* Status label */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <span
          ref={labelRef}
          className="border border-accent/30 bg-base px-3 py-1 font-mono text-[10px] tracking-[0.2em] text-text/50"
        >
          LOADING_PORTFOLIO...
        </span>
      </div>

      {/* Counter */}
      <div className="pointer-events-none absolute inset-x-0 top-[57%] z-20 flex justify-center">
        <span
          ref={counterRef}
          className="font-mono text-[clamp(5rem,8vw,8rem)] font-light leading-none tabular-nums text-text"
        >
          000
        </span>
      </div>
    </>
  )
}
