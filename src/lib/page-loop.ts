/**
 * The page's loop back to the start.
 *
 * After Contact the page runs on into a short stretch (the loop section):
 * the camera flies through a hole that opens in the pin wall, and the Hero's
 * name comes toward you out of the dark until the screen matches the top of
 * the page exactly. There the scroll position wraps back to the top.
 *
 * The Hero draws the name, so it needs to know how far along that approach
 * is. The loop section registers a reader here that works it out from the
 * live scroll position; the Hero calls `loopArrival()` each frame. It's read
 * on demand rather than pushed, so the Hero never sees last frame's value
 * when the scroll wraps.
 */

/**
 * 1 when the name is still far off (not yet on its way), easing to 0 as it
 * arrives, the moment the scroll wraps; null when the loop isn't in view.
 */
type ArrivalReader = () => number | null

let reader: ArrivalReader | null = null

/** The loop section registers its reader; returns the function that removes it. */
export function registerLoop(read: ArrivalReader): () => void {
  reader = read
  return () => {
    if (reader === read) reader = null
  }
}

/**
 * How far off the Hero's name is while the visitor comes round the loop: 1
 * far away, 0 arrived. Null when there's no loop, or it isn't in view.
 */
export function loopArrival(): number | null {
  return reader ? reader() : null
}
