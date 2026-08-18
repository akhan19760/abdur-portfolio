export function EqSpectrum() {
  return (
    <>
      <div
        className="pointer-events-none absolute z-20 flex items-end gap-[3px]"
        style={{ left: "7%", top: "35%" }}
      >
        {[16, 28, 20, 38, 14, 42, 22, 10, 30, 18].map((h, i) => (
          <div
            key={i}
            className="js-eq-bar w-[3px] rounded-sm bg-accent/30"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      <p
        className="pointer-events-none absolute z-20 font-mono text-[7px] tracking-widest text-accent/20"
        style={{ left: "7%", top: "calc(35% + 52px)" }}
      >
        FREQ_MONITOR
      </p>
    </>
  )
}
