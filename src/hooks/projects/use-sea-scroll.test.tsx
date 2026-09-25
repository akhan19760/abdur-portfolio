/**
 * Only the DOM contract is tested here (which panels are switched off, the
 * reported position, safe teardown). The glide itself is verified manually
 * in-browser, per the `testing` skill.
 */
import { render } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { SEA_HANDOFF, projectMidpoint, seaPhases, useSeaScroll } from "./use-sea-scroll"

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

type Api = ReturnType<typeof useSeaScroll>

type HarnessProps = {
  enabled: boolean
  onProgress?: (units: number) => void
  onApi?: (api: Api) => void
}

function Harness({ enabled, onProgress, onApi }: HarnessProps) {
  const api = useSeaScroll<HTMLElement>({ enabled, onProgress })
  onApi?.(api)
  return (
    <section ref={api.sectionRef} aria-label="Work">
      <header data-sea-hud data-testid="hud" />
      <article data-sea-panel data-testid="panel-0">
        <a href="#one">One</a>
      </article>
      <article data-sea-panel data-testid="panel-1">
        <a href="#two">Two</a>
      </article>
    </section>
  )
}

describe("useSeaScroll", () => {
  it("leaves panels untouched when disabled", () => {
    const { getByTestId } = render(<Harness enabled={false} />)
    expect(getByTestId("panel-0")).not.toHaveAttribute("data-light-off")
    expect(getByTestId("panel-0").style.opacity).toBe("")
  })

  it("reads −1 and ignores jumps while disabled", () => {
    let api: Api | null = null
    render(<Harness enabled={false} onApi={(a) => (api = a)} />)
    expect(api!.readUnits()).toBe(-1)
    expect(() => api!.scrollToProject(1)).not.toThrow()
  })

  it("starts with every panel and the HUD hidden", () => {
    const { getByTestId } = render(<Harness enabled />)
    expect(getByTestId("panel-0")).toHaveAttribute("data-light-off")
    expect(getByTestId("panel-1")).toHaveAttribute("data-light-off")
    expect(getByTestId("hud").style.opacity).toBe("0")
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

  it("jumps to a project", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    let api: Api | null = null
    render(<Harness enabled onApi={(a) => (api = a)} />)
    api!.scrollToProject(1)
    expect(scrollTo).toHaveBeenCalledOnce()
    scrollTo.mockRestore()
  })

  it("restores panels when switched from enabled to disabled", () => {
    const { getByTestId, rerender } = render(<Harness enabled />)
    rerender(<Harness enabled={false} />)
    expect(getByTestId("panel-0").style.opacity).toBe("")
  })

  it("unmounts without throwing", () => {
    const { unmount } = render(<Harness enabled />)
    expect(() => unmount()).not.toThrow()
  })
})

describe("seaPhases", () => {
  it("raises the first project after the handoff", () => {
    const { handoff, riseStarts, arrivals } = seaPhases(4)
    expect(handoff).toBe(SEA_HANDOFF)
    expect(riseStarts[0]).toBeGreaterThanOrEqual(handoff)
    expect(arrivals[0]).toBeGreaterThan(riseStarts[0])
  })

  it("rises, holds, then glides on, project after project", () => {
    const { riseStarts, arrivals, holdEnds } = seaPhases(4)
    arrivals.forEach((arrival, i) => {
      expect(riseStarts[i]).toBeLessThan(arrival)
      expect(holdEnds[i]).toBeGreaterThan(arrival)
      if (i > 0) expect(riseStarts[i]).toBeGreaterThan(holdEnds[i - 1])
    })
  })

  it("raises the next screen during the glide toward it", () => {
    const { holdEnds, riseStarts, arrivals } = seaPhases(2)
    expect(riseStarts[1]).toBeGreaterThan(holdEnds[0])
    expect(riseStarts[1]).toBeLessThan(arrivals[1])
  })

  it("spaces projects evenly", () => {
    const { arrivals } = seaPhases(4)
    const gaps = arrivals.slice(1).map((a, i) => a - arrivals[i])
    gaps.forEach((g) => expect(g).toBeCloseTo(gaps[0]))
  })

  it("puts each project's midpoint inside its reading time", () => {
    const phases = seaPhases(4)
    phases.arrivals.forEach((arrival, i) => {
      expect(projectMidpoint(phases, i)).toBeGreaterThan(arrival)
      expect(projectMidpoint(phases, i)).toBeLessThan(phases.holdEnds[i])
    })
  })

  it("ends after the last hold and sizes the section to the whole timeline", () => {
    const { holdEnds, total, sectionVh } = seaPhases(4)
    expect(total).toBeGreaterThan(holdEnds[3])
    expect(sectionVh).toBeGreaterThanOrEqual(total * 100)
    expect(sectionVh - total * 100).toBeLessThan(1)
  })

  it("handles zero projects", () => {
    const phases = seaPhases(0)
    expect(phases.arrivals).toEqual([])
    expect(phases.total).toBeGreaterThan(phases.handoff)
  })
})
