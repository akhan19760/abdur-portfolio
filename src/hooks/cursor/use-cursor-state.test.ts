import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, afterEach } from "vitest"
import { useCursorState } from "./use-cursor-state"

// ── helpers ──────────────────────────────────────────────────────────────────

/** Fire a MouseEvent on a target, bubbling through the document. */
function fire(target: EventTarget, type: string, init: MouseEventInit = {}): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init }))
}

// ── isHovering ────────────────────────────────────────────────────────────────

describe("useCursorState — isHovering", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("is false initially", () => {
    const { result } = renderHook(() => useCursorState())
    expect(result.current.isHovering).toBe(false)
  })

  it("becomes true when mousing over a <button>", () => {
    const btn = document.createElement("button")
    document.body.appendChild(btn)

    const { result } = renderHook(() => useCursorState())

    act(() => {
      fire(btn, "mouseover", { relatedTarget: document.body })
    })

    expect(result.current.isHovering).toBe(true)
  })

  it("becomes true when mousing over an <a>", () => {
    const a = document.createElement("a")
    document.body.appendChild(a)

    const { result } = renderHook(() => useCursorState())

    act(() => {
      fire(a, "mouseover", { relatedTarget: document.body })
    })

    expect(result.current.isHovering).toBe(true)
  })

  it("becomes true when mousing over a [role='button'] element", () => {
    const div = document.createElement("div")
    div.setAttribute("role", "button")
    document.body.appendChild(div)

    const { result } = renderHook(() => useCursorState())

    act(() => {
      fire(div, "mouseover", { relatedTarget: document.body })
    })

    expect(result.current.isHovering).toBe(true)
  })

  it("becomes true for [data-cursor-hover] elements", () => {
    const div = document.createElement("div")
    div.setAttribute("data-cursor-hover", "")
    document.body.appendChild(div)

    const { result } = renderHook(() => useCursorState())

    act(() => {
      fire(div, "mouseover", { relatedTarget: document.body })
    })

    expect(result.current.isHovering).toBe(true)
  })

  it("becomes true for a child nested inside a <button>", () => {
    const btn = document.createElement("button")
    const span = document.createElement("span")
    btn.appendChild(span)
    document.body.appendChild(btn)

    const { result } = renderHook(() => useCursorState())

    act(() => {
      fire(span, "mouseover", { relatedTarget: document.body })
    })

    expect(result.current.isHovering).toBe(true)
  })

  it("becomes false on mouseout to a non-interactive target", () => {
    const btn = document.createElement("button")
    document.body.appendChild(btn)

    const { result } = renderHook(() => useCursorState())

    act(() => {
      fire(btn, "mouseover", { relatedTarget: document.body })
    })
    expect(result.current.isHovering).toBe(true)

    act(() => {
      fire(btn, "mouseout", { relatedTarget: document.body })
    })
    expect(result.current.isHovering).toBe(false)
  })

  it("stays false when mousing over a plain <div>", () => {
    const div = document.createElement("div")
    document.body.appendChild(div)

    const { result } = renderHook(() => useCursorState())

    act(() => {
      fire(div, "mouseover", { relatedTarget: document.body })
    })

    expect(result.current.isHovering).toBe(false)
  })
})

// ── isPressed ─────────────────────────────────────────────────────────────────

describe("useCursorState — isPressed", () => {
  it("is false initially", () => {
    const { result } = renderHook(() => useCursorState())
    expect(result.current.isPressed).toBe(false)
  })

  it("becomes true on mousedown", () => {
    const { result } = renderHook(() => useCursorState())

    act(() => {
      fire(document, "mousedown")
    })

    expect(result.current.isPressed).toBe(true)
  })

  it("becomes false on mouseup after mousedown", () => {
    const { result } = renderHook(() => useCursorState())

    act(() => {
      fire(document, "mousedown")
    })
    act(() => {
      fire(document, "mouseup")
    })

    expect(result.current.isPressed).toBe(false)
  })
})

// ── isVisible ─────────────────────────────────────────────────────────────────

describe("useCursorState — isVisible", () => {
  it("is false initially", () => {
    const { result } = renderHook(() => useCursorState())
    expect(result.current.isVisible).toBe(false)
  })

  it("becomes true on mouseenter of documentElement", () => {
    const { result } = renderHook(() => useCursorState())

    act(() => {
      document.documentElement.dispatchEvent(
        new MouseEvent("mouseenter", { bubbles: false })
      )
    })

    expect(result.current.isVisible).toBe(true)
  })

  it("becomes false on mouseleave of documentElement", () => {
    const { result } = renderHook(() => useCursorState())

    act(() => {
      document.documentElement.dispatchEvent(
        new MouseEvent("mouseenter", { bubbles: false })
      )
    })
    act(() => {
      document.documentElement.dispatchEvent(
        new MouseEvent("mouseleave", { bubbles: false })
      )
    })

    expect(result.current.isVisible).toBe(false)
  })

  it("clears isHovering and isPressed when cursor leaves the viewport", () => {
    const btn = document.createElement("button")
    document.body.appendChild(btn)

    const { result } = renderHook(() => useCursorState())

    act(() => {
      document.documentElement.dispatchEvent(
        new MouseEvent("mouseenter", { bubbles: false })
      )
      fire(btn, "mouseover", { relatedTarget: document.body })
      fire(document, "mousedown")
    })

    expect(result.current.isVisible).toBe(true)
    expect(result.current.isHovering).toBe(true)
    expect(result.current.isPressed).toBe(true)

    act(() => {
      document.documentElement.dispatchEvent(
        new MouseEvent("mouseleave", { bubbles: false })
      )
    })

    expect(result.current.isVisible).toBe(false)
    expect(result.current.isHovering).toBe(false)
    expect(result.current.isPressed).toBe(false)

    document.body.removeChild(btn)
  })
})

// ── cleanup ───────────────────────────────────────────────────────────────────

describe("useCursorState — cleanup", () => {
  it("removes all listeners on unmount without throwing", () => {
    const { unmount } = renderHook(() => useCursorState())
    expect(() => unmount()).not.toThrow()
  })
})
