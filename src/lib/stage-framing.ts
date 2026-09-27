/**
 * How the full-screen 3D sections (Work, Process, Contact) frame their
 * picture for the screen's shape.
 *
 * Landscape screens put the picture beside the text: the project's screen
 * and the paper stand right of centre, the text on the left. Portrait
 * screens (phones, tablets held upright) have no room beside it, so the
 * picture moves to the top part of the view and the text sits underneath.
 * CSS switches the text layout with the matching `portrait:` variant
 * (`orientation: portrait`, i.e. height ≥ width), so the scenes and the
 * layout always agree.
 */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** True for a view at least as tall as it is wide (width / height ≤ 1). */
export function isPortrait(aspect: number): boolean {
  return aspect <= 1
}

/**
 * How tall the view is, from 0 (square or wider) to 1 (a tall phone,
 * about 9:19.5). Portrait scenes pull back further the taller it is.
 */
export function portraitAmount(aspect: number): number {
  return isPortrait(aspect) ? clamp01((1 - aspect) / 0.54) : 0
}

/**
 * Where Process's sheet of paper sits on screen (0–1 from the top left):
 * right of centre beside the text, or centred in the top part in portrait.
 * Work's sea sends the paper's landing ring out from the same spot.
 */
export function paperScreen(aspect: number): { sx: number; sy: number } {
  return isPortrait(aspect) ? { sx: 0.5, sy: 0.35 } : { sx: 0.63, sy: 0.5 }
}
