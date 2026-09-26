import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"
import "@/lib/i18n"
import { HomePage } from "./home-page"

// axe over a whole section or page is slow when test files run in parallel
const AXE_TIMEOUT = 20_000

// jsdom has no matchMedia (SocialLinks, ScrollTrigger), no canvas / font
// loading (Hero) and no WebGL (About's 3D core). Those are verified in the
// browser; here we check the page's composition.
vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

vi.mock("@/sections/hero/hero-section", () => ({
  HeroSection: () => (
    <section aria-label="Hero">
      <h1>Abdur Khan — Frontend Developer</h1>
    </section>
  ),
}))

vi.mock("@/components/about/signal-core", () => ({
  SignalCore: () => null,
}))

vi.mock("@/components/projects/mirror-sea", () => ({
  MirrorSea: () => null,
}))

vi.mock("@/components/process/folding-paper", () => ({
  FoldingPaper: () => null,
}))

vi.mock("@/components/contact/pin-wall", () => ({
  PinWall: () => null,
}))

describe("HomePage", () => {
  it("renders the sections in scroll order", () => {
    render(<HomePage />)
    const regions = screen
      .getAllByRole("region")
      .map((r) => r.getAttribute("aria-label") ?? r.id)
    expect(regions).toEqual(["Hero", "about", "work", "process", "contact"])
  })

  it("renders the About, Work, Process and Contact sections, each once", () => {
    render(<HomePage />)
    for (const name of ["About", "Work", "Process", "Contact"]) {
      expect(screen.getAllByRole("heading", { level: 2, name })).toHaveLength(1)
    }
  })

  it(
    "has no accessibility violations",
    async () => {
      const { container } = render(<HomePage />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    },
    AXE_TIMEOUT
  )
})
