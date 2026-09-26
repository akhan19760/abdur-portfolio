/**
 * The About statement's letter-by-letter reveal: as the visitor scrolls, a
 * soft edge sweeps through the sentence and each character goes from a dim
 * grey to its real colour.
 *
 * Colours are written straight onto the characters, and only onto the ones
 * that changed: each frame touches the few characters at the edge of the
 * sweep. (Working it out in CSS from an inherited variable made every
 * character recompute its colour on every frame, which made scrolling stutter.)
 */

/** How many characters the soft edge of the sweep spans. */
export const REVEAL_SOFT = 6

/** Unrevealed characters: --color-text at 40% over --color-base (3.4:1, AA for large text). */
export const REVEAL_DIM = "#666563"

/**
 * How revealed (0–1) character `index` of `count` is when the sweep is at
 * `reveal` (0–1). The last character finishes exactly as `reveal` reaches 1.
 */
export function charReveal(
  reveal: number,
  index: number,
  count: number,
  soft = REVEAL_SOFT
): number {
  const t = (reveal * (count + soft) - index) / soft
  return Math.min(1, Math.max(0, t))
}

/**
 * The inline colour for a character that's `amount` (0–1) revealed, rounded
 * to whole percent: grey, a blend toward its own colour (inherited from its
 * word, so keywords stay purple), or "" to use its own colour outright.
 */
export function charColor(amount: number): string {
  const percent = Math.round(amount * 100)
  if (percent >= 100) return ""
  if (percent <= 0) return REVEAL_DIM
  // In `color`, currentcolor is the inherited (real) colour
  return `color-mix(in srgb, currentcolor ${percent}%, ${REVEAL_DIM})`
}

const written = new WeakMap<HTMLElement, { chars: HTMLElement[]; colors: string[] }>()

/**
 * Sets the sweep of `statement` (an element whose characters are
 * `[data-char]` spans, in reading order) to `reveal` (0–1).
 */
export function applyStatementReveal(statement: HTMLElement, reveal: number) {
  let state = written.get(statement)
  if (!state) {
    const chars = Array.from(statement.querySelectorAll<HTMLElement>("[data-char]"))
    // A value no colour can equal, so the first call writes every character
    state = { chars, colors: chars.map(() => "\u0000") }
    written.set(statement, state)
  }
  const { chars, colors } = state
  chars.forEach((char, i) => {
    const color = charColor(charReveal(reveal, i, chars.length))
    if (color === colors[i]) return
    colors[i] = color
    if (color) char.style.setProperty("color", color)
    else char.style.removeProperty("color")
  })
}
