import { SocialLinks } from "@/components/layout"
import { useClickPing } from "@/hooks/cursor"
import { HeroSection } from "@/sections/hero/hero-section"
import { AboutSection } from "@/sections/about/about-section"
import { ProjectsSection } from "@/sections/projects/projects-section"
import { ProcessSection } from "@/sections/process/process-section"
import { ContactSection } from "@/sections/contact/contact-section"
import { LoopSection } from "@/sections/loop/loop-section"

export function HomePage() {
  // Every click anywhere sends a ping through the page's light system
  useClickPing()

  return (
    <main>
      <HeroSection />
      <AboutSection />
      <ProjectsSection />
      <ProcessSection />
      <ContactSection />
      {/* Past Contact the page loops back round to the Hero (immersive only) */}
      <LoopSection />

      {/* Floating social links — fixed to the viewport across all sections */}
      <SocialLinks />
    </main>
  )
}
