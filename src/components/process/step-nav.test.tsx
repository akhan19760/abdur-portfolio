import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"
import { StepNav } from "./step-nav"

const steps = ["Discover", "Design", "Build", "Refine", "Launch"].map((name) => ({
  id: name.toLowerCase(),
  name,
}))

describe("StepNav", () => {
  it("lists every step by name, in order, as buttons", () => {
    render(<StepNav steps={steps} active={0} onSelect={() => {}} label="Steps" />)
    const nav = screen.getByRole("navigation", { name: "Steps" })
    const buttons = within(nav).getAllByRole("button")
    expect(buttons.map((b) => b.textContent)).toEqual(
      steps.map((s, i) => `0${i + 1}${s.name}`)
    )
    // The numbers are decoration; the names are the buttons' names
    expect(buttons[2]).toHaveAccessibleName("Build")
  })

  it("marks the step on stage", () => {
    render(<StepNav steps={steps} active={2} onSelect={() => {}} label="Steps" />)
    expect(screen.getByRole("button", { name: "Build" })).toHaveAttribute(
      "aria-current",
      "step"
    )
    expect(screen.getByRole("button", { name: "Design" })).not.toHaveAttribute(
      "aria-current"
    )
  })

  it("jumps to a step when clicked or chosen with the keyboard", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<StepNav steps={steps} active={0} onSelect={onSelect} label="Steps" />)
    await user.click(screen.getByRole("button", { name: "Refine" }))
    expect(onSelect).toHaveBeenLastCalledWith(3)
    screen.getByRole("button", { name: "Launch" }).focus()
    await user.keyboard("{Enter}")
    expect(onSelect).toHaveBeenLastCalledWith(4)
  })

  it("passes axe accessibility audit", async () => {
    const { container } = render(
      <StepNav steps={steps} active={1} onSelect={() => {}} label="Steps" />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
