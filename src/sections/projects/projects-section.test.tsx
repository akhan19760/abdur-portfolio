/**
 * Structure, content and accessibility of the Work section in both modes. The
 * sea, the glide and the handoff from About are verified manually in-browser
 * (per the `testing` skill); the sea is mocked here because jsdom has no WebGL.
 */
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"
import i18n from "@/lib/i18n"
import en from "@/locales/en.json"
import { ProjectsSection } from "./projects-section"

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

// The sea reports what it was given, so the section's wiring can be checked
const seaProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }))
vi.mock("@/components/projects/mirror-sea", () => ({
  MirrorSea: (props: Record<string, unknown>) => {
    seaProps.current = props
    return <div data-testid="mirror-sea" />
  },
}))

const projects = en.work.projects

describe("ProjectsSection", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage("en"))
    seaProps.current = null
  })

  afterEach(() => {
    setMedia()
  })

  describe("flat mode", () => {
    beforeEach(() => setMedia(HOVER, WIDE, REDUCE))

    it("is a landmark labelled by its h2", () => {
      render(<ProjectsSection />)
      expect(screen.getByRole("region", { name: "Work" })).toBeInTheDocument()
      expect(screen.getByRole("heading", { level: 2, name: "Work" })).toBeInTheDocument()
    })

    it("has one article with an h3 per project, in order, after the h2", () => {
      render(<ProjectsSection />)
      const headings = within(screen.getByRole("region")).getAllByRole("heading", {
        level: 3,
      })
      expect(headings.map((h) => h.textContent)).toEqual(projects.map((p) => p.name))
      expect(screen.getAllByRole("article")).toHaveLength(projects.length)
      expect(
        within(screen.getByRole("region")).getAllByRole("heading")[0]
      ).toHaveAccessibleName("Work")
    })

    it("shows every project's details and highlights in plain text", () => {
      render(<ProjectsSection />)
      const first = screen.getAllByRole("article")[0]
      expect(within(first).getByText(projects[0].summary)).toBeInTheDocument()
      projects[0].highlights.forEach((h) =>
        expect(within(first).getByText(h.text)).toBeInTheDocument()
      )
      projects[0].stack.forEach((tech) =>
        expect(within(first).getByText(tech)).toBeInTheDocument()
      )
    })

    it("shows each project's picture beside it, with no sea and no pinned scroll", () => {
      render(<ProjectsSection />)
      expect(screen.getAllByText(en.work.placeholder)).toHaveLength(projects.length)
      expect(screen.queryByTestId("mirror-sea")).not.toBeInTheDocument()
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
      expect(screen.getByRole("region")).toHaveAttribute("data-mode", "flat")
      expect(screen.getByRole("region").style.height).toBe("")
    })

    it("shows no links while the projects have none", () => {
      render(<ProjectsSection />)
      expect(screen.queryByRole("link")).not.toBeInTheDocument()
    })

    it(
      "passes axe accessibility audit",
      async () => {
        const { container } = render(<ProjectsSection />)
        expect(await axe(container)).toHaveNoViolations()
      },
      AXE_TIMEOUT
    )
  })

  describe("touch", () => {
    beforeEach(() => setMedia())

    it("still runs the sea (the compact layout), with the touch hint", () => {
      render(<ProjectsSection />)
      expect(screen.getByRole("region")).toHaveAttribute("data-mode", "immersive")
      expect(screen.getAllByRole("article")).toHaveLength(projects.length)
      expect(screen.getByText(en.work.hintTouch)).toBeInTheDocument()
    })
  })

  describe("immersive mode", () => {
    beforeEach(() => setMedia(HOVER, WIDE))

    it("makes the section tall for the glide, right after About", () => {
      render(<ProjectsSection />)
      const region = screen.getByRole("region")
      expect(region).toHaveAttribute("data-mode", "immersive")
      expect(parseFloat(region.style.height)).toBeGreaterThan(500)
      expect(region.style.marginTop).toBe("")
    })

    it("loads the sea with every project's name and picture", async () => {
      render(<ProjectsSection />)
      expect(await screen.findByTestId("mirror-sea")).toBeInTheDocument()
      const given = seaProps.current?.projects as { name: string }[]
      expect(given.map((p) => p.name)).toEqual(projects.map((p) => p.name))
      expect(seaProps.current?.placeholderLabel).toBe(en.work.placeholder)
    })

    it("leaves the pictures to the sea and starts with every project waiting", () => {
      const { container } = render(<ProjectsSection />)
      expect(screen.queryByText(en.work.placeholder)).not.toBeInTheDocument()
      const panels = container.querySelectorAll("[data-sea-panel]")
      expect(panels).toHaveLength(projects.length)
      panels.forEach((panel) => expect(panel).toHaveAttribute("data-light-off"))
    })

    it("shows where you are: a counter and the list of projects", () => {
      render(<ProjectsSection />)
      const nav = screen.getByRole("navigation", { name: en.work.navLabel })
      const buttons = within(nav).getAllByRole("button")
      expect(buttons).toHaveLength(projects.length)
      expect(buttons[0]).toHaveAttribute("aria-current", "true")
      expect(screen.getByText(en.work.hint)).toBeInTheDocument()
    })

    it("jumps to a project from the list", async () => {
      const user = userEvent.setup()
      const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
      render(<ProjectsSection />)
      await user.click(screen.getByRole("button", { name: projects[2].name }))
      expect(scrollTo).toHaveBeenCalled()
      scrollTo.mockRestore()
    })

    it(
      "passes axe accessibility audit",
      async () => {
        const { container } = render(<ProjectsSection />)
        await screen.findByTestId("mirror-sea")
        expect(await axe(container)).toHaveNoViolations()
      },
      AXE_TIMEOUT
    )
  })

  describe("Roman Urdu", () => {
    beforeEach(() => setMedia(HOVER, WIDE, REDUCE))

    it("switches copy with the language", async () => {
      render(<ProjectsSection />)
      await act(() => i18n.changeLanguage("ur"))
      expect(screen.getByRole("heading", { level: 2, name: "Kaam" })).toBeInTheDocument()
    })
  })
})
