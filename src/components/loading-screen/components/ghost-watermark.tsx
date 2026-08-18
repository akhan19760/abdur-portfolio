import type { RefObject } from "react"
import { GHOST_TEXT } from "../constants"

export function GhostWatermark({
  ghostTextRef,
}: {
  ghostTextRef: RefObject<HTMLSpanElement | null>
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center overflow-hidden">
      <span
        ref={ghostTextRef}
        className="select-none font-mono font-bold leading-none text-accent opacity-[0.04]"
        style={{ fontSize: "10vw", letterSpacing: "-0.04em" }}
      >
        {GHOST_TEXT}
      </span>
    </div>
  )
}
