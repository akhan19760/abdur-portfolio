/**
 * Structure, content and accessibility of the Process section in both modes.
 * The paper, its folds and the handoff from Work are verified manually
 * in-browser (per the `testing` skill); the paper is mocked here because
 * jsdom has no WebGL.
 */
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"
import i18n from "@/lib/i18n"
import en from "@/locales/en.json"
import ur from "@/locales/ur.json"
import { ProcessSection } from "./process-section"

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

// The paper reports what it was given, so the section's wiring can be checked
const paperProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }))
vi.mock("@/components/process/folding-paper", () => ({
  FoldingPaper: (props: Record<string, unknown>) => {
    paperProps.current = props
    return <div data-testid="folding-paper" />
  },
}))

const steps = en.process.steps

describe("ProcessSection", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage("en"))
    paperProps.current = null
  })

  afterEach(() => {
    setMedia()
  })

  it("has five steps in both languages: the paper is folded in five", () => {
    expect(en.process.steps).toHaveLength(5)
    expect(ur.process.steps.map((s) => s.id)).toEqual(en.process.steps.map((s) => s.id))
    expect(ur.process.notes).toHaveLength(en.process.notes.length)
  })

  describe("flat mode", () => {
    beforeEach(() => setMedia(HOVER, WIDE, REDUCE))

    it("is a landmark labelled by its h2", () => {
      render(<ProcessSection />)
      expect(screen.getByRole("region", { name: "Process" })).toBeInTheDocument()
      expect(
        screen.getByRole("heading", { level: 2, name: "Process" })
      ).toBeInTheDocument()
    })

    it("lists the steps in order, each an h3 after the h2, with its sentence", () => {
      render(<ProcessSection />)
      const region = screen.getByRole("region")
      // The steps' list (Discover holds a list of notes of its own)
      const list = within(region).getAllByRole("list")[0]
      const items = Array.from(list.children) as HTMLElement[]
      expect(items).toHaveLength(steps.length)
      items.forEach((item) => expect(item).toHaveRole("listitem"))
      expect(
        within(region)
          .getAllByRole("heading", { level: 3 })
          .map((h) => h.textContent)
      ).toEqual(steps.map((s) => s.name))
      expect(within(region).getAllByRole("heading")[0]).toHaveAccessibleName("Process")
      steps.forEach((s, i) =>
        expect(within(items[i]).getByText(s.summary)).toBeInTheDocument()
      )
    })

    it("lists Discover's notes under it, as text", () => {
      render(<ProcessSection />)
      const discover = screen.getAllByRole("listitem")[0]
      const notes = within(discover).getByRole("heading", {
        level: 4,
        name: en.process.notesLabel,
      })
      expect(notes).toBeInTheDocument()
      en.process.notes.forEach((note) =>
        expect(within(discover).getByText(note)).toBeInTheDocument()
      )
    })

    it("draws the paper beside each step, with no 3D and no pinned scroll", () => {
      const { container } = render(<ProcessSection />)
      expect(container.querySelectorAll("svg[data-stage]")).toHaveLength(steps.length)
      expect(screen.queryByTestId("folding-paper")).not.toBeInTheDocument()
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
      expect(screen.getByRole("region")).toHaveAttribute("data-mode", "flat")
      expect(screen.getByRole("region").style.height).toBe("")
    })

    it(
      "passes axe accessibility audit",
      async () => {
        const { container } = render(<ProcessSection />)
        expect(await axe(container)).toHaveNoViolations()
      },
      AXE_TIMEOUT
    )
  })

  describe("touch", () => {
    beforeEach(() => setMedia())

    it("still folds the paper (the compact layout), with the touch hint", () => {
      const { container } = render(<ProcessSection />)
      expect(screen.getByRole("region")).toHaveAttribute("data-mode", "immersive")
      expect(container.querySelectorAll("section > div > ol > li")).toHaveLength(
        steps.length
      )
      expect(screen.getByText(en.process.hintTouch)).toBeInTheDocument()
    })
  })

  describe("immersive mode", () => {
    beforeEach(() => setMedia(HOVER, WIDE))

    it("makes the section tall for the folding", () => {
      render(<ProcessSection />)
      const region = screen.getByRole("region")
      expect(region).toHaveAttribute("data-mode", "immersive")
      expect(parseFloat(region.style.height)).toBeGreaterThan(600)
    })

    it("loads the paper with the notes to jot on it", async () => {
      render(<ProcessSection />)
      expect(await screen.findByTestId("folding-paper")).toBeInTheDocument()
      expect(paperProps.current?.notes).toEqual(en.process.notes)
      expect(typeof paperProps.current?.readUnits).toBe("function")
    })

    it("leaves the pictures to the paper and starts with every step waiting", () => {
      const { container } = render(<ProcessSection />)
      expect(container.querySelector("svg[data-stage]")).toBeNull()
      const items = container.querySelectorAll("[data-fold-step]")
      expect(items).toHaveLength(steps.length)
      items.forEach((item) => expect(item).toHaveAttribute("data-light-off"))
    })

    it("shows the whole process in the step list, starting at the first", () => {
      render(<ProcessSection />)
      const nav = screen.getByRole("navigation", { name: en.process.navLabel })
      const buttons = within(nav).getAllByRole("button")
      expect(buttons).toHaveLength(steps.length)
      expect(buttons[0]).toHaveAttribute("aria-current", "step")
      expect(screen.getByText(en.process.hint)).toBeInTheDocument()
    })

    it("jumps to a step from the list", async () => {
      const user = userEvent.setup()
      const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
      render(<ProcessSection />)
      await user.click(screen.getByRole("button", { name: steps[3].name }))
      expect(scrollTo).toHaveBeenCalled()
      scrollTo.mockRestore()
    })

    it(
      "passes axe accessibility audit",
      async () => {
        const { container } = render(<ProcessSection />)
        await screen.findByTestId("folding-paper")
        expect(await axe(container)).toHaveNoViolations()
      },
      AXE_TIMEOUT
    )
  })

  describe("Roman Urdu", () => {
    beforeEach(() => setMedia(HOVER, WIDE, REDUCE))

    it("switches copy with the language", async () => {
      render(<ProcessSection />)
      await act(() => i18n.changeLanguage("ur"))
      expect(
        screen.getByRole("heading", { level: 2, name: "Tareeqa" })
      ).toBeInTheDocument()
      expect(screen.getByRole("heading", { level: 3, name: "Khoj" })).toBeInTheDocument()
    })
  })
})
