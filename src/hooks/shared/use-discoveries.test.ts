import { act, renderHook } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { useDiscoveries } from "./use-discoveries"

const IDS = ["a", "b", "c"] as const

describe("useDiscoveries", () => {
  it("starts with nothing found", () => {
    const { result } = renderHook(() => useDiscoveries(IDS))
    expect(result.current.foundCount).toBe(0)
    expect(result.current.total).toBe(3)
    expect(result.current.allFound).toBe(false)
    expect(result.current.isFound("a")).toBe(false)
  })

  it("can start with everything found", () => {
    const { result } = renderHook(() => useDiscoveries(IDS, { initiallyFound: true }))
    expect(result.current.foundCount).toBe(3)
    expect(result.current.allFound).toBe(true)
  })

  it("marks an item as found", () => {
    const { result } = renderHook(() => useDiscoveries(IDS))
    act(() => result.current.markFound("b"))
    expect(result.current.isFound("b")).toBe(true)
    expect(result.current.foundCount).toBe(1)
  })

  it("counts each item only once", () => {
    const { result } = renderHook(() => useDiscoveries(IDS))
    act(() => {
      result.current.markFound("a")
      result.current.markFound("a")
    })
    expect(result.current.foundCount).toBe(1)
  })

  it("ignores unknown ids", () => {
    const { result } = renderHook(() => useDiscoveries(IDS))
    act(() => result.current.markFound("zzz"))
    expect(result.current.foundCount).toBe(0)
  })

  it("marks everything at once", () => {
    const { result } = renderHook(() => useDiscoveries(IDS))
    act(() => result.current.markAll())
    expect(result.current.allFound).toBe(true)
  })

  it("reports allFound once every item is found", () => {
    const { result } = renderHook(() => useDiscoveries(IDS))
    act(() => IDS.forEach((id) => result.current.markFound(id)))
    expect(result.current.allFound).toBe(true)
  })

  it("is never allFound with no items", () => {
    const { result } = renderHook(() => useDiscoveries([]))
    expect(result.current.allFound).toBe(false)
  })

  it("unmounts without throwing", () => {
    const { unmount } = renderHook(() => useDiscoveries(IDS))
    expect(() => unmount()).not.toThrow()
  })
})
