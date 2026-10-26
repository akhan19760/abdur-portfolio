---
name: board
description: Builds the owner's choice boards for a portfolio version, as offline HTML pages, and records the answers. The finalists board shows the scout's five reference sites so the owner picks two; the direction board opens with a study of the two chosen sites, then shows each category (type, palette, hero, every section, footer, motion, scroll scenes, the one live thing, extras) with site A's and site B's option drawn as live mocks of the owner's real content, so the owner picks one per row. Use at PLAYBOOK.md stages 1-2 and 4, whenever the owner has to choose references or design options.
---

# Board

Two pages the owner uses to choose: the **finalists board** (pick two of the scout's
five sites) and the **direction board** (pick one option per row, from either site,
plus any number of extras). Each is built from a JSON data file into one
self-contained HTML file that works offline. Pictures load from `workflow/refs/` by
relative path; the only outside request is Google Fonts, for the board's own face and
the faces the mocks are drawn in.

The owner reads the page, chooses, presses **Copy my answers** and pastes a JSON block
back to you. You validate it and record it in `workflow/DIRECTION.md`.

**The look** follows `reference/lootledger-board.html`, the owner's style target: a
dark ground, one chrome face, a huge heavy headline with a short intro, rows with a
letter badge, options coded with the site's name, a "Recommended" tag for taste's pick
and a "Feels like:" line. The board is a tool, so taste's house rules do not govern
its look; they govern the **verdicts** it shows on each option.

## Files

| File | What it is |
| --- | --- |
| `build.mjs` | Builds a board and validates answers. No dependencies. |
| `template.html` | The page: chrome, the mock kit, the script for choosing and copying. |
| `reference/lootledger-board.html` | The style target. Read it before changing the template. |
| `test/build.test.mjs` | node:test tests, part of `pnpm test`. |
| `test/check.mjs` | `pnpm board:check`: builds both boards from the fixtures and checks them in a browser (axe, console, requests, keyboard, copying). |
| `test/fixtures/` | Invented sites (Alder, Cedar, ...) with the owner's real content, and placeholder pictures. A worked example of every field below. |

## The run

1. **Write the data file**, `workflow/boards/finalists.json` or
   `workflow/boards/direction.json`, in the shape below. The scout writes
   `finalists.json`. **You write `direction.json` during the taste stage**
   (PLAYBOOK.md stage 3): the study, taste's verdict and recommendation for every
   option, and every option's mock with its fonts and palette.
2. **Build the page**:

   ```bash
   node .claude/skills/board/build.mjs build finalists
   node .claude/skills/board/build.mjs build direction
   ```

   It writes `workflow/boards/<board>.html`. When the data has problems it lists all
   of them and writes nothing. Fix the data and build again; never edit the HTML.
3. **Open it in the owner's browser** (`start "" workflow/boards/<board>.html` on
   Windows, `open` on macOS, `xdg-open` on Linux) and say in one line what to do:
   "Choose two sites, then press Copy my answers and paste the block here."
4. **Wait for the pasted answers.** Do nothing else with the board until they arrive.
5. **Validate them.** Save the block as `workflow/boards/<board>-answers.json` and run
   `node .claude/skills/board/build.mjs validate <board> workflow/boards/<board>-answers.json`.
   Finalists need exactly two different sites. Direction needs one choice (A or B)
   for every row; extras may be empty. If validation fails, tell the owner what is
   missing in plain words and ask again. Never guess a choice for them.
6. **Record them in `workflow/DIRECTION.md`** (below).

## Recording the answers

