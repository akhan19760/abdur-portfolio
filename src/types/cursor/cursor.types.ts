export interface Point {
  x: number
  y: number
}

export interface CursorPosition {
  /** Actual mouse coordinates, updated on every mousemove event. */
  raw: Point
  /** Smoothed coordinates that ease toward `raw`, producing a trailing-lag effect. */
  lerp: Point
}

export interface CursorState {
  /** True while the cursor is over an interactive element (a, button, [role="button"],
   *  input, textarea, select, label, or any element marked with [data-cursor-hover]). */
  isHovering: boolean
  /** True while the primary mouse button is held down. */
  isPressed: boolean
  /** True while the cursor is inside the viewport; false once it leaves. */
  isVisible: boolean
}
