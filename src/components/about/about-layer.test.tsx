import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { axe } from "vitest-axe"
import { AboutLayer } from "./about-layer"

function renderLayer(depth: boolean) {
  return render(
    <AboutLayer
      index="02"
      title="Origin"
      depth={depth}
      contentClassName="max-w-2xl"
      fragments={<button type="button">Fragment</button>}
    >
      <p>Body copy</p>
    </AboutLayer>
  )
}

describe("AboutLayer", () => {
  it("renders an h3 named by its title", () => {
    renderLayer(false)
    expect(screen.getByRole("heading", { level: 3, name: "Origin" })).toBeInTheDocument()
  })

  it("shows the layer number visually but hides it from screen readers", () => {
    renderLayer(false)
    expect(screen.getByText("02 /")).toHaveAttribute("aria-hidden", "true")
  })

  it("renders its children and fragments", () => {
    renderLayer(false)
    expect(screen.getByText("Body copy")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Fragment" })).toBeInTheDocument()
  })

  it("is marked as a depth layer", () => {
    const { container } = renderLayer(true)
    expect(container.firstElementChild).toHaveAttribute("data-depth-layer")
  })

  it("fills the stage and only lets its buttons take the pointer, in depth mode", () => {
    const { container } = renderLayer(true)
    expect(container.firstElementChild).toHaveClass(
      "absolute",
      "inset-0",
      "pointer-events-none",
      "[&_button]:pointer-events-auto",
      "data-[light-off]:[&_button]:pointer-events-none"
    )
  })

  it("applies titleClassName to the h3", () => {
    render(
      <AboutLayer index="04" title="Status" depth titleClassName="absolute top-0">
        <p>Body</p>
      </AboutLayer>
    )
    expect(screen.getByRole("heading", { level: 3 })).toHaveClass("absolute", "top-0")
  })

  it("stays in normal flow with fragments in a row, in flat mode", () => {
    const { container } = renderLayer(false)
    expect(container.firstElementChild).toHaveClass("relative")
    expect(screen.getByRole("button").parentElement).toHaveClass("flex-wrap")
  })

  it("applies contentClassName to the content column", () => {
    renderLayer(false)
    expect(screen.getByText("Body copy").parentElement).toHaveClass("max-w-2xl")
  })

  it("passes axe accessibility audit", async () => {
    const { container } = render(
      <section aria-label="About">
        <h2>About</h2>
        <AboutLayer index="01" title="Signal" depth={false}>
          <p>Body copy</p>
        </AboutLayer>
      </section>
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
