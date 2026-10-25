---
name: board
description: Builds the owner's choice boards for a portfolio version, as offline HTML pages, and records the answers. The finalists board shows the scout's five reference sites so the owner picks two; the direction board shows each category (type, palette, hero, every section, footer, motion, scroll scenes, the one live thing) with site A's and site B's option so the owner picks one per row. Use at PLAYBOOK.md stages 1-2 and 4, whenever the owner has to choose references or design options.
---

# Board

Two pages the owner uses to choose: the **finalists board** (pick two of the scout's
five sites) and the **direction board** (pick one option per category, from either
site). Each page is built from a JSON data file into one self-contained HTML file
that works offline. Its pictures load from `workflow/refs/` by relative path; the
only outside request is Google Fonts, for the type samples on the direction board.

The owner reads the page, chooses, presses **Copy my answers** and pastes a JSON block
back to you. You validate it and record it in `workflow/DIRECTION.md`.

## Files

| File                  | What it is                                                                             |
| --------------------- | -------------------------------------------------------------------------------------- |
| `build.mjs`           | Builds a board and validates answers. No dependencies.                                 |
| `template.html`       | The page: styles, markup slots and the script for choosing and copying.                |
| `test/build.test.mjs` | node:test tests, part of `pnpm test`.                                                  |
| `test/check.mjs`      | `pnpm board:check`: builds both boards from the fixtures and checks them in a browser. |
| `test/fixtures/`      | Sample data for five fake sites and placeholder pictures.                              |

## The run

1. **Write the data file**, `workflow/boards/finalists.json` or
   `workflow/boards/direction.json`, in the shape below. The scout writes
   `finalists.json`. You write `direction.json` from taste's preparation of the board
   (PLAYBOOK.md stage 3).
2. **Build the page**:

   ```bash
   node .claude/skills/board/build.mjs build finalists
   node .claude/skills/board/build.mjs build direction
   ```

   It writes `workflow/boards/<board>.html`. When the data has problems (a missing
   field, a score out of range, a missing picture, a font licence that is not open),
   it lists all of them and writes nothing. Fix the data and build again; do not
   edit the HTML by hand.

3. **Open it in the owner's browser** (`start "" workflow/boards/<board>.html` on
   Windows, `open` on macOS, `xdg-open` on Linux) and tell them what to do in one
   line: "Choose two sites, then press Copy my answers and paste the block here."
4. **Wait for the pasted answers.** Do nothing else with the board until they arrive.
5. **Validate them.** Save the block as `workflow/boards/<board>-answers.json` and run:

   ```bash
   node .claude/skills/board/build.mjs validate finalists workflow/boards/finalists-answers.json
   node .claude/skills/board/build.mjs validate direction workflow/boards/direction-answers.json
   ```

   The finalists answers need exactly two different sites from the board. The
   direction answers need one choice (site A or B) for every row and no other rows. If
   validation fails, tell the owner what is missing in plain words and ask again; do
   not guess a choice for them.

6. **Record them in `workflow/DIRECTION.md`** (below).

## Recording the answers

After the **finalists board**, fill "Sites chosen":

```markdown
Site A: Alder, https://alder.example (its slug: alder)
Site B: Cedar, https://cedar.example (its slug: cedar)
```

The owner's order of choice decides A and B. Copy any note they wrote under the sites.

After the **direction board**, add one row per board row to the "Board answers" table,
in board order: the row's name, the option chosen in a few words (its summary), the
site it came from, and the twist from the data, followed by the owner's note if there
is one.

```markdown
| Row  | Choice                                                                       | From site | Twist                                                           |
| ---- | ---------------------------------------------------------------------------- | --------- | --------------------------------------------------------------- |
| Type | One tight grotesk at a very large size (Inter Tight, OFL-1.1, for Neue Haas) | Alder     | Set the name at 12vw with tighter tracking. Note: keep it calm. |
```

