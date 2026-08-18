export function TargetingReticle() {
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{ right: "22%", top: "18%" }}
    >
      <div className="relative h-14 w-14">
        {/* Corner tick marks */}
        <div className="absolute left-0 top-0 h-3 w-3 border-l border-t border-accent/30" />
        <div className="absolute right-0 top-0 h-3 w-3 border-r border-t border-accent/30" />
        <div className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-accent/30" />
        <div className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-accent/30" />
        {/* Pulsing centre ring */}
        <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border border-accent/20" />
        {/* Static inner ring */}
        <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/30" />
        {/* Centre dot */}
        <div className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/60" />
      </div>
      <p className="mt-1 font-mono text-[7px] tracking-widest text-accent/25">TGT_LOCK</p>
    </div>
  )
}
