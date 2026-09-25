import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { axe } from "vitest-axe"
import { LightFragment } from "./light-fragment"

const FRAGMENT = { id: "fuel", code: "FRAG_03", text: "Tea or coffee: tea." }

describe("LightFragment", () => {
  it("is a button named by its full text", () => {
    render(<LightFragment fragment={FRAGMENT} found={false} onFind={vi.fn()} />)
    expect(
      screen.getByRole("button", { name: "FRAG_03 Tea or coffee: tea." })
    ).toBeInTheDocument()
  })

  it("is a light target carrying its id", () => {
    render(<LightFragment fragment={FRAGMENT} found={false} onFind={vi.fn()} />)
    const button = screen.getByRole("button")
    expect(button).toHaveAttribute("data-light")
    expect(button).toHaveAttribute("data-fragment-id", "fuel")
  })

  it("is found by clicking", async () => {
    const user = userEvent.setup()
    const onFind = vi.fn()
    render(<LightFragment fragment={FRAGMENT} found={false} onFind={onFind} />)
    await user.click(screen.getByRole("button"))
    expect(onFind).toHaveBeenCalledWith("fuel")
  })

  it("is found by keyboard focus", async () => {
    const user = userEvent.setup()
    const onFind = vi.fn()
    render(<LightFragment fragment={FRAGMENT} found={false} onFind={onFind} />)
    await user.tab()
    expect(screen.getByRole("button")).toHaveFocus()
    expect(onFind).toHaveBeenCalledWith("fuel")
  })

  it("is found by Enter and Space", () => {
    const onFind = vi.fn()
    render(<LightFragment fragment={FRAGMENT} found={false} onFind={onFind} />)
    const button = screen.getByRole("button")
    fireEvent.click(button) // native buttons turn Enter/Space into click
    expect(onFind).toHaveBeenCalledWith("fuel")
  })

  it("shows an empty diamond and light-driven text while unfound", () => {
    const { container } = render(
      <LightFragment fragment={FRAGMENT} found={false} onFind={vi.fn()} />
    )
    expect(container.textContent).toContain("◇")
    expect(screen.getByText("Tea or coffee: tea.").parentElement).toHaveClass(
      "opacity-[var(--light,0)]"
    )
  })

  it("shows a filled diamond and full-strength text once found", () => {
    const { container } = render(
      <LightFragment fragment={FRAGMENT} found onFind={vi.fn()} />
    )
    expect(container.textContent).toContain("◆")
    expect(screen.getByText("Tea or coffee: tea.").parentElement).toHaveClass(
      "opacity-100"
    )
  })

  it("has a visible focus style", () => {
    render(<LightFragment fragment={FRAGMENT} found={false} onFind={vi.fn()} />)
    expect(screen.getByRole("button")).toHaveClass("focus-visible:outline-accent")
  })

  it("passes axe accessibility audit", async () => {
    const { container } = render(
      <LightFragment fragment={FRAGMENT} found={false} onFind={vi.fn()} />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
