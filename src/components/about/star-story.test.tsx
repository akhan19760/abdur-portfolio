import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { axe } from "vitest-axe"
import { StarStory } from "./star-story"
import { starId } from "./about-shared"

const BEATS = Array.from({ length: 8 }, (_, i) => ({
  mark: "M" + (i + 1),
  text: "Beat number " + (i + 1) + " of the story.",
}))

const LABELS = {
  prompt: "Touch a star.",
  traced: "TRACED",
  complete: "ORIGIN TRACED",
  star: (n: number, total: number, mark: string) =>
    "Star " + n + " of " + total + ": " + mark,
}

type Options = {
  traced?: string[]
  active?: number | null
  depth?: boolean
  onTrace?: (id: string) => void
}

function renderStory({
  traced = [],
  active = null,
  depth = true,
  onTrace = vi.fn(),
}: Options = {}) {
  return render(
    <StarStory
      beats={BEATS}
      isTraced={(id) => traced.includes(id)}
      onTrace={onTrace}
      active={active}
      labels={LABELS}
      depth={depth}
    />
  )
}

describe("StarStory", () => {
  it("renders one star button per beat, named by position and tag", () => {
    renderStory()
    expect(screen.getAllByRole("button")).toHaveLength(8)
    expect(screen.getByRole("button", { name: "Star 3 of 8: M3" })).toBeInTheDocument()
  })

  it("makes stars light targets carrying their id and traced state", () => {
    renderStory({ traced: [starId(1)] })
    const [first, second] = screen.getAllByRole("button")
    expect(first).toHaveAttribute("data-light")
    expect(first).toHaveAttribute("data-star-id", starId(0))
    expect(first).not.toHaveAttribute("data-traced")
    expect(second).toHaveAttribute("data-traced")
  })

  it("traces a star on click", async () => {
    const user = userEvent.setup()
    const onTrace = vi.fn()
    renderStory({ onTrace })
    await user.click(screen.getByRole("button", { name: /Star 5 of 8/ }))
    expect(onTrace).toHaveBeenCalledWith(starId(4))
  })

  it("traces a star on keyboard focus", async () => {
    const user = userEvent.setup()
    const onTrace = vi.fn()
    renderStory({ onTrace })
    await user.tab()
    expect(onTrace).toHaveBeenCalledWith(starId(0))
  })

  it("shows the prompt until a star is touched", () => {
    const { container } = renderStory()
    expect(container.textContent).toContain("Touch a star.")
  })

  it("shows the active beat in large type, flying out of its star", () => {
    const { container } = renderStory({ traced: [starId(2)], active: 2 })
    expect(container.textContent).toContain("Beat number 3 of the story.")
    expect(container.querySelector("[data-word]")).toHaveClass("animate-word-from-star")
  })

  it("keeps the whole story in an ordered list for screen readers", () => {
    renderStory()
    const list = screen.getByRole("list")
    expect(list).toHaveClass("sr-only")
    expect(within(list).getAllByRole("listitem")).toHaveLength(8)
  })

  it("shows the story list visibly in the flat fallback", () => {
    renderStory({ depth: false })
    expect(screen.getByRole("list")).not.toHaveClass("sr-only")
  })

  it("counts traced stars, then announces completion", () => {
    const { unmount } = renderStory({ traced: [starId(0), starId(5)] })
    expect(screen.getByText("TRACED 02/08")).toBeInTheDocument()
    unmount()
    renderStory({ traced: BEATS.map((_, i) => starId(i)) })
    expect(screen.getByText("ORIGIN TRACED")).toBeInTheDocument()
  })

  it("hides the animated large text from assistive tech", () => {
    const { container } = renderStory({ active: 0 })
    expect(
      container.querySelector("[data-word]")?.closest('[aria-hidden="true"]')
    ).not.toBeNull()
  })

  it("passes axe accessibility audit", async () => {
    const { container } = renderStory({ traced: [starId(2)], active: 2 })
    expect(await axe(container)).toHaveNoViolations()
  })
})
