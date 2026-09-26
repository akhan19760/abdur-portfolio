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
    const { container } = render(<LitStatement segments={SEGMENTS} />)
    const word = (text: string) =>
      Array.from(container.querySelectorAll("[data-light]")).find(
        (w) => w.textContent === text
      )
    expect(word("precise")).toHaveClass("text-accent-soft")
    expect(word("build")).not.toHaveClass("text-accent-soft")
  })

  it("splits every word into characters, in reading order", () => {
    const { container } = render(<LitStatement segments={SEGMENTS} />)
    const chars = Array.from(container.querySelectorAll("[data-char]"))
    const text = "I build things that feel precise, mostly.".replace(/\s/g, "")
    expect(chars.map((c) => c.textContent).join("")).toBe(text)
  })

  it("keeps every character inline so the sentence reads as one", () => {
    const { container } = render(<LitStatement segments={SEGMENTS} />)
    for (const c of container.querySelectorAll("[data-char]")) {
      expect(c.className).not.toMatch(/\binline-block\b|\bblock\b/)
    }
  })

  it("marks the statement so the section can drive its reveal", () => {
    const { container } = render(<LitStatement segments={SEGMENTS} />)
    expect(container.querySelector("p")).toHaveAttribute("data-statement")
  })

  it("shows every character in its real colour until a reveal is applied", () => {
    const { container } = render(<LitStatement segments={SEGMENTS} />)
    for (const c of container.querySelectorAll<HTMLElement>("[data-char]")) {
      expect(c.style.color).toBe("")
    }
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
