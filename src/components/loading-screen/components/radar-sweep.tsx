import type { RefObject } from "react"

export function RadarSweep({
  radarCanvasRef,
}: {
  radarCanvasRef: RefObject<HTMLCanvasElement | null>
}) {
  return (
    // Hidden on phones, where it would sit on top of the terminal log
    <div className="absolute z-20 hidden sm:block" style={{ right: "5%", bottom: "5%" }}>
      <canvas
        ref={radarCanvasRef}
        className="block rounded-full"
        width={130}
        height={130}
      />
      <p className="mt-1 text-center font-mono text-[7px] tracking-widest text-accent/25">
        SCAN_ACTIVE
      </p>
    </div>
  )
}
