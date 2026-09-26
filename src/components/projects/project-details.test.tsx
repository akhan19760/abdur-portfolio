import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { axe } from "vitest-axe"
import type { Project } from "@/types/projects"
import { ProjectDetails } from "./project-details"

const project: Project = {
  id: "orbit",
  name: "Orbit Studio",
  role: "Lead frontend",
  year: "2025",
  summary: "A booking app for small studios.",
  stack: ["React", "Three.js", "Node"],
  highlights: [
    { id: "orbit-result", text: "40k bookings in the first month" },
    { id: "orbit-owned", text: "Built the design system" },
  ],
  href: "https://example.com/orbit",
}

const labels = {
  stack: "Stack",
  highlights: "Highlights",
  open: "View project",
  newTab: "opens in a new tab",
  placeholder: "Screenshot placeholder",
  screenshotAlt: "Screenshot of Orbit Studio",
}

function setup(overrides: Partial<Parameters<typeof ProjectDetails>[0]> = {}) {
  return render(
    <ProjectDetails
      project={project}
      index={1}
      count={4}
      labels={labels}
      floating={false}
      {...overrides}
    />
  )
}

describe("ProjectDetails", () => {
  it("is an article labelled by the project's h3", () => {
    setup()
    const article = screen.getByRole("article", { name: "Orbit Studio" })
    expect(
      within(article).getByRole("heading", { level: 3, name: "Orbit Studio" })
    ).toBeInTheDocument()
  })

  it("splits the name into words the light can brighten one by one", () => {
    const { container } = setup()
    const words = Array.from(container.querySelectorAll("h3 [data-light]")).map(
      (w) => w.textContent
    )
    expect(words).toEqual(["Orbit", "Studio"])
  })

  it("shows role and year, summary, stack and highlights in plain text", () => {
    setup()
    expect(screen.getByText("Lead frontend · 2025")).toBeInTheDocument()
    expect(screen.getByText(project.summary)).toBeInTheDocument()
    project.stack.forEach((tech) => expect(screen.getByText(tech)).toBeInTheDocument())
    project.highlights.forEach((h) =>
      expect(screen.getByText(h.text)).toBeInTheDocument()
    )
    expect(
      screen.getByRole("heading", { level: 4, name: "Highlights" })
    ).toBeInTheDocument()
  })

  it("links out in a new tab when the project has a link", () => {
    setup()
    const link = screen.getByRole("link", { name: "View project (opens in a new tab)" })
    expect(link).toHaveAttribute("href", project.href)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noreferrer")
  })

  it("shows no link without one", () => {
    setup({ project: { ...project, href: "" } })
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("shows the project's picture beside it in the flat layout", () => {
    setup()
    expect(screen.getByText("Screenshot placeholder")).toBeInTheDocument()
  })

  it("leaves the picture to the sea when floating, and marks itself for the scroll", () => {
    setup({ floating: true })
    expect(screen.getByRole("article")).toHaveAttribute("data-sea-panel")
    expect(screen.queryByText("Screenshot placeholder")).not.toBeInTheDocument()
  })

  it("has no accessibility violations", async () => {
    const { container } = setup()
    expect(await axe(container)).toHaveNoViolations()
  })
})
