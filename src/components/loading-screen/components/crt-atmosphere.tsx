export function CrtAtmosphere() {
  return (
    <>
      {/* Phosphor vignette: blue-purple tint at centre, heavy darkness toward the edges. */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: [
            "radial-gradient(ellipse 55% 48% at 50% 50%,",
            "  rgba(255, 133, 27, 0.18) 0%,",
            "  rgba(180, 75, 10, 0.12) 30%,",
            "  transparent 48%,",
            "  rgba(0, 0, 0, 0.68) 70%,",
            "  rgba(0, 0, 0, 0.96) 100%",
            ")",
          ].join(""),
        }}
      />

      {/* CRT scanlines: 3px pitch (1 px transparent + 2 px dark stripe). */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.27) 1px, rgba(0,0,0,0.27) 3px)",
        }}
      />
    </>
  )
}
