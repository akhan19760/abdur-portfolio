/**
 * Structure, content and accessibility of the Contact section in both modes.
 * The pin wall and the handoff from Process are verified manually in-browser
 * (per the `testing` skill); the wall is mocked here because jsdom has no
 * WebGL.
 */
import { act, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"
import i18n from "@/lib/i18n"
import en from "@/locales/en.json"
import ur from "@/locales/ur.json"
import { CONTACT } from "@/constants"
import { ContactSection } from "./contact-section"

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

// The wall reports what it was given, so the section's wiring can be checked
const wallProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }))
vi.mock("@/components/contact/pin-wall", () => ({
  PinWall: (props: Record<string, unknown>) => {
    wallProps.current = props
    return <div data-testid="pin-wall" />
  },
}))

describe("ContactSection", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage("en"))
    wallProps.current = null
  })

  afterEach(() => {
    setMedia()
  })

  it("has the same strings in both languages", () => {
    expect(Object.keys(ur.contact).sort()).toEqual(Object.keys(en.contact).sort())
  })

  describe("flat mode", () => {
    beforeEach(() => setMedia(HOVER, WIDE, REDUCE))

    it("is a landmark labelled by its h2", () => {
      render(<ContactSection />)
      expect(screen.getByRole("region", { name: "Contact" })).toBeInTheDocument()
      expect(
        screen.getByRole("heading", { level: 2, name: "Contact" })
      ).toBeInTheDocument()
    })

    it("gives the email address, a way to copy it, and the other links", () => {
      render(<ContactSection />)
      const region = screen.getByRole("region")
      expect(within(region).getByText(en.contact.intro)).toBeInTheDocument()
      expect(within(region).getByRole("link", { name: CONTACT.email })).toHaveAttribute(
        "href",
        `mailto:${CONTACT.email}`
      )
      expect(
        within(region).getByRole("button", { name: en.contact.copy })
      ).toBeInTheDocument()
      const list = within(region).getByRole("list", { name: en.contact.linksLabel })
      expect(within(list).getByRole("link", { name: /LinkedIn/ })).toHaveAttribute(
        "href",
        CONTACT.linkedin
      )
      expect(within(list).getByRole("link", { name: /GitHub/ })).toHaveAttribute(
        "href",
        CONTACT.github
      )
    })

    it("ends the page with a footer line", () => {
      render(<ContactSection />)
      expect(
        screen.getByText(new RegExp(`© ${new Date().getFullYear()}`))
      ).toBeInTheDocument()
    })

    it("shows the wall's words in dots, with no 3D and no pinned scroll", () => {
      render(<ContactSection />)
      expect(screen.getByText(en.contact.wall)).toHaveAttribute("aria-hidden", "true")
      expect(screen.queryByTestId("pin-wall")).not.toBeInTheDocument()
      expect(screen.queryByText(en.contact.hint)).not.toBeInTheDocument()
      expect(screen.getByRole("region")).toHaveAttribute("data-mode", "flat")
      expect(screen.getByRole("region").style.height).toBe("")
    })

    it(
      "passes axe accessibility audit",
      async () => {
        const { container } = render(<ContactSection />)
        expect(await axe(container)).toHaveNoViolations()
      },
      AXE_TIMEOUT
    )
  })

  describe("touch", () => {
    beforeEach(() => setMedia())

    it("still runs the wall (the compact layout), with the touch hint", () => {
      render(<ContactSection />)
      expect(screen.getByRole("region")).toHaveAttribute("data-mode", "immersive")
      expect(screen.getByText(en.contact.hintTouch)).toBeInTheDocument()
    })
  })

  describe("immersive mode", () => {
    beforeEach(() => setMedia(HOVER, WIDE))

    it("gives the section its scroll length", () => {
      render(<ContactSection />)
      const region = screen.getByRole("region")
      expect(region).toHaveAttribute("data-mode", "immersive")
      expect(parseFloat(region.style.height)).toBeGreaterThan(100)
    })

    it("loads the wall with the words to spell out", async () => {
      render(<ContactSection />)
      expect(await screen.findByTestId("pin-wall")).toBeInTheDocument()
      expect(wallProps.current?.lettering).toBe(en.contact.wall)
      expect(typeof wallProps.current?.readUnits).toBe("function")
    })

    it("leaves the words to the wall and says how to play with it", () => {
      render(<ContactSection />)
      expect(screen.queryByText(en.contact.wall)).not.toBeInTheDocument()
      expect(screen.getByText(en.contact.hint)).toBeInTheDocument()
    })

    it("keeps the text faded out until the wall is ready, but in the reading order", () => {
      const { container } = render(<ContactSection />)
      const hud = container.querySelectorAll("[data-wall-hud]")
      expect(hud.length).toBeGreaterThan(0)
      hud.forEach((el) => expect(el).toHaveAttribute("data-light-off"))
      expect(screen.getByRole("link", { name: CONTACT.email })).toBeInTheDocument()
    })

    it(
      "passes axe accessibility audit",
      async () => {
        const { container } = render(<ContactSection />)
        await screen.findByTestId("pin-wall")
        expect(await axe(container)).toHaveNoViolations()
      },
      AXE_TIMEOUT
    )
  })

  describe("Roman Urdu", () => {
    beforeEach(() => setMedia(HOVER, WIDE, REDUCE))

    it("switches copy with the language", async () => {
      render(<ContactSection />)
      await act(() => i18n.changeLanguage("ur"))
      expect(
        screen.getByRole("heading", { level: 2, name: ur.contact.heading })
      ).toBeInTheDocument()
      expect(screen.getByRole("button", { name: ur.contact.copy })).toBeInTheDocument()
      expect(screen.getByText(ur.contact.intro)).toBeInTheDocument()
    })
  })
})
