/**
 * Only the DOM contract is tested here (which layers are switched off, safe
 * teardown). The scroll timing itself is verified manually in-browser, per
 * the `testing` skill.
 */
import { render } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import {
  DEPTH_UNIT_VH,
  HANDOFF_VH,
  depthPhases,
  useDepthScroll,
} from "./use-depth-scroll"

// ScrollTrigger calls matchMedia while registering; jsdom doesn't provide it.
// vi.hoisted runs before the imports above are evaluated.
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

type HarnessProps = { enabled: boolean; onProgress?: (p: number) => void }

function Harness({ enabled, onProgress }: HarnessProps) {
  const { sectionRef } = useDepthScroll<HTMLElement>({ enabled, onProgress })
  return (
    <section ref={sectionRef} aria-label="Depth">
      <div data-depth-layer data-testid="layer-0">
        <button type="button">One</button>
      </div>
      <div data-depth-layer data-testid="layer-1">
        <button type="button">Two</button>
      </div>
      <div data-depth-layer data-testid="layer-2" />
    </section>
  )
}

describe("useDepthScroll", () => {
  it("leaves layers untouched when disabled", () => {
    const { getByTestId } = render(<Harness enabled={false} />)
    expect(getByTestId("layer-1")).not.toHaveAttribute("data-light-off")
    expect(getByTestId("layer-1").style.opacity).toBe("")
  })

  it("starts with every layer switched off, waiting in the depth", () => {
    const { getByTestId } = render(<Harness enabled />)
    expect(getByTestId("layer-0")).toHaveAttribute("data-light-off")
    expect(getByTestId("layer-1")).toHaveAttribute("data-light-off")
    expect(getByTestId("layer-2")).toHaveAttribute("data-light-off")
  })

  it("reports starting progress of 0", () => {
    const onProgress = vi.fn()
    render(<Harness enabled onProgress={onProgress} />)
    expect(onProgress).toHaveBeenCalledWith(0)
  })

  it("restores layers when switched from enabled to disabled", () => {
    const { getByTestId, rerender } = render(<Harness enabled />)
    rerender(<Harness enabled={false} />)
    expect(getByTestId("layer-1").style.opacity).toBe("")
  })

  it("unmounts without throwing", () => {
    const { unmount } = render(<Harness enabled />)
    expect(() => unmount()).not.toThrow()
  })
})

describe("depthPhases", () => {
  it("spans the Hero handoff with the intro", () => {
    expect(depthPhases(4).intro * DEPTH_UNIT_VH).toBeCloseTo(HANDOFF_VH)
  })

  it("keeps a quiet stretch at the start of the handoff before anything shows", () => {
    const { intro, quietUntil } = depthPhases(4)
    expect(quietUntil).toBeGreaterThan(0)
    expect(quietUntil).toBeLessThan(intro)
  })

  it("lands the first layer after the Hero has gone", () => {
    const { intro, arrivals } = depthPhases(4)
    expect(arrivals[0]).toBeGreaterThan(intro)
  })

  it("spaces arrivals evenly and in order", () => {
    const { arrivals } = depthPhases(4)
    const gaps = arrivals.slice(1).map((a, i) => a - arrivals[i])
    gaps.forEach((g) => expect(g).toBeCloseTo(gaps[0]))
    expect(gaps[0]).toBeGreaterThan(0)
  })

  it("starts the tail after the last arrival and ends the timeline after it", () => {
    const { arrivals, tailStart, total } = depthPhases(4)
    expect(tailStart).toBeGreaterThan(arrivals[3])
    expect(total).toBeGreaterThan(tailStart)
  })

  it("sizes the section so its scroll distance covers the whole timeline", () => {
    const { total, sectionVh } = depthPhases(4)
    expect(sectionVh - 100).toBeGreaterThanOrEqual(total * DEPTH_UNIT_VH)
    expect(sectionVh - 100 - total * DEPTH_UNIT_VH).toBeLessThan(1)
  })

  it("holds each layer from its arrival until its departure", () => {
    const { arrivals, holds } = depthPhases(4)
    holds.forEach(([start, end], i) => {
      expect(start).toBe(arrivals[i])
      expect(end).toBeGreaterThan(start)
      if (i < 3) expect(end).toBeLessThan(arrivals[i + 1])
    })
  })

  it("handles zero layers", () => {
    expect(depthPhases(0).arrivals).toEqual([])
  })
})
