import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { axe } from "vitest-axe"
import { StepDetails } from "./step-details"

const step = {
  id: "design",
  name: "Design",
  summary: "I plan the structure before writing code.",
}

function renderStep(floating: boolean) {
  return render(
    <ol>
      <StepDetails step={step} index={1} count={5} floating={floating} />
    </ol>
  )
}

describe("StepDetails", () => {
  it("is a list item with the step's name as an h3 and its sentence", () => {
    renderStep(false)
    expect(screen.getByRole("listitem")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3, name: "Design" })).toBeInTheDocument()
    expect(screen.getByText(step.summary)).toBeInTheDocument()
  })

  it("shows its number visually but doesn't read it out twice", () => {
    renderStep(false)
    const number = screen.getByText(/02/)
    expect(number.closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true")
  })

  it("in normal flow: sits in the list with a drawing of the paper", () => {
    const { container } = renderStep(false)
    expect(container.querySelector("svg[data-stage='1']")).not.toBeNull()
    expect(screen.getByRole("listitem")).not.toHaveAttribute("data-fold-step")
  })

  it("floating: marked for the scroll to show, with no drawing (the 3D paper is the picture)", () => {
    const { container } = renderStep(true)
    const item = screen.getByRole("listitem")
    expect(item).toHaveAttribute("data-fold-step")
    expect(item.querySelector("[data-fold-title]")).toHaveTextContent("Design")
    expect(item.querySelectorAll("[data-fold-body]")).toHaveLength(2)
    expect(container.querySelector("svg")).toBeNull()
  })

  it("lists the step's notes as tags in normal flow", () => {
    render(
      <ol>
        <StepDetails
          step={step}
          index={0}
          count={5}
          floating={false}
          notes={{ label: "Notes", items: ["who is it for?", "constraints?"] }}
        />
      </ol>
    )
    expect(screen.getByRole("heading", { level: 4, name: "Notes" })).toBeInTheDocument()
    expect(screen.getByText("who is it for?")).toBeVisible()
    expect(screen.getByText("constraints?").closest(".sr-only")).toBeNull()
  })

  it("keeps the notes for screen readers when they're drawn on the 3D paper", () => {
    render(
      <ol>
        <StepDetails
          step={step}
          index={0}
          count={5}
          floating
          notes={{ label: "Notes", items: ["who is it for?"] }}
        />
      </ol>
    )
    expect(screen.getByText("who is it for?").closest(".sr-only")).not.toBeNull()
  })

  it("lets the cursor's light brighten the name", () => {
    renderStep(true)
    expect(screen.getByText("Design")).toHaveAttribute("data-light")
  })

  it("passes axe accessibility audit", async () => {
    const { container } = renderStep(false)
    expect(await axe(container)).toHaveNoViolations()
  })
})
