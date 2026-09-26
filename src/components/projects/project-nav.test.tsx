import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"
import { ProjectNav } from "./project-nav"

const projects = [
  { id: "a", name: "Orbit" },
  { id: "b", name: "Tidal" },
  { id: "c", name: "Ledger" },
]

function setup(active = 1) {
  const onSelect = vi.fn()
  render(
    <ProjectNav
      projects={projects}
      active={active}
      onSelect={onSelect}
      label="Projects"
    />
  )
  return { onSelect }
}

describe("ProjectNav", () => {
  it("is a labelled navigation listing every project by name, in order", () => {
    setup()
    const nav = screen.getByRole("navigation", { name: "Projects" })
    const buttons = within(nav).getAllByRole("button")
    expect(buttons.map((b) => b.textContent)).toEqual(["Orbit01", "Tidal02", "Ledger03"])
    expect(buttons[0]).toHaveAccessibleName("Orbit")
  })

  it("marks the project on screen", () => {
    setup(1)
    expect(screen.getByRole("button", { name: "Tidal" })).toHaveAttribute(
      "aria-current",
      "true"
    )
    expect(screen.getByRole("button", { name: "Orbit" })).not.toHaveAttribute(
      "aria-current"
    )
  })

  it("jumps to a project on click or keyboard", async () => {
    const user = userEvent.setup()
    const { onSelect } = setup()
    await user.click(screen.getByRole("button", { name: "Ledger" }))
    expect(onSelect).toHaveBeenLastCalledWith(2)
    screen.getByRole("button", { name: "Orbit" }).focus()
    await user.keyboard("{Enter}")
    expect(onSelect).toHaveBeenLastCalledWith(0)
  })

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ProjectNav projects={projects} active={0} onSelect={() => {}} label="Projects" />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
