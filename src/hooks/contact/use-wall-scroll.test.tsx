/**
 * Only the DOM contract is tested here (the text switched off until it has
 * faded in, the reported position, keyboard focus, safe teardown). The
 * timeline itself is verified manually in-browser, per the `testing` skill.
 */
import { render } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { WALL_HANDOFF, useWallScroll, wallPhases } from "./use-wall-scroll"

// ScrollTrigger calls matchMedia while registering; jsdom doesn't provide it.
vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

type Api = ReturnType<typeof useWallScroll>

type HarnessProps = {
  enabled: boolean
  onApi?: (api: Api) => void
}

function Harness({ enabled, onApi }: HarnessProps) {
  const api = useWallScroll<HTMLElement>({ enabled })
  onApi?.(api)
  return (
    <section ref={api.sectionRef} aria-label="Contact">
      <header data-wall-hud data-testid="hud">
        <h2>Contact</h2>
      </header>
      <div data-wall-hud data-testid="details">
        <a href="mailto:someone@example.com">someone@example.com</a>
      </div>
    </section>
  )
}

describe("wallPhases", () => {
  it("fades the text in after the handoff has begun, before the page ends", () => {
    const p = wallPhases()
    expect(p.handoff).toBe(WALL_HANDOFF)
    expect(p.hudIn).toBeGreaterThan(0)
    expect(p.hudShown).toBeGreaterThan(p.hudIn)
    expect(p.hudShown).toBeLessThanOrEqual(p.handoff)
    expect(p.total).toBeGreaterThan(p.handoff)
    expect(p.sectionVh).toBe(Math.ceil(p.total * 100))
  })
})

describe("useWallScroll", () => {
  it("leaves the text untouched when disabled", () => {
    const { getByTestId } = render(<Harness enabled={false} />)
    expect(getByTestId("hud")).not.toHaveAttribute("data-light-off")
    expect(getByTestId("hud").style.opacity).toBe("")
  })

  it("reads −1 while disabled", () => {
    let api: Api | null = null
    render(<Harness enabled={false} onApi={(a) => (api = a)} />)
    expect(api!.readUnits()).toBe(-1)
  })

  it("starts with the text faded out and switched off", () => {
    const { getByTestId } = render(<Harness enabled />)
    for (const id of ["hud", "details"]) {
      expect(getByTestId(id).style.opacity).toBe("0")
      expect(getByTestId(id)).toHaveAttribute("data-light-off")
    }
  })

  it("reads the live position once enabled", () => {
    let api: Api | null = null
    render(<Harness enabled onApi={(a) => (api = a)} />)
    expect(Number.isFinite(api!.readUnits())).toBe(true)
    expect(api!.readUnits()).not.toBe(-1)
  })

  it("scrolls to the end when keyboard focus lands in text that isn't showing", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    const { getByRole } = render(<Harness enabled />)
    getByRole("link").focus()
    expect(scrollTo).toHaveBeenCalledOnce()
    scrollTo.mockRestore()
  })

  it("restores the text when switched from enabled to disabled", () => {
    const { getByTestId, rerender } = render(<Harness enabled />)
    rerender(<Harness enabled={false} />)
    expect(getByTestId("hud").style.opacity).toBe("")
  })

  it("unmounts cleanly", () => {
    const { unmount } = render(<Harness enabled />)
    expect(() => unmount()).not.toThrow()
  })
})
