import { render } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { SCRAMBLE_GLYPHS, scrambleText, useScramble } from "./use-scramble"

describe("scrambleText", () => {
  it("keeps the length", () => {
    expect(scrambleText("Frontend Developer")).toHaveLength("Frontend Developer".length)
  })

  it("keeps whitespace in place so the text wraps identically", () => {
    const out = scrambleText("ab cd\tef")
    expect(out[2]).toBe(" ")
    expect(out[5]).toBe("\t")
  })

  it("only uses the scramble glyphs for other characters", () => {
    for (const ch of scrambleText("Hello, world! 2026")) {
      if (ch !== " ") expect(SCRAMBLE_GLYPHS).toContain(ch)
    }
  })

  it("uses the injected random source", () => {
    expect(scrambleText("abc", () => 0)).toBe(SCRAMBLE_GLYPHS[0].repeat(3))
  })

  it("handles empty text", () => {
    expect(scrambleText("")).toBe("")
  })
})

function Harness({ text, active }: { text: string; active: boolean }) {
  const { containerRef } = useScramble<HTMLDivElement>({ active })
  return (
    <div ref={containerRef}>
      <span data-testid="target" data-scramble={text} />
    </div>
  )
}

describe("useScramble", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("fills targets with scrambled text of the same length on first paint", () => {
    const { getByTestId } = render(<Harness text="Senior dev" active={false} />)
    const text = getByTestId("target").textContent ?? ""
    expect(text).toHaveLength("Senior dev".length)
    expect(text[6]).toBe(" ")
  })

  it("refills when the original text changes", () => {
    const { getByTestId, rerender } = render(<Harness text="abc" active={false} />)
    rerender(<Harness text="abcdefgh" active={false} />)
    expect(getByTestId("target").textContent).toHaveLength(8)
  })

  it("keeps re-scrambling while active", () => {
    vi.useFakeTimers()
    const random = vi.spyOn(Math, "random")
    render(<Harness text="abcdefghijkl" active />)
    const calls = random.mock.calls.length
    vi.advanceTimersByTime(300)
    expect(random.mock.calls.length).toBeGreaterThan(calls)
  })

  it("stops cycling when inactive", () => {
    vi.useFakeTimers()
    const { getByTestId } = render(<Harness text="abcdefghijkl" active={false} />)
    const before = getByTestId("target").textContent
    vi.advanceTimersByTime(300)
    expect(getByTestId("target").textContent).toBe(before)
  })

  it("unmounts without throwing", () => {
    const { unmount } = render(<Harness text="abc" active />)
    expect(() => unmount()).not.toThrow()
  })
})
