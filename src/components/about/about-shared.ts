/**
 * Ids and layout shared by the About section's components, its FX canvas and
 * the section itself (which tracks what has been found).
 */

/** A constellation star, by its index in the Origin story. */
export const starId = (index: number) => `star-${index}`

/** A Field log case file, by its group (experience/education) and position. */
export const lineId = (group: number, entry: number) => `line-${group}-${entry}`

/**
 * The Origin constellation traces `</>` with eight stars in story order:
 * down the "<", up the "/", down the ">". These are its strokes, as pairs of
 * star indexes — they stay lit once the constellation is complete.
 */
export const GLYPH_EDGES = [
  [0, 1],
  [1, 2],
  [3, 4],
  [5, 6],
  [6, 7],
] as const

/** Jumps between strokes that the story takes; shown only while tracing. */
export const STORY_LINKS = [
  [2, 3],
  [4, 5],
] as const
