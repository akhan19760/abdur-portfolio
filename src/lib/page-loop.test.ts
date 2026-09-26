import { describe, expect, it } from "vitest"
import { loopArrival, registerLoop } from "./page-loop"

describe("page-loop", () => {
  it("has no arrival while there's no loop", () => {
    expect(loopArrival()).toBeNull()
  })

  it("asks the registered loop, live, every time", () => {
    let value: number | null = 0.7
    const off = registerLoop(() => value)
    expect(loopArrival()).toBe(0.7)
    value = 0.1
    expect(loopArrival()).toBe(0.1)
    value = null
    expect(loopArrival()).toBeNull()
    off()
  })

  it("forgets the loop once it's removed", () => {
    const off = registerLoop(() => 0.5)
    off()
    expect(loopArrival()).toBeNull()
  })

  it("doesn't let an old loop remove a newer one", () => {
    const offOld = registerLoop(() => 0.9)
    const offNew = registerLoop(() => 0.2)
    offOld()
    expect(loopArrival()).toBe(0.2)
    offNew()
    expect(loopArrival()).toBeNull()
  })
})