For the type row, always name the font that will be used and its licence, and the
reference font it stands in for. Then, for every chosen option whose verdict waives a
taste rule, add it to "Taste rules waived, and why": the rule, the row, and the reason
from the data. Fill "Section list, in order" from the data's `sections`. Leave the
other parts of DIRECTION.md to the orchestrator's later steps.

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
      "type": [
        {
          "role": "Display",
          "family": "Neue Haas Grotesk",
          "size": "96px",
          "weight": "500"
        },
        { "role": "Text", "family": "Inter", "size": "18px", "weight": "400" }
      ],
      "colours": [{ "hex": "#1f2a24", "role": "ground" }],
      "strongestIdea": "One sentence.",
      "borrow": "What could be borrowed, with the twist.",
      "risk": "One sentence."
    }
  ]
}
```

- Exactly five sites, in the scout's ranked order, best first. `id` is the folder name
  in `workflow/refs/`.
- `scores` are 0 to 5 on the scout's five criteria. The board shows each with its
  weight (25, 25, 20, 15, 15) and the weighted total.
- `recommended` holds the ids of the scout's two.
- The pictures come from the capture script by name: `<id>/hero-1440.png`,
  `<id>/hero-390.png`, and the same for `middle` and `footer`. All six must exist.

## direction.json

```json
{
  "sites": {
    "A": { "id": "alder", "name": "Alder", "url": "https://alder.example" },
    "B": { "id": "cedar", "name": "Cedar", "url": "https://cedar.example" }
  },
  "sections": ["about", "work", "contact"],
  "rows": [
    {
      "id": "type",
      "recommended": "A",
      "reason": "Why taste recommends this option.",
      "options": {
        "A": {
          "summary": "One line on the option.",
          "twist": "The twist it needs.",
          "verdict": { "passes": true },
          "type": {
            "referenceFont": "Neue Haas Grotesk",
            "usedFont": "Inter Tight",
            "licence": "OFL-1.1",
            "sample": "Abdur Rahim builds for the web",
            "shot": "alder/section-01-1440.jpg"
          }
        },
        "B": { "...": "the same shape" }
      }
    }
  ]
}
```

- `sections` is the section list from taste's argument (role slugs, in page order).
- `rows` come in exactly this order: `type`, `palette`, `hero`, one
  `section:<role>` per entry in `sections`, `footer`, `motion`, `scenes`, `live`.
  The build rejects a missing, extra or out-of-order row.
- Every option has `summary`, `twist` and `verdict`. A verdict is
  `{ "passes": true }`, or `{ "passes": false, "rule": "No gradients", "why": "..." }`
  naming the taste rule it would need waived and why. Every row has taste's
  `recommended` option (`"A"` or `"B"`) and its `reason`.
- **Type:** `referenceFont` is the font the site uses. `usedFont` is the font this
  version would use, with its `licence`. The licence must be one of `OFL-1.1`,
  `Apache-2.0`, `UFL-1.0`, `MIT`, `CC0-1.0`; anything else, or none, is rejected
  (RULES.md rule 5). When the reference font is not open, `usedFont` is the closest
  open-licence alternative, and the board says so. `usedFont` is loaded from Google
  Fonts for the sample, so give its Google Fonts family name. `sample` is optional;
  `shot` (optional) shows the reference font in use.
- **Palette:** `palette` is a list of `{ "hex": "#rrggbb", "role": "ground" }`.
- **Hero, each section, footer:** `shots` is
  `{ "desktop": "<id>/section-NN-1440.jpg", "mobile": "<id>/section-NN-390.jpg" }`,
  the matching section shots from the scout's capture, found by the roles in its
  `brief.md`. Pictures must come from that option's own site folder.
- **Motion, scroll scenes, the one live thing:** words are enough; add `shots` when a
  section shot shows the move.

## The pages

Both boards follow taste's house rules: one typeface (the system face), one accent,
flat tone steps between surfaces, no lines, shadows, gradients, eyebrows, monospace
or index numbers. They were gated with `lint.mjs --app` and `inspect.mjs --app`. If
you change the template, load `design-taste-frontend`, keep to its rules, and run:

```bash
pnpm board:check
node .claude/skills/design-taste-frontend/scripts/lint.mjs --app .claude/skills/board/template.html
node .claude/skills/design-taste-frontend/scripts/inspect.mjs --app .claude/skills/board/test/out/direction.html
```

Accessibility: every choice is a native checkbox or radio button with a label; each
direction row is a fieldset whose legend is the row's heading; option details are
tied to their radio with `aria-describedby`; status messages are announced. Copying
with something missing says what is missing and moves focus to it. Pictures open
full size in a new tab. The pages work from 390px up with no sideways scroll.
