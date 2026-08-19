// Temporary scroll-test content — replaced when real sections are built
const SCROLL_BLOCKS = [
  { label: "Hero", hint: "Loading screen → hero transition" },
  { label: "About", hint: "Identity / brief bio" },
  { label: "Work", hint: "Project showcase — scroll-driven reveals" },
  { label: "Process", hint: "How I build things" },
  { label: "Contact", hint: "Get in touch" },
] as const

export function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 space-y-[40vh]">
      <p className="text-xs tracking-widest text-text/40 font-mono uppercase">
        Scroll test — Lenis smooth scroll verification
      </p>

      {SCROLL_BLOCKS.map(({ label, hint }) => (
        <section key={label} className="border border-border rounded-lg p-10 space-y-3">
          <h2 className="font-display text-5xl text-text">{label}</h2>
          <p className="text-text/50 text-sm font-mono">{hint}</p>
        </section>
      ))}

      <p className="text-xs text-text/30 font-mono pb-24">— end of scroll test —</p>
    </main>
  )
}
