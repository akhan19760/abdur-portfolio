/**
 * The FX canvas's drawing is verified manually in-browser (canvas animation,
 * per the `testing` skill). jsdom has no 2D canvas, so this checks the
 * element contract and that it degrades safely.
 */
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { axe } from "vitest-axe"
import { AboutFx } from "./about-fx"

describe("AboutFx", () => {
  it("renders a canvas covering the stage without taking the pointer", () => {
    const { getByTestId } = render(<AboutFx />)
    const canvas = getByTestId("about-fx")
    expect(canvas.tagName).toBe("CANVAS")
    expect(canvas).toHaveClass("pointer-events-none", "absolute", "inset-0")
  })

  it("is hidden from assistive technology", () => {
    const { getByTestId } = render(<AboutFx />)
    expect(getByTestId("about-fx")).toHaveAttribute("aria-hidden", "true")
  })

  it("renders and unmounts safely without a 2D context", () => {
    const { unmount } = render(<AboutFx />)
    expect(() => unmount()).not.toThrow()
  })

  it("passes axe accessibility audit", async () => {
    const { container } = render(<AboutFx />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
