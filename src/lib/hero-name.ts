/**
 * The Hero's particle name, sized for the screen.
 *
 * Wide screens use 13% of the width (capped at 192px); narrower ones take a
 * larger share so the name still fills the screen on tablets and phones, and
 * short ones (landscape phones) are capped by the height so the role, tagline
 * and call to action still fit around it. HeroContent's spacer mirrors these
 * numbers in CSS (the name is about 2.2 × this tall) — keep the two in step.
 */
export function heroFontSize(width: number, height: number): number {
  const share = width < 640 ? 0.22 : width < 1024 ? 0.18 : 0.13
  return Math.min(width * share, height * 0.24, 192)
}
