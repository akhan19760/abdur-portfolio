/**
 * Structure, content, discovery and accessibility of the About section in
 * both modes. The dive, the light, the FX canvas and the 3D world are verified
 * manually in-browser (per the `testing` skill); the 3D core is mocked here
 * because jsdom has no WebGL.
 */
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { axe } from "vitest-axe"
import i18n from "@/lib/i18n"
import en from "@/locales/en.json"
import { AboutSection } from "./about-section"

// axe over a whole section or page is slow when test files run in parallel
const AXE_TIMEOUT = 20_000

// ── matchMedia: ScrollTrigger needs it at import time, so stub it hoisted ──
const media = vi.hoisted(() => {
  const state = { matching: new Set<string>() }
  window.matchMedia = ((query: string) => ({
    matches: state.matching.has(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
  return state
})

const HOVER = "(hover: hover) and (pointer: fine)"
const WIDE = "(min-width: 1024px)"
const REDUCE = "(prefers-reduced-motion: reduce)"

function setMedia(...queries: string[]) {
  media.matching = new Set(queries)
}

vi.mock("@/components/about/signal-core", () => ({
  SignalCore: () => <div data-testid="signal-core" />,
}))

const beats = en.about.origin.beats
const files = [...en.about.log.experience, ...en.about.log.education]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AboutSection", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage("en"))
  })

  afterEach(() => {
    setMedia()
  })

  describe("content (flat mode, mouse)", () => {
    beforeEach(() => setMedia(HOVER, WIDE, REDUCE))

    it("is a landmark labelled by its h2", () => {
      render(<AboutSection />)
      expect(screen.getByRole("region", { name: "About" })).toBeInTheDocument()
      expect(screen.getByRole("heading", { level: 2, name: "About" })).toBeInTheDocument()
    })

    it("has one h3 per layer, in order", () => {
      render(<AboutSection />)
      const titles = screen
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent)
      expect(titles).toEqual([
        "01 / Signal",
        "02 / Origin",
        "03 / Field log",
        "04 / Status",
      ])
    })

    it("renders the statement", () => {
      const { container } = render(<AboutSection />)
      expect(container.textContent).toContain(
        en.about.statement.map((s) => s.text).join("")
      )
    })

    it("keeps the whole Origin story in an ordered list", () => {
      render(<AboutSection />)
      beats.forEach((beat) => expect(screen.getByText(beat.text)).toBeInTheDocument())
    })

    it("names every case file with its full entry", () => {
      render(<AboutSection />)
      files.forEach((file) => {
        expect(
          screen.getByRole("button", {
            name: new RegExp(file.role.replace(/[[\]]/g, "\\$&")),
          })
        ).toBeInTheDocument()
      })
      expect(
        screen.getAllByRole("button", { name: /^(Experience|Education):/ })
      ).toHaveLength(files.length)
    })

    it("names every satellite with its readout", () => {
      render(<AboutSection />)
      en.about.status.items.forEach((item) => {
        expect(
          screen.getByRole("button", { name: new RegExp("^" + item.label + ":") })
        ).toBeInTheDocument()
      })
      expect(
        screen.getByRole("button", { name: /^AVAILABILITY: Open to work/ })
      ).toBeInTheDocument()
    })

    it("doesn't load the 3D world or the FX canvas, or pin the section", () => {
      render(<AboutSection />)
      expect(screen.queryByTestId("signal-core")).not.toBeInTheDocument()
      expect(screen.queryByTestId("about-fx")).not.toBeInTheDocument()
      expect(screen.getByRole("region")).toHaveAttribute("data-mode", "flat")
    })

    it(
      "passes axe accessibility audit",
      async () => {
        const { container } = render(<AboutSection />)
        expect(await axe(container)).toHaveNoViolations()
      },
      AXE_TIMEOUT
    )
  })

  describe("exploring (flat mode, mouse)", () => {
    beforeEach(() => setMedia(HOVER, WIDE, REDUCE))

    it("traces a star and speaks its line", async () => {
      const user = userEvent.setup()
      const { container } = render(<AboutSection />)
      await user.click(screen.getByRole("button", { name: /Star 4 of 8/ }))
      expect(screen.getByText(/TRACED 01\/08/)).toBeInTheDocument()
      const spoken = container.querySelector("[data-word]")?.closest("p")
      expect(spoken?.textContent).toBe(beats[3].text)
    })

    it("decrypts a case file on click, then all of them", async () => {
      const user = userEvent.setup()
      render(<AboutSection />)
      await user.click(screen.getAllByRole("button", { name: /^Experience:/ })[0])
      expect(screen.getByText("DECRYPTED 01/03")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Decrypt all" }))
      expect(screen.getByText(en.about.log.complete)).toBeInTheDocument()
    })

    it("shows every satellite readout and the finale without motion", () => {
      const { container } = render(<AboutSection />)
      expect(screen.getByText("SIGNAL LOCKED")).toBeInTheDocument()
      expect(container.textContent).toContain(en.about.status.availability.alert)
    })

    it("finds fragments by click or keyboard, and counts them", async () => {
      const user = userEvent.setup()
      render(<AboutSection />)
      expect(screen.getByText("Fragments found: 0 of 6")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: /FRAG_03/ }))
      expect(screen.getByText("Fragments found: 1 of 6")).toBeInTheDocument()
    })
  })

  describe("touch", () => {
    beforeEach(() => setMedia())

    it("uses flat mode with the touch hint", () => {
      render(<AboutSection />)
      expect(screen.getByRole("region")).toHaveAttribute("data-mode", "flat")
      expect(screen.getByText(en.about.hintTouch)).toBeInTheDocument()
    })

    it("starts with the story traced and the case files decrypted", () => {
      render(<AboutSection />)
      expect(screen.getByText(en.about.origin.complete)).toBeInTheDocument()
      expect(screen.getByText(en.about.log.complete)).toBeInTheDocument()
    })
  })

  describe("depth mode", () => {
    beforeEach(() => setMedia(HOVER, WIDE))

    it("overlaps the Hero and makes the section tall for the dive", () => {
      render(<AboutSection />)
      const region = screen.getByRole("region")
      expect(region).toHaveAttribute("data-mode", "depth")
      expect(region.style.marginTop).toBe("-100vh")
      expect(parseFloat(region.style.height)).toBeGreaterThan(500)
    })

    it("lets clicks through to the Hero it overlaps", () => {
      // jsdom can't hit-test, so this checks the class that makes the section
      // transparent to clicks (the Hero's buttons sit under it); its own
      // controls opt back in, as the tests above click them.
      render(<AboutSection />)
      expect(screen.getByRole("region")).toHaveClass("pointer-events-none")
    })

    it("loads the 3D world and the FX canvas", async () => {
      render(<AboutSection />)
      expect(await screen.findByTestId("signal-core")).toBeInTheDocument()
      expect(screen.getByTestId("about-fx")).toBeInTheDocument()
    })

    it("starts with all four layers waiting in the depth", () => {
      const { container } = render(<AboutSection />)
      const layers = container.querySelectorAll("[data-depth-layer]")
      expect(layers).toHaveLength(4)
      layers.forEach((layer) => expect(layer).toHaveAttribute("data-light-off"))
    })

    it("puts the case files on a carousel and the satellites on orbits", () => {
      render(<AboutSection />)
      expect(
        screen
          .getAllByRole("button", { name: /^Experience:/ })[0]
          .style.getPropertyValue("--a")
      ).not.toBe("")
      expect(screen.getByRole("button", { name: /^LOCATION:/ })).toHaveAttribute(
        "data-orbit-index"
      )
    })

    it("keeps the h2 before the layer headings", () => {
      render(<AboutSection />)
      const headings = within(screen.getByRole("region")).getAllByRole("heading")
      expect(headings[0]).toHaveAccessibleName("About")
    })

    it(
      "passes axe accessibility audit",
      async () => {
        const { container } = render(<AboutSection />)
        await screen.findByTestId("signal-core")
        expect(await axe(container)).toHaveNoViolations()
      },
      AXE_TIMEOUT
    )
  })

  describe("Roman Urdu", () => {
    beforeEach(() => setMedia(HOVER, WIDE, REDUCE))

    it("switches copy with the language", async () => {
      render(<AboutSection />)
      await act(() => i18n.changeLanguage("ur"))
      expect(
        screen.getByRole("heading", { level: 2, name: "Taaruf" })
      ).toBeInTheDocument()
    })
  })
})
