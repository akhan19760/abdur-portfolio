# Rules that survive every version

These rules are kept by every purge. Every version's CLAUDE.md imports this file,
and every agent reads it before working.

## 1. Clean slate

A version is built from nothing. Read only:

- `workflow/content.md` (facts about the owner)
- `workflow/DIRECTION.md` (this version's chosen direction)
- `workflow/refs/` (this version's references)
- `workflow/PLAYBOOK.md` and the taste skill with its `.taste-skill/` working folder
- the owner's instructions in this session

Never look for, open or ask about earlier versions: other `version/*` branches,
sibling folders, or anything outside this folder. If a file seems to come from an
earlier version, stop and tell the owner.

## 2. A brief before any build

Before writing code for a section, post a short brief: what you will build, the
files and tests, which direction rows and reference principles you apply, and the
twist on anything you borrow. Wait for the owner's approval. Then build the whole
section with its tests as one unit, present it, and wait for review.
The owner can approve, steer or revert. Steering means: change only that section,
based on the feedback, and present it again.

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
- Its tools are the gate: `lint.mjs` and `inspect.mjs` on the production build,
  `scenes.mjs` when scroll scenes are used. A section is not ready to present
  until `inspect.mjs` shows 0 FAIL at 1440, 768 and 390, and its screenshots have
  been opened and critiqued as `references/critique.md` describes (three rounds
  at most).
- A rule may be waived only when the chosen direction requires it. Name the rule
  in `DIRECTION.md` and pass `--allow <rule>` to the inspector for that rule only.
- Precedence: the owner's choices on the board, then this file, then taste's defaults.
- Taste works on the project's root folder and writes to `.taste-skill/`.

## 5. Borrowing from references

Follow a reference closely when something is really good: its layout, section
structure, interaction or motion technique. Give every borrowed piece a deliberate
twist and name the twist in your report. Limits that a twist does not remove:

- Code: adapt only when the licence allows it, or re-implement the behaviour from
  what the page does.
- Wording, logos and fonts: never reused.
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