After the **finalists board**, fill "Sites chosen" (the owner's order decides A and B),
and copy any note they wrote:

```markdown
Site A: Alder, https://alder.example (its slug: alder)
Site B: Cedar, https://cedar.example (its slug: cedar)
```

After the **direction board**, add one row per board row to "Board answers", in board
order: the row, the code and name of the option chosen, the site it came from, and
the twist from the data, then the owner's note if there is one. Then one row per
extra picked.

```markdown
| Row | Choice | From site | Twist |
| --- | ------ | --------- | ----- |
| Type | A1 Archivo with Inter (for Neue Haas Grotesk and Inter; OFL-1.1) | Alder | Set the name at full width. Note: keep it calm. |
| Extras | X1 Copy toast | Alder | Announce it to screen readers too. |
```

For the type row, always name the fonts that will be used, their licence, and the
reference fonts they stand in for. Add every chosen option whose verdict waives a
taste rule to "Taste rules waived, and why": the rule, the row and the reason. Fill
"Section list, in order" from `sections`.

## finalists.json

```json
{
  "recommended": ["alder", "cedar"],
  "sites": [
    {
      "id": "alder",
      "name": "Alder",
      "url": "https://alder.example",
      "scores": { "fit": 5, "stack": 4, "distinct": 4, "mobile": 4, "perf": 4 },
      "type": [{ "role": "Display", "family": "Neue Haas Grotesk", "size": "96px", "weight": "500" }],
      "colours": [{ "hex": "#1f2a24", "role": "ground" }],
      "measured": [{ "label": "Layout", "value": "Name split, uneven grid, name-again footer" }],
      "strongestIdea": "One sentence.",
      "borrow": "What could be borrowed, with the twist.",
      "risk": "One sentence."
    }
  ]
}
```

Exactly five sites, in the scout's ranked order. `id` is the folder in `workflow/refs/`;
its `hero`, `middle` and `footer` shots at 1440 and 390 must exist. `scores` are 0 to 5
on the scout's criteria (weights 25, 25, 20, 15, 15). `measured` is optional extra
measurements (layout, motion, built with). `recommended` names the scout's two.

## direction.json

The fixture `test/fixtures/boards/direction.json` is a complete example. Its shape:

```json
{
  "sites": {
    "A": { "id": "alder", "name": "Alder", "url": "https://alder.example",
           "study": { "type": "...", "colours": [{ "hex": "#1f2a24", "name": "forest ink" }],
                      "layout": "...", "motion": "...", "more": [{ "label": "Built with", "value": "Astro" }] } },
    "B": { "...": "the same" }
  },
  "study": {
    "title": "What makes the two sites feel expensive",
    "principles": [{ "title": "One loud face, used huge", "text": "..." }],
    "avoid": ["Small labels above every heading"]
  },
  "sections": ["about", "work", "contact"],
  "rows": [
    {
      "id": "hero",
      "purpose": "One line on what this row decides.",
      "look": { "font": { "display": FONT, "text": FONT }, "palette": PALETTE },
      "recommended": "A",
      "reason": "Why taste recommends it.",
      "options": {
        "A": {
          "name": "Name split",
          "summary": "One or two sentences.",
          "twist": "The twist it needs.",
          "feelsLike": "a poster. Bold, simple, memorable.",
          "verdict": { "passes": true },
          "mock": "<style>...</style><div>...</div>",
          "shots": { "desktop": "alder/section-01-1440.jpg", "mobile": "alder/section-01-390.jpg" }
        },
        "B": { "...": "the same" }
      }
    }
  ]
}
```

- **Rows**, in this order: `type`, `palette`, `hero`, one `section:<role>` per entry in
  `sections`, `footer`, `motion`, `scenes`, `live`, then optionally `extras`. Every row
  has a `purpose`. Each gets a letter badge (T, P, H, a letter per section, F, M, S, L,
  X) and its options are coded by site and row: A1/B1 in row 1, A2/B2 in row 2.
- **A FONT** is `{ "family": "Archivo", "axes": "wdth,wght@62..125,100..900",
  "weight": 800, "stretch": "112%", "licence": "OFL-1.1" }`, a Google Fonts family
  with the axes to load. `licence` must be one of `OFL-1.1`, `Apache-2.0`, `UFL-1.0`,
  `MIT`, `CC0-1.0` (RULES.md rule 5), for every font in every look and option. Ask for a
  family with the same axes everywhere.
- **A PALETTE** is `{ "bg", "fg", "accent", "ink", "soft" }`, all `#rrggbb`: ground,
  text, the loud colour, text on the loud colour, and a support tint.
- **The look.** Each row has a `look`. An option sets only what its row compares: in
  the `type` row each option has its own `font` and the row's look gives the palette;
  in the `palette` row each option has its own `palette` and the look gives the fonts;
  every other row (hero, sections, footer, motion, scenes, live, extras) draws both
  options in the row's look, so only the layout or the motion differs.
- **Type row options** also give `type.reference: { display, text }`, the fonts the site
  uses. When those are not open-licence, the option's `font` is the closest
  open-licence alternative; the board names both.
- **Verdicts** are taste's, from its house rules: `{ "passes": true }`, or
  `{ "passes": false, "rule": "No gradients", "why": "..." }`.
- **Shots** are the scout's section shots for that option's site, found by role in its
  `brief.md`. Required for hero, sections and footer; optional elsewhere. They show
  small under the mock, captioned "As seen on <site>".
- **Extras** has `options` as a list, each with `id`, `from` (`"A"` or `"B"`), the usual
  text fields, `verdict`, `mock`, and optionally `recommended: true` with a `reason`.
  The owner may pick any number.

## Writing the mocks

Each mock is an HTML fragment drawn live in its look, filled with the owner's real
content from `workflow/content.md` (name, role, projects, results). Draw it the way
the reference draws its options: the type row sets the same lines in each font, the
palette row uses the block layout, layout rows mock the layout with the owner's
content.

- The board wraps it in `<div class="mock">` with the look as variables: `--o-bg`,
  `--o-fg`, `--o-ac`, `--o-ink`, `--o-2`, and `--disp`, `--dw`, `--ds` (display face,
  weight, width), `--ui`, `--tw` (text face). Size everything in `cqw` so the mock
  scales with its card. `mockShape: "wide"` or `"tall"` changes its proportions.
- The kit in `template.html`: `.disp` (display face), `.up` (capitals), `.lbl` (small
  label), `.dim`, `.ac`, `.on-ac`, `.on-soft`, `.abs`, `.btn`, `.chip`, `.stack`, the
  type specimen `.spec` (`.l1`, `.l2`, `.para`, `.abc`) and the palette blocks `.pal`
  (`.base`, `.acc`, `.soft`, `.hex`, `.big`). A mock may add its own `<style>`; prefix
  its classes (`.fx-hero-a ...`) so they do not clash.
- A mock is a picture: no headings, links or form controls inside it. The build
  rejects scripts, event handlers, outside addresses, `url()`, `@import` and embedded
  files; mocks are drawn, not loaded.
- **Motion demos** are CSS animations inside the mock. Make the element's resting style
  the finished frame and animate from the start state, so `prefers-reduced-motion`
  (which stops every animation in mocks) leaves the finished frame showing.
- Real content only: no invented projects, numbers or quotes.

## Accessibility

Every choice is a native radio button (extras and finalists: checkbox) with a visible
"Choose A1" label, described by the option's name and text; each row is a radio group
named by its heading; a click on the mock chooses it too. Mocks are `role="img"` with a
label. Status messages are announced, copying with something missing says what and
moves focus there, and the pages work from 390px up with no sideways scroll.
`pnpm board:check` runs axe, the keyboard path and the copy at 1440 and 390.
