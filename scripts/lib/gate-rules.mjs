// Which of taste's inspector rules a single section is held to (RULES.md rule 4).
//
// Section-level rules judge what a section draws: its type, colours, surfaces,
// margins and breakage. Page-level rules judge the page as a whole: the picture
// floor, the motion count, empty screens, the title and the rhythm between
// sections. The first-screen rules belong to whichever section is the first
// screen (the hero), so they are section-level only with { hero: true }.

export const SECTION_RULES = new Set([
  // headlines and type
  "headline-lines",
  "statement-length",
  "mixed-font-headline",
  "font-count",
  "font-fallback",
  "font-not-dealt",
  "body-size",
  "grey-body",
  "measure",
  "small-text",
  // banned devices
  "eyebrow",
  "mono",
  "numbering",
  "micro-label",
  "emoji",
  "gradient",
  "gradient-text",
  "shadow",
  "text-shadow",
  "button-fx",
  "hairline",
  "outlined-box",
  "dashed",
  "glass",
  "icon-cards",
  "card-rows",
  "pill-nav",
  "blend-text",
  // colour
  "palette-claude",
  "palette-terracotta",
  "palette-cream",
  "palette-purple",
  "default-link",
  "contrast",
  // margins and layout inside the section
  "off-centre",
  "lopsided",
  "empty-middle",
  "edge-text",
  "one-sided-bleed",
  "untitled-section",
  "side-scroll",
  // breakage
  "ui-wrapper",
  "overflow",
  "broken-image",
  "covered-text",
  "clipped-text",
  "pinned-over-picture",
  "reduced-hidden",
  "scene-not-started",
  "scene-not-live",
])

export const FIRST_SCREEN_RULES = new Set([
  "focal-point",
  "hero-words",
  "no-hero",
  "first-action",
  "hero-void",
  "late-title",
])

export const PAGE_RULES = new Set([
  // pictures
  "few-pictures",
  "no-real-pictures",
  "no-footage",
  "no-poster",
  // motion
  "still-page",
  "long-pin",
  "many-scenes",
  "scene-heavy",
  // empty screens and rhythm across sections
  "empty-screens",
  "blank-gap",
  "size-count",
  "all-centred",
  "ragged-edges",
  // the page title
  "no-title",
  "small-title",
  "many-h1",
  "name-only-title",
])

// Never judged here: the gate runs on the production build, and not in app mode.
export const IGNORED_RULES = new Set([
  "dev-server",
  "sidebar-phone",
  "unused-canvas",
  "heavy-shadow",
  "heavy-borders",
  "radius-mix",
  "icon-chips",
  "numeric-align",
  "tabular",
  "rainbow-chart",
  "placeholder-data",
  "tiny-text",
  "colour-sprawl",
  "ragged-row",
  "below-fold",
  "app-title-size",
  "kpi-size",
  "icon-tiles",
  "panel-void",
  "no-data-hue",
])

// "section", "page" or "ignored". A rule this list does not know is held at
// section level, so a newer inspector fails safe.
export function classify(id, { hero = false } = {}) {
  if (FIRST_SCREEN_RULES.has(id)) return hero ? "section" : "page"
  if (PAGE_RULES.has(id)) return "page"
  if (IGNORED_RULES.has(id)) return "ignored"
  return "section"
}

export const isKnown = (id) =>
  SECTION_RULES.has(id) ||
  FIRST_SCREEN_RULES.has(id) ||
  PAGE_RULES.has(id) ||
  IGNORED_RULES.has(id)

// Sorts inspector findings. With scope "section", only section-level FAILs block;
// with scope "page", every FAIL blocks.
export function sortFindings(findings, { scope = "section", hero = false } = {}) {
  const out = { blocking: [], pageLevel: [], warnings: [], ignored: [] }
  for (const f of findings) {
    const level = classify(f.id, { hero })
    if (level === "ignored") out.ignored.push(f)
    else if (f.level !== "FAIL") out.warnings.push({ ...f, scope: level })
    else if (scope === "page" || level === "section")
      out.blocking.push({ ...f, scope: level })
    else out.pageLevel.push({ ...f, scope: level })
  }
  return out
}
