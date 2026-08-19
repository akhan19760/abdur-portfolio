import { useEffect, useState } from "react"
import type { CursorState } from "@/types/cursor"

export type { CursorState }

/**
 * Selector covering all elements that should trigger the "hovering" cursor
 * state. `[data-cursor-hover]` is the opt-in escape hatch for non-semantic
 * elements (e.g. clickable cards) that sections want treated as interactive.
 */
const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], input, textarea, select, label, [data-cursor-hover]'

/**
 * Tracks semantic cursor states: whether the cursor is hovering an interactive
 * element, whether a mouse button is currently pressed, and whether the cursor
 * is inside the viewport. The CustomCursor component consumes this to vary its
 * size, shape, and glow intensity.
 *
 * State is derived from document-level event listeners — no per-element wiring
 * is required. Uses `closest()` for hover detection so nested children of
 * interactive elements are correctly included.
 *
 * Purely an output hook — cursor state drives a visual effect only and never
 * gates content or blocks keyboard / screen-reader access.
 */
export function useCursorState(): CursorState {
  const [state, setState] = useState<CursorState>({
    isHovering: false,
    isPressed: false,
    isVisible: false,
  })

  useEffect(() => {
    function onMouseOver(event: MouseEvent) {
      const target = event.target as Element | null
      const hovering = !!target?.closest(INTERACTIVE_SELECTOR)
      setState((prev) =>
        prev.isHovering === hovering ? prev : { ...prev, isHovering: hovering }
      )
    }

    function onMouseOut(event: MouseEvent) {
      // Only clear hover when the cursor is not moving into a child of the
      // same interactive element (relatedTarget still inside the same ancestor).
      const related = event.relatedTarget as Element | null
      const stillHovering = !!related?.closest(INTERACTIVE_SELECTOR)
      setState((prev) =>
        prev.isHovering === stillHovering
          ? prev
          : { ...prev, isHovering: stillHovering }
      )
    }

    function onMouseDown() {
      setState((prev) => (prev.isPressed ? prev : { ...prev, isPressed: true }))
    }

    function onMouseUp() {
      setState((prev) => (prev.isPressed ? { ...prev, isPressed: false } : prev))
    }

    function onMouseEnter() {
      setState((prev) => (prev.isVisible ? prev : { ...prev, isVisible: true }))
    }

    function onMouseLeave() {
      setState((prev) =>
        prev.isVisible ? { ...prev, isVisible: false, isHovering: false, isPressed: false } : prev
      )
    }

    document.addEventListener("mouseover", onMouseOver)
    document.addEventListener("mouseout", onMouseOut)
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("mouseup", onMouseUp)
    document.documentElement.addEventListener("mouseenter", onMouseEnter)
    document.documentElement.addEventListener("mouseleave", onMouseLeave)

    return () => {
      document.removeEventListener("mouseover", onMouseOver)
      document.removeEventListener("mouseout", onMouseOut)
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("mouseup", onMouseUp)
      document.documentElement.removeEventListener("mouseenter", onMouseEnter)
      document.documentElement.removeEventListener("mouseleave", onMouseLeave)
    }
  }, [])

  return state
}
