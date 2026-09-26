/**
 * The field's motion and look are verified manually in-browser (canvas
 * animation, per the `testing` skill). jsdom has no 2D canvas, so this only
 * checks the element contract and that it degrades safely.
 */
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { axe } from "vitest-axe"
import { SignalField } from "./signal-field"

describe("SignalField", () => {
  it("renders a canvas", () => {
    const { getByTestId } = render(<SignalField />)
    expect(getByTestId("signal-field").tagName).toBe("CANVAS")
  })

  it("is fixed behind the page and ignores the pointer", () => {
    const { container } = render(<SignalField />)
    expect(container.firstElementChild).toHaveClass(
      "fixed",
      "inset-0",
      "-z-10",
      "pointer-events-none"
    )
  })

  it("is hidden from assistive technology", () => {
    const { container } = render(<SignalField />)
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
  })

  it("renders and unmounts safely without a 2D context", () => {
    const { unmount } = render(<SignalField />)
    expect(() => unmount()).not.toThrow()
  })

  it("passes axe accessibility audit", async () => {
    const { container } = render(<SignalField />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
