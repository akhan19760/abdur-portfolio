import type { RefObject } from "react"

export function SurveillanceHeader({
  clockRef,
}: {
  clockRef: RefObject<HTMLSpanElement | null>
}) {
  return (
    <>
      {/* Top-left system label */}
      <p className="absolute left-12 top-5 z-20 font-mono text-[10px] tracking-widest text-text/25">
        [ PORTFOLIO_v1 ]
      </p>

      {/* Top-right surveillance stats */}
      <div className="absolute right-12 top-5 z-20 flex flex-col items-end gap-[2px]">
        <span className="font-mono text-[9px] tracking-wider text-text/20">SYS_ID: 0xAR290F</span>
        <span className="font-mono text-[9px] tracking-wider text-text/20">HEAP: 847.3 MB</span>
        <span className="font-mono text-[9px] tracking-wider text-text/20">PROC: 12 cores</span>
        <span ref={clockRef} className="font-mono text-[9px] tracking-wider text-accent/40">
          00:00.000
        </span>
      </div>
    </>
  )
}
