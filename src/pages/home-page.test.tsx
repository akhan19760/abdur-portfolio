import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { axe } from "vitest-axe"
import { HomePage } from "./home-page"

describe("HomePage", () => {
  it("renders the placeholder content", () => {
    render(<HomePage />)
    expect(screen.getByText(/scaffold placeholder/i)).toBeInTheDocument()
  })

  it("has no accessibility violations", async () => {
    const { container } = render(<HomePage />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
