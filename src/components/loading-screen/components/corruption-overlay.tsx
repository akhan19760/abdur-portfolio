import type { RefObject } from "react"

export function CorruptionOverlay({
  errFlashRef,
}: {
  errFlashRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      {/* Glitch bars: GSAP sets random top and flashes each independently */}
      <div className="pointer-events-none absolute inset-0 z-40">
        {[2, 1, 4, 2, 3].map((h, i) => (
          <div
            key={i}
            className="js-glitch-bar absolute inset-x-0 bg-white/70 opacity-0"
            style={{ height: `${h}px`, top: 0 }}
          />
        ))}
      </div>

      {/* ERR_// — large dim text that flashes rapidly during corruption */}
      <div
        ref={errFlashRef}
        className="pointer-events-none absolute inset-0 z-40 flex items-center justify-end pr-16 opacity-0"
      >
        <p className="font-mono text-[5.5rem] font-bold leading-none tracking-tighter text-[#ff1111]/20">
          ERR_//
        </p>
      </div>
    </>
  )
}
