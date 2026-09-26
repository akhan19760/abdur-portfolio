/**
 * Only the DOM contract is tested here (which steps are switched off, the
 * reported position, jumps, safe teardown). The timeline itself is verified
 * manually in-browser, per the `testing` skill.
 */
import { render } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import {
  FOLD_HANDOFF,
  PAPER_LANDING,
  STEP_COUNT,
  foldPhases,
  stepAt,
  useFoldScroll,
} from "./use-fold-scroll"

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

type Api = ReturnType<typeof useFoldScroll>

type HarnessProps = {
  enabled: boolean
  onProgress?: (units: number) => void
  onApi?: (api: Api) => void
}

function Harness({ enabled, onProgress, onApi }: HarnessProps) {
  const api = useFoldScroll<HTMLElement>({ enabled, onProgress })
  onApi?.(api)
  return (
    <section ref={api.sectionRef} aria-label="Process">
      <header data-fold-hud data-testid="hud" />
      <ol>
        <li data-fold-step data-testid="step-0">
          <h3 data-fold-title data-testid="title-0">
            Discover
          </h3>
          <p data-fold-body>One</p>
        </li>
        <li data-fold-step data-testid="step-1">
          <h3 data-fold-title>Design</h3>
          <p data-fold-body>
            <a href="#two">Two</a>
          </p>
        </li>
      </ol>
    </section>
  )
}

describe("useFoldScroll", () => {
  it("leaves steps untouched when disabled", () => {
    const { getByTestId } = render(<Harness enabled={false} />)
    expect(getByTestId("step-0")).not.toHaveAttribute("data-light-off")
    expect(getByTestId("step-0").style.opacity).toBe("")
    expect(getByTestId("title-0").style.transform).toBe("")
  })

  it("reads −1 and ignores jumps while disabled", () => {
    let api: Api | null = null
    render(<Harness enabled={false} onApi={(a) => (api = a)} />)
    expect(api!.readUnits()).toBe(-1)
    expect(() => api!.scrollToStep(1)).not.toThrow()
  })

  it("starts with every step and the HUD hidden, titles folded back", () => {
    const { getByTestId } = render(<Harness enabled />)
    expect(getByTestId("step-0")).toHaveAttribute("data-light-off")
    expect(getByTestId("step-1")).toHaveAttribute("data-light-off")
    expect(getByTestId("hud").style.opacity).toBe("0")
    expect(getByTestId("title-0").style.transform).toContain("rotateX(-92deg)")
  })

  it("reports a starting position of 0", () => {
    const onProgress = vi.fn()
    render(<Harness enabled onProgress={onProgress} />)
    expect(onProgress).toHaveBeenCalledWith(0)
  })

  it("reads the live position once enabled", () => {
    let api: Api | null = null
    render(<Harness enabled onApi={(a) => (api = a)} />)
    expect(Number.isFinite(api!.readUnits())).toBe(true)
    expect(api!.readUnits()).not.toBe(-1)
  })

  it("jumps to a step", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    let api: Api | null = null
    render(<Harness enabled onApi={(a) => (api = a)} />)
    api!.scrollToStep(1)
    expect(scrollTo).toHaveBeenCalledOnce()
    api!.scrollToStep(9)
    expect(scrollTo).toHaveBeenCalledOnce()
    scrollTo.mockRestore()
  })

  it("jumps to a hidden step when keyboard focus lands in it", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    const { getByRole } = render(<Harness enabled />)
    getByRole("link", { name: "Two" }).focus()
    expect(scrollTo).toHaveBeenCalledOnce()
    scrollTo.mockRestore()
  })

  it("restores steps when switched from enabled to disabled", () => {
    const { getByTestId, rerender } = render(<Harness enabled />)
    rerender(<Harness enabled={false} />)
    expect(getByTestId("step-0").style.opacity).toBe("")
  })

  it("unmounts without throwing", () => {
    const { unmount } = render(<Harness enabled />)
    expect(() => unmount()).not.toThrow()
  })
})

describe("foldPhases", () => {
  const phases = foldPhases()

  it("has five steps, the first after the sheet lands", () => {
    expect(STEP_COUNT).toBe(5)
    expect(phases.starts).toHaveLength(5)
    expect(phases.handoff).toBe(FOLD_HANDOFF)
    expect(phases.landing).toBe(PAPER_LANDING)
    expect(phases.landing).toBeGreaterThan(phases.handoff)
    expect(phases.starts[0]).toBeGreaterThan(phases.landing)
  })

  it("runs the steps back to back", () => {
    phases.starts.forEach((start, i) => {
      expect(phases.ends[i]).toBeGreaterThan(start)
      if (i > 0) expect(start).toBe(phases.ends[i - 1])
    })
  })

  it("puts each step's jump point inside the step", () => {
    phases.focus.forEach((focus, i) => {
      expect(focus).toBeGreaterThan(phases.starts[i])
      expect(focus).toBeLessThan(phases.ends[i])
    })
  })

  it("gives Build the longest stretch: it has the most folds", () => {
    const lengths = phases.starts.map((s, i) => phases.ends[i] - s)
    expect(Math.max(...lengths)).toBe(lengths[2])
  })

  it("ends after the last step and sizes the section to the whole timeline", () => {
    expect(phases.total).toBeGreaterThan(phases.ends[4])
    expect(phases.sectionVh).toBeGreaterThanOrEqual(phases.total * 100)
    expect(phases.sectionVh - phases.total * 100).toBeLessThan(1)
  })
})

describe("stepAt", () => {
  const phases = foldPhases()

  it("finds the step on stage", () => {
    expect(stepAt(-1, phases)).toBe(0)
    expect(stepAt(phases.starts[0] + 0.1, phases)).toBe(0)
    expect(stepAt(phases.starts[2] + 0.1, phases)).toBe(2)
    expect(stepAt(phases.ends[1], phases)).toBe(2)
    expect(stepAt(phases.total + 3, phases)).toBe(4)
  })
})
