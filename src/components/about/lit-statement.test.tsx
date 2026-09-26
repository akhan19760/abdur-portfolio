import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { axe } from "vitest-axe"
import { LitStatement } from "./lit-statement"

const SEGMENTS = [
  { text: "I build things that feel " },
  { text: "precise", accent: true },
  { text: ", mostly." },
]

describe("LitStatement", () => {
  it("renders the sentence exactly as written", () => {
    const { container } = render(<LitStatement segments={SEGMENTS} />)
    expect(container.querySelector("p")?.textContent).toBe(
      "I build things that feel precise, mostly."
    )
  })

  it("wraps each word in its own light target", () => {
    const { container } = render(<LitStatement segments={SEGMENTS} />)
    const words = Array.from(container.querySelectorAll("[data-light]")).map(
      (w) => w.textContent
    )
    expect(words).toEqual([
      "I",
      "build",
      "things",
      "that",
      "feel",
      "precise",
      ",",
      "mostly.",
    ])
  })

  it("styles accent words as keywords", () => {
    const { getByText } = render(<LitStatement segments={SEGMENTS} />)
    expect(getByText("precise")).toHaveClass("text-accent-soft")
    expect(getByText("build")).not.toHaveClass("text-accent-soft")
  })

  it("renders nothing extra for empty segments", () => {
    const { container } = render(<LitStatement segments={[{ text: "" }]} />)
    expect(container.querySelectorAll("[data-light]")).toHaveLength(0)
  })

  it("applies a custom className", () => {
    const { container } = render(
      <LitStatement segments={SEGMENTS} className="text-center" />
    )
    expect(container.querySelector("p")).toHaveClass("text-center")
  })

  it("passes axe accessibility audit", async () => {
    const { container } = render(<LitStatement segments={SEGMENTS} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
