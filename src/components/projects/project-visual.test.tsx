import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { axe } from "vitest-axe"
import { ProjectVisual } from "./project-visual"

describe("ProjectVisual", () => {
  it("shows a decorative placeholder with the project's name until there's a screenshot", () => {
    const { container } = render(
      <ProjectVisual
        project={{ name: "Orbit" }}
        placeholderLabel="Screenshot placeholder"
        alt="Screenshot of Orbit"
      />
    )
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByText("Orbit")).toBeInTheDocument()
    expect(screen.getByText("Screenshot placeholder")).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("shows the screenshot with alt text once there is one", () => {
    render(
      <ProjectVisual
        project={{ name: "Orbit", image: "/projects/orbit.jpg" }}
        placeholderLabel="Screenshot placeholder"
        alt="Screenshot of Orbit"
      />
    )
    const img = screen.getByRole("img", { name: "Screenshot of Orbit" })
    expect(img).toHaveAttribute("src", "/projects/orbit.jpg")
    expect(img).toHaveAttribute("loading", "lazy")
  })

  it("has no accessibility violations either way", async () => {
    const { container, rerender } = render(
      <ProjectVisual
        project={{ name: "Orbit" }}
        placeholderLabel="Placeholder"
        alt="Screenshot of Orbit"
      />
    )
    expect(await axe(container)).toHaveNoViolations()
    rerender(
      <ProjectVisual
        project={{ name: "Orbit", image: "/o.jpg" }}
        placeholderLabel="Placeholder"
        alt="Screenshot of Orbit"
      />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
