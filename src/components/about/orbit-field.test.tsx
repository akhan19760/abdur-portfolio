import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { axe } from "vitest-axe"
import { OrbitField } from "./orbit-field"

const SATELLITES = [
  { id: "sat-0", code: "SAT_01", label: "LOCATION", value: "Lahore, Pakistan" },
  { id: "sat-1", code: "SAT_02", label: "LANGUAGES", value: "English · Urdu" },
  { id: "sat-2", code: "SAT_03", label: "FOCUS", value: "Frontend" },
  {
    id: "sat-3",
    code: "SAT_04",
    label: "AVAILABILITY",
    value: "Open to work",
    detail: "Full-time · Remote",
  },
]

const AVAILABILITY = {
  alert: "SIGNAL_OPEN",
  title: "Open to work",
  detail: "Full-time · Remote",
}
const LABELS = {
  caught: "CAUGHT",
  locked: "SIGNAL LOCKED",
  hint: "Hold your light on a satellite",
}
const ALL = SATELLITES.map((s) => s.id)

type Options = {
  caught?: string[]
  animate?: boolean
  showFinale?: boolean
  onCatch?: (id: string) => void
}

function renderField({
  caught = [],
  animate = true,
  showFinale = false,
  onCatch = vi.fn(),
}: Options = {}) {
  return render(
    <OrbitField
      satellites={SATELLITES}
      isCaught={(id) => caught.includes(id)}
      onCatch={onCatch}
      locked={caught.length === SATELLITES.length}
      showFinale={showFinale}
      availability={AVAILABILITY}
      labels={LABELS}
      animate={animate}
    />
  )
}

describe("OrbitField", () => {
  it("names every satellite with its full readout", () => {
    renderField()
    expect(
      screen.getByRole("button", { name: "LOCATION: Lahore, Pakistan" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "AVAILABILITY: Open to work, Full-time · Remote",
      })
    ).toBeInTheDocument()
  })

  it("puts loose satellites on orbits, chargeable by the light", () => {
    renderField({ caught: ["sat-1"] })
    const [first, second] = screen.getAllByRole("button")
    expect(first).toHaveAttribute("data-orbit-index", "0")
    expect(first).toHaveAttribute("data-charge")
    expect(second).toHaveAttribute("data-caught")
    expect(second).not.toHaveAttribute("data-charge")
  })

  it("catches a satellite on click", async () => {
    const user = userEvent.setup()
    const onCatch = vi.fn()
    renderField({ onCatch })
    await user.click(screen.getByRole("button", { name: /FOCUS/ }))
    expect(onCatch).toHaveBeenCalledWith("sat-2")
  })

  it("catches a satellite on keyboard focus", async () => {
    const user = userEvent.setup()
    const onCatch = vi.fn()
    renderField({ onCatch })
    await user.tab()
    expect(onCatch).toHaveBeenCalledWith("sat-0")
  })

  it("counts caught satellites with a hint, then locks", () => {
    const { unmount } = renderField({ caught: ["sat-0"] })
    expect(screen.getByText("CAUGHT 01/04")).toBeInTheDocument()
    expect(screen.getByText(LABELS.hint)).toBeInTheDocument()
    unmount()
    renderField({ caught: ALL })
    expect(screen.getByText("SIGNAL LOCKED")).toBeInTheDocument()
  })

  it("keeps the finale hidden until it's shown", () => {
    const { container, rerender } = renderField()
    expect(container.textContent).not.toContain("SIGNAL_OPEN")
    rerender(
      <OrbitField
        satellites={SATELLITES}
        isCaught={() => true}
        onCatch={vi.fn()}
        locked
        showFinale
        availability={AVAILABILITY}
        labels={LABELS}
        animate
      />
    )
    expect(container.textContent).toContain("SIGNAL_OPEN")
  })

  it("hides the finale from assistive tech (the satellite carries it)", () => {
    const { container } = renderField({ caught: ALL, showFinale: true })
    const alert = Array.from(container.querySelectorAll("p")).find((p) =>
      p.textContent?.includes("SIGNAL_OPEN")
    )
    expect(alert?.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it("shows a static grid with every readout and the finale when not animated", () => {
    const { container } = renderField({ animate: false, caught: ALL })
    expect(screen.getAllByRole("button")[0]).not.toHaveAttribute("data-orbit-index")
    expect(container.textContent).toContain("SIGNAL_OPEN")
  })

  it("passes axe accessibility audit", async () => {
    const { container } = renderField({ caught: ["sat-0"], showFinale: true })
    expect(await axe(container)).toHaveNoViolations()
  })
})
