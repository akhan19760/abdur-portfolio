# Rules that survive every version

These rules are kept by every purge. Every version's CLAUDE.md imports this file,
and every agent reads it before working.

## 1. Clean slate

A version is built from nothing. Read only:

- `workflow/content.md` (facts about the owner) and `workflow/content-assets/` (the
  owner's own project screenshots)
- `workflow/DIRECTION.md` (this version's chosen direction)
- `workflow/refs/` (this version's references)
- `workflow/PLAYBOOK.md` and the taste skill with its `.taste-skill/` working folder
- the owner's instructions in this session

Never look for, open or ask about earlier versions: other `version/*` branches,
sibling folders, or anything outside this folder. If a file seems to come from an
earlier version, stop and tell the owner.

## 2. A brief before any build

Before writing code for a section, write a short brief: what you will build, the
files and tests, which direction rows and reference principles you apply, and the
twist on anything you borrow. A worker cannot stop and wait for the owner, so this
is two turns: when asked for a brief, return it and stop. The orchestrator shows it
to the owner and resumes the same worker with "approved, build it" or with changes.
Then build the whole section with its tests as one unit and report.
The owner can approve, steer or revert. Steering means: the orchestrator resumes
the same worker with the feedback, which changes only that section and reports
again.

## 3. Quality floor

- WCAG 2.2 Level AA, full keyboard access, and a calm `prefers-reduced-motion`
  fallback for every animation.
- Tests, lint and the production build pass, including an automated accessibility check.
- Renders cleanly at 1440px and 390px with no console errors.
- Design tokens only. No hard-coded colours or font sizes in sections.

## 4. Design guidance comes from the taste skill

Once the owner has chosen a reference, the `design-taste-frontend` skill (taste,
v2) is the design authority for this version. It decides how the board is prepared,
how pages are written, built, inspected and critiqued. Do not substitute
your own habits for it. Do not use any other design skill.

- Its house rules and laws of the craft apply to every section: no eyebrows,
  monospace, index numbers, hairlines, gradients, resting shadows, glass or emoji;
  at most two typefaces; headlines of two lines or fewer; a heading on every
  section; equal outer margins; no blank stretches; real pictures; the motion layer.
- Its tools are the gate: `lint.mjs`, and `inspect.mjs` on the production build
  through `scripts/taste-gate.mjs`, which sorts each finding by rule into section
  level or page level (`scripts/lib/gate-rules.mjs`); `scenes.mjs` when scroll
  scenes are used.
  - **Section level**, what a section draws: headline lines and type sizes
    (`headline-lines`, `statement-length`, `mixed-font-headline`, `font-count`,
    `font-fallback`, `font-not-dealt`, `body-size`, `grey-body`, `measure`,
    `small-text`); banned devices (`eyebrow`, `mono`, `numbering`, `micro-label`,
    `emoji`, `gradient`, `gradient-text`, `shadow`, `text-shadow`, `button-fx`,
    `hairline`, `outlined-box`, `dashed`, `glass`, `icon-cards`, `card-rows`,
    `pill-nav`, `blend-text`); colour and contrast (the `palette-*` rules,
    `default-link`, `contrast`); margins inside the section (`off-centre`,
    `lopsided`, `empty-middle`, `edge-text`, `one-sided-bleed`, `untitled-section`,
    `side-scroll`); breakage (`overflow`, `broken-image`, `ui-wrapper`,
    `covered-text`, `clipped-text`, `pinned-over-picture`, `reduced-hidden`,
    `scene-not-started`, `scene-not-live`). A rule the gate does not know is held
    at section level.
  - **First screen** (`focal-point`, `hero-words`, `no-hero`, `first-action`,
    `hero-void`, `late-title`): section level for the section that is the first
    screen (`--hero`), page level for every other section.
  - **Page level**, the page as a whole: the picture floor (`few-pictures`,
    `no-real-pictures`, `no-footage`, `no-poster`), the motion count (`still-page`,
    `long-pin`, `many-scenes`, `scene-heavy`), near-empty screens and rhythm across
    sections (`empty-screens`, `blank-gap`, `size-count`, `all-centred`,
    `ragged-edges`), and the page title (`no-title`, `small-title`, `many-h1`,
    `name-only-title`).
- A section must pass every section-level check: `taste-gate.mjs --scope section`
  shows 0 section-level FAIL at 1440, 768 and 390. Its page-level FAILs are listed
  in the section's report but do not block it. Its screenshots are opened and
  critiqued as `references/critique.md` describes (three rounds at most) before it
  is presented.
- The finished page must pass every check: qa runs `taste-gate.mjs --scope page`,
  where every FAIL blocks.
- A rule may be waived only when the chosen direction requires it. Name the rule
  in `DIRECTION.md` and pass `--allow <rule>` to `taste-gate.mjs` for that rule only.
- Precedence: the owner's choices on the board, then this file, then taste's defaults.
- Taste works on the project's root folder and writes to `.taste-skill/`.

## 5. Borrowing from references

Follow a reference closely when something is really good: its layout, section
structure, interaction or motion technique. Give every borrowed piece a deliberate
twist and name the twist in your report. Limits that a twist does not remove:

- Code: adapt only when the licence allows it, or re-implement the behaviour from
  what the page does.
- Wording and logos: never reused.
- Fonts: a reference's font may be used only when its licence allows it, for example
  an open-licence font from Google Fonts (OFL-1.1, Apache-2.0, UFL-1.0, MIT or
  CC0-1.0). Otherwise the type row of the direction board offers the closest
  open-licence alternative and names it. The board shows both: the reference's font
  and the font that would actually be used.
- Pictures: the reference's own pictures are never reused. Real pictures of this
  subject's world from open collections are welcome, credited as taste requires.
- The page as a whole must not be recognisable as the reference.

## 6. Real content only

Use `workflow/content.md`. No lorem ipsum, no invented facts, no invented numbers,
and no invented proof (customers, quotes, reviews, press). Sample details are
allowed only where taste's own rules allow them, and the report lists each one.
If a fact is missing, ask.

## 7. Reports

End every task with a short report: what you built, which board choices and taste
rules you applied, the twist on each borrowed piece, the inspector result and
critique scores from your last round, every found picture with its credit, and
anything you could not do. Do not claim a check you did not run.
