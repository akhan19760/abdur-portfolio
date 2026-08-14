import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { usePageTitle } from "./use-page-title"

describe("usePageTitle", () => {
  it("sets document.title", () => {
    renderHook(() => usePageTitle("Test Title"))
    expect(document.title).toBe("Test Title")
  })

  it("updates document.title when the title prop changes", () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: "First" },
    })
    expect(document.title).toBe("First")

    rerender({ title: "Second" })
    expect(document.title).toBe("Second")
  })
})
