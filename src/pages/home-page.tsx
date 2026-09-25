import { SocialLinks } from "@/components/layout"
import { useClickPing } from "@/hooks/cursor"
import { HeroSection } from "@/sections/hero/hero-section"
import { AboutSection } from "@/sections/about/about-section"
import { ProjectsSection } from "@/sections/projects/projects-section"

// Remaining sections are placeholders until their units are built
const PLACEHOLDER_SECTIONS = [
  { label: "Process", hint: "How I build things" },
  { label: "Contact", hint: "Get in touch" },
] as const

export function HomePage() {
  // Every click anywhere sends a ping through the page's light system
  useClickPing()

  return (
    <main>
      <HeroSection />
      <AboutSection />
      <ProjectsSection />

      {/* Floating social links — fixed to the viewport across all sections */}
      <SocialLinks />

      {/* ── Placeholder sections (replaced as each unit is built) ────────────── */}
      <div className="mx-auto max-w-2xl space-y-[40vh] px-6 py-24">
        {PLACEHOLDER_SECTIONS.map(({ label, hint }) => (
          <section key={label} className="space-y-3 rounded-lg border border-border p-10">
            <h2 className="font-display text-5xl text-text">{label}</h2>
            <p className="font-mono text-sm text-text/50">{hint}</p>
          </section>
        ))}
        <p className="pb-24 font-mono text-xs text-text/30">— placeholder sections —</p>
      </div>
    </main>
  )
}
