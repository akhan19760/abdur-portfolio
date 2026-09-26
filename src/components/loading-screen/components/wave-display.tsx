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
          style={{
            // Layered solid offset copies — no blur on any layer, purely
            // geometric extrusion. Each step shifts 1px further bottom-right
            // in a progressively darker purple, building up a chunky 3-D face.
            // Static decorative values, cannot be Tailwind classes.
            textShadow: [
              "1px 1px 0 #8800e0",
              "2px 2px 0 #7700cc",
              "3px 3px 0 #6600b8",
              "4px 4px 0 #5500aa",
              "5px 5px 0 #440099",
              "6px 6px 0 #3d0088",
              "7px 7px 0 #330077",
              "8px 8px 0 #2b0066",
              "9px 9px 0 #220055",
              "10px 10px 0 #1a0044",
            ].join(", "),
          }}
        >
          000
        </span>
      </div>
    </>
  )
}
