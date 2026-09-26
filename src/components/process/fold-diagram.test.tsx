import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { axe } from "vitest-axe"
import { FoldDiagram } from "./fold-diagram"

describe("FoldDiagram", () => {
  it("draws a different picture for each step", () => {
    const drawings = [0, 1, 2, 3, 4].map((stage) => {
      const { container } = render(<FoldDiagram stage={stage} />)
      return container.innerHTML
    })
    expect(new Set(drawings).size).toBe(5)
  })

  it("shows the fold lines in purple from Design on, not before", () => {
    const { container, rerender } = render(<FoldDiagram stage={0} />)
    expect(container.querySelector(".stroke-accent-soft")).toBeNull()
    rerender(<FoldDiagram stage={1} />)
    expect(container.querySelector(".stroke-accent-soft")).not.toBeNull()
  })

  it("is hidden from assistive tech", () => {
    const { container } = render(<FoldDiagram stage={2} className="w-40" />)
    const svg = container.querySelector("svg")!
    expect(svg).toHaveAttribute("aria-hidden", "true")
    expect(svg).toHaveAttribute("focusable", "false")
    expect(svg).toHaveClass("w-40")
  })

  it("passes axe accessibility audit", async () => {
    const { container } = render(<FoldDiagram stage={3} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
