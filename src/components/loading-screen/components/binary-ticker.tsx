import type { RefObject } from "react"
import { BINARY_CHUNK } from "../constants"

export function BinaryTicker({
  binaryStripRef,
}: {
  binaryStripRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 overflow-hidden"
      style={{ top: "calc(50% + 83px)" }}
    >
      <div ref={binaryStripRef} className="flex whitespace-nowrap">
        <span className="pr-12 font-mono text-[8px] tracking-widest text-text/10">
          {BINARY_CHUNK}
        </span>
        <span
          className="pr-12 font-mono text-[8px] tracking-widest text-text/10"
          aria-hidden="true"
        >
          {BINARY_CHUNK}
        </span>
      </div>
    </div>
  )
}
