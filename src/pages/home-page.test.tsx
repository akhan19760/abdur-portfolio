import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { axe } from "vitest-axe"
import { HomePage } from "./home-page"

describe("HomePage", () => {
  it("renders the scroll-test section blocks", () => {
    render(<HomePage />)
    expect(screen.getByText("Hero")).toBeInTheDocument()
    expect(screen.getByText("Work")).toBeInTheDocument()
    expect(screen.getByText("Contact")).toBeInTheDocument()
  })

  it("has no accessibility violations", async () => {
    const { container } = render(<HomePage />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
