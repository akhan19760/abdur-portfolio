// Tests for the board build script and the answer validation.
//   node --test ".claude/skills/board/test/*.test.mjs"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import {
  BoardError,
  OPEN_LICENCES,
  buildPage,
  checkDirection,
  checkFinalists,
  checkImages,
  checkMock,
  directionRowIds,
  esc,
  googleFontsHref,
  imageSrc,
  rowLetters,
  validateAnswers,
  weightedScore,
} from "../build.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, "fixtures")
const refsDir = join(fixtures, "refs")
const outFile = join(here, "out", "board.html")
const script = join(here, "..", "build.mjs")
const load = (board) =>
  JSON.parse(readFileSync(join(fixtures, "boards", `${board}.json`), "utf8"))
const row = (data, id) => data.rows.find((r) => r.id === id)

describe("finalists data", () => {
  it("accepts the fixture", () => {
    assert.deepEqual(checkFinalists(load("finalists")), [])
    assert.deepEqual(checkImages("finalists", load("finalists"), refsDir), [])
  })

  it("needs exactly five sites", () => {
    const data = load("finalists")
    data.sites.pop()
    assert.ok(checkFinalists(data).includes("sites: expected 5, found 4"))
  })

  it("needs the scout's two recommended sites, both on the board", () => {
    const data = load("finalists")
    data.recommended = ["alder"]
    assert.ok(checkFinalists(data).some((p) => p.startsWith("recommended:")))
    data.recommended = ["alder", "nowhere"]
    assert.ok(
      checkFinalists(data).includes('recommended: "nowhere" is not one of the sites')
    )
  })

  it("rejects scores outside 0 to 5, bad colours and bad measurements", () => {
    const data = load("finalists")
    data.sites[0].scores.fit = 7
    data.sites[1].colours[0].hex = "red"
    data.sites[2].measured = [{ label: "Layout" }]
    const problems = checkFinalists(data)
    assert.ok(problems.includes("sites[0].scores.fit: expected a number from 0 to 5"))
    assert.ok(problems.includes("sites[1].colours[0].hex: expected #rrggbb"))
    assert.ok(problems.includes("sites[2].measured: expected a list of { label, value }"))
  })

  it("reports a missing picture by its path", () => {
    const data = load("finalists")
    data.sites[0].id = "nobody"
    const missing = checkImages("finalists", data, refsDir)
    assert.ok(missing.some((m) => m.includes(join("nobody", "hero-1440.png"))))
  })

  it("weights the scores as the scout does", () => {
    assert.equal(
      weightedScore({ fit: 5, stack: 4, distinct: 4, mobile: 4, perf: 4 }),
      4.25
    )
    assert.equal(weightedScore({ fit: 5, stack: 5, distinct: 5, mobile: 5, perf: 5 }), 5)
  })
})

describe("direction data", () => {
  it("accepts the fixture", () => {
    assert.deepEqual(checkDirection(load("direction")), [])
    assert.deepEqual(checkImages("direction", load("direction"), refsDir), [])
  })

  it("lists the rows: the fixed ones around one per section", () => {
    assert.deepEqual(directionRowIds(["about", "work"]), [
      "type",
      "palette",
      "hero",
      "section:about",
      "section:work",
      "footer",
      "motion",
      "scenes",
      "live",
    ])
  })

  it("gives every row its own letter, never A or B", () => {
    const ids = [...directionRowIds(["about", "approach", "work", "contact"]), "extras"]
    const letters = Object.values(rowLetters(ids))
    assert.equal(new Set(letters).size, ids.length)
    assert.ok(!letters.includes("A") && !letters.includes("B"))
    assert.equal(rowLetters(ids)["section:work"], "W")
  })

  it("needs a row for every category, no others, and extras only last", () => {
    const data = load("direction")
    data.rows = data.rows.filter((r) => r.id !== "motion")
    data.rows.push({ ...data.rows[0], id: "section:blog" })
    const problems = checkDirection(data)
    assert.ok(problems.includes('rows: no row for "motion"'))
    assert.ok(
      problems.some((p) => p.startsWith('rows: "section:blog" is not a board row'))
    )
    const moved = load("direction")
    moved.rows.unshift(moved.rows.pop())
    assert.ok(
      checkDirection(moved).some((p) => p.startsWith("rows: expected this order"))
    )
  })

  it("needs the study: both sites' measurements, principles and what to avoid", () => {
    const data = load("direction")
    delete data.sites.B.study.motion
    data.study.avoid = []
    const problems = checkDirection(data)
    assert.ok(problems.includes("sites.B.study.motion: missing"))
    assert.ok(
      problems.includes("study.avoid: expected a list of what taste says to avoid")
    )
  })

  it("needs a reason for taste's pick, a named rule for a waiver, and a Feels like line", () => {
    const data = load("direction")
    row(data, "type").reason = ""
    row(data, "palette").options.A.verdict = { passes: false }
    delete row(data, "hero").options.B.feelsLike
    const problems = checkDirection(data)
    assert.ok(problems.includes('rows "type".reason: missing'))
    assert.ok(
      problems.includes(
        'rows "palette" option A.verdict: a waived rule needs "rule" and "why"'
      )
    )
    assert.ok(problems.includes('rows "hero" option B.feelsLike: missing'))
  })

  it("draws layout rows in the row's look, so only the layout differs", () => {
    const data = load("direction")
    row(data, "hero").options.A.palette = row(data, "palette").options.A.palette
    delete row(data, "footer").look.font
    const problems = checkDirection(data)
    assert.ok(
      problems.includes(
        `rows "hero" option A.palette: this row takes its palette from the row's look`
      )
    )
    assert.ok(
      problems.includes('rows "footer".look.font: missing, expected { display, text }')
    )
  })

  it("lets the type row vary only the fonts, and the palette row only the palette", () => {
    const data = load("direction")
    row(data, "type").options.B.palette = row(data, "palette").options.A.palette
    row(data, "palette").look.palette = row(data, "palette").options.A.palette
    const problems = checkDirection(data)
    assert.ok(
      problems.includes(
        `rows "type" option B.palette: this row takes its palette from the row's look`
      )
    )
    assert.ok(
      problems.includes(
        'rows "palette".look.palette: each option sets its own palette in this row'
      )
    )
  })

  it("needs section shots at both widths, from that site's folder", () => {
    const data = load("direction")
    delete row(data, "hero").options.A.shots.mobile
    row(data, "hero").options.B.shots.desktop = "alder/section-01-1440.jpg"
    delete row(data, "section:work").options.A.shots
    const problems = checkDirection(data)
    assert.ok(
      problems.includes('rows "hero" option A.shots: give both desktop and mobile')
    )
    assert.ok(problems.some((p) => p.includes("is not in that site's folder (cedar/)")))
    assert.ok(
      problems.includes(
        'rows "section:work" option A.shots: needs the desktop and mobile shots from the site'
      )
    )
  })

  it("checks the extras: unique ids, a site for each, and the row's look", () => {
    const data = load("direction")
    const extras = row(data, "extras").options
    extras[1].id = extras[0].id
    extras[2].from = "C"
    extras[3].font = row(data, "type").options.A.font
    const problems = checkDirection(data)
    assert.ok(
      problems.includes(`rows "extras" option 2.id: "${extras[0].id}" is used twice`)
    )
    assert.ok(problems.includes('rows "extras" option 3.from: expected "A" or "B"'))
    assert.ok(
      problems.includes(
        `rows "extras" option 4: extras take their fonts and palette from the row's look`
      )
    )
  })
})

describe("mocks", () => {
  it("accepts drawn HTML with its own styles", () => {
    assert.deepEqual(
      checkMock(
        '<style>.x{color:var(--o-ac)}</style><div class="x disp">Abdur Rahim</div>',
        "m"
      ),
      []
    )
  })

  for (const [html, what] of [
    ["<script>alert(1)</script>", "a script"],
    ['<div onclick="x()">a</div>', "an event handler"],
    ['<a href="javascript:x()">a</a>', "a javascript: link"],
    ['<div style="background:url(a.png)"></div>', "a url()"],
    ["<style>@import 'x.css';</style>", "an @import"],
    ['<img alt="" src="a.png">', "an embedded file"],
    ["<p>see https://example.com</p>", "an outside address"],
  ]) {
    it(`rejects ${what}`, () =>
      assert.ok(checkMock(html, "m").includes(`m: must not contain ${what}`)))
  }

  it("rejects a missing mock", () => {
    const data = load("direction")
    delete row(data, "motion").options.A.mock
    assert.ok(
      checkDirection(data).includes(
        'rows "motion" option A.mock: missing, expected an HTML fragment'
      )
    )
  })
})

describe("font licences (RULES.md rule 5)", () => {
  const withLicence = (licence) => {
    const data = load("direction")
    const font = row(data, "type").options.A.font.display
    if (licence === undefined) delete font.licence
    else font.licence = licence
    return checkDirection(data).filter((p) => p.includes("licence"))
  }

  for (const licence of OPEN_LICENCES) {
    it(`accepts ${licence}`, () => assert.deepEqual(withLicence(licence), []))
  }

  for (const licence of ["Proprietary", "ofl-1.1", "OFL", "GPL-3.0", ""]) {
    it(`rejects "${licence}"`, () => assert.equal(withLicence(licence).length, 1))
  }

  it("rejects a missing licence", () => assert.equal(withLicence(undefined).length, 1))

  it("checks the fonts of every row's look too", () => {
    const data = load("direction")
    row(data, "motion").look.font = {
      ...row(data, "motion").look.font,
      text: { family: "Fixture Text", licence: "Commercial" },
    }
    assert.ok(
      checkDirection(data).some((p) =>
        p.startsWith('rows "motion".look.font.text.licence')
      )
    )
  })

  it("names the reference's fonts and the fonts that are used", () => {
    const html = buildPage("direction", load("direction"), { refsDir, outFile })
    assert.match(
      html,
      /On Alder \(fixture\): Neue Fixture Grotesk and Fixture Text\. Used here: <b>Archivo<\/b> and <b>Inter<\/b> \(OFL-1\.1\), the closest open-licence fonts\./
    )
  })

  it("loads the board's face and every mock face in one Google Fonts request", () => {
    const href = googleFontsHref([
      { family: "Archivo", axes: "wght@100..900" },
      { family: "Inter" },
      { family: "Archivo", axes: "wght@100..900" },
    ])
    assert.equal(
      href,
      "https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..700&family=Archivo:wght@100..900&family=Inter&display=swap"
    )
    assert.throws(
      () =>
        googleFontsHref([
          { family: "Inter", axes: "wght@400" },
          { family: "Inter", axes: "wght@700" },
        ]),
      BoardError
    )
    const html = buildPage("direction", load("direction"), { refsDir, outFile })
    const outside = [...html.matchAll(/(?:href|src)="(https?:[^"]+)"/g)]
      .map((m) => new URL(m[1].replace(/&amp;/g, "&")).host)
      .filter(
        (h) =>
          ![
            "fonts.googleapis.com",
            "fonts.gstatic.com",
            "alder.test",
            "cedar.test",
          ].includes(h)
      )
    assert.deepEqual(outside, [])
  })
})

describe("rendering", () => {
  it("makes picture paths relative to the page", () => {
    assert.equal(
      imageSrc("alder/hero-1440.png", { refsDir, outFile }),
      "../fixtures/refs/alder/hero-1440.png"
    )
    const html = buildPage("finalists", load("finalists"), { refsDir, outFile })
    assert.ok(html.includes('src="../fixtures/refs/alder/hero-1440.png"'))
    assert.ok(!/src="[A-Za-z]:|src="\//.test(html), "no absolute picture paths")
  })

  it("draws five study cards, ranked, with the scout's two marked", () => {
    const html = buildPage("finalists", load("finalists"), { refsDir, outFile })
    assert.equal(html.match(/<li class="site/g).length, 5)
    assert.equal(html.match(/<span class="rec">Recommended<\/span>/g).length, 2)
    assert.ok(html.includes("ranked 1 of 5 · weighted score <b>4.25</b> of 5"))
    assert.equal(html.match(/<input type="checkbox" name="finalist"/g).length, 5)
  })

  it("codes options by site and row, and marks taste's pick", () => {
    const data = load("direction")
    const html = buildPage("direction", data, { refsDir, outFile })
    const choiceRows = data.rows.filter((r) => r.id !== "extras")
    assert.equal(html.match(/<input type="radio"/g).length, choiceRows.length * 2)
    assert.ok(
      html.includes('<span class="code">A1</span>') &&
        html.includes(`<span class="code">B${choiceRows.length}</span>`)
    )
    assert.equal(
      html.match(/Taste recommends this:/g).length,
      choiceRows.length + row(data, "extras").options.filter((o) => o.recommended).length
    )
    assert.ok(html.includes("Taste: needs “No rows of identical cards” waived"))
    assert.ok(html.includes("<b>Taste's set</b>A1 · B2 · A3"))
  })

  it("draws each mock in its look, with the reference small beneath", () => {
    const html = buildPage("direction", load("direction"), { refsDir, outFile })
    assert.match(
      html,
      /<div class="mock" style="--o-bg:#0f1724;[^"]*--disp:&#39;Archivo&#39;, Impact, sans-serif;/
    )
    assert.match(html, /<figcaption>As seen on Cedar \(fixture\)<\/figcaption>/)
  })

  it("draws the extras as checkboxes, coded X1 onwards", () => {
    const data = load("direction")
    const html = buildPage("direction", data, { refsDir, outFile })
    assert.equal(
      html.match(/<input type="checkbox" name="extras"/g).length,
      row(data, "extras").options.length
    )
    assert.ok(html.includes('data-code="X1"'))
  })

  it("draws the study: both sites, the principles and what to avoid", () => {
    const data = load("direction")
    const html = buildPage("direction", data, { refsDir, outFile })
    assert.ok(html.includes("What makes the two sites feel expensive"))
    assert.equal(html.match(/<article class="ref">/g).length, 2)
    const principles = html.match(/<ol class="principles">([\s\S]*?)<\/ol>/)[1]
    assert.equal(principles.match(/<li><b>/g).length, data.study.principles.length)
    assert.ok(html.includes("What taste says to avoid"))
  })

  it("escapes text from the data", () => {
    assert.equal(
      esc(`<b>"Tom" & 'Jo'</b>`),
      "&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jo&#39;&lt;/b&gt;"
    )
    const data = load("finalists")
    data.sites[0].name = "<script>alert(1)</script>"
    const html = buildPage("finalists", data, { refsDir, outFile })
    assert.ok(!html.includes("<script>alert(1)"))
    assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"))
  })

  it("links only http and https site addresses", () => {
    const data = load("finalists")
    data.sites[0].url = "javascript:alert(1)"
    const html = buildPage("finalists", data, { refsDir, outFile })
    assert.ok(!html.includes('href="javascript:'))
  })

  it("refuses data with problems, listing all of them", () => {
    const data = load("finalists")
    data.sites[0].risk = ""
    data.sites[1].scores.perf = -1
    assert.throws(
      () => buildPage("finalists", data, { refsDir, outFile }),
      (err) => err instanceof BoardError && err.problems.length === 2
    )
  })
})

describe("answers", () => {
  const finalists = load("finalists")
  const direction = load("direction")
  const choiceRows = direction.rows.filter((r) => r.id !== "extras")
  const allChoices = () =>
    Object.fromEntries(
      choiceRows.map((r, i) => [
        r.id,
        { site: "A", from: "alder", code: `A${i + 1}`, note: "" },
      ])
    )
  const answers = (choices = allChoices(), extras = { picked: [], note: "" }) => ({
    board: "direction",
    choices,
    extras,
  })

  it("accepts two finalists", () => {
    assert.deepEqual(
      validateAnswers(
        "finalists",
        { board: "finalists", chosen: ["alder", "elm"] },
        finalists
      ),
      []
    )
  })

  it("rejects one, three or repeated finalists, and unknown sites", () => {
    const check = (chosen) =>
      validateAnswers("finalists", { board: "finalists", chosen }, finalists)
    assert.ok(check(["alder"]).includes("chosen: expected exactly two sites, found 1"))
    assert.ok(
      check(["alder", "elm", "birch"]).includes(
        "chosen: expected exactly two sites, found 3"
      )
    )
    assert.ok(check(["alder", "alder"]).includes("chosen: a site is listed twice"))
    assert.ok(check(["alder", "oak"]).includes('chosen: "oak" is not on the board'))
  })

  it("rejects answers from the other board", () => {
    const problems = validateAnswers(
      "finalists",
      { board: "direction", chosen: ["alder", "elm"] },
      finalists
    )
    assert.ok(problems.includes('board: expected "finalists", found "direction"'))
  })

  it("accepts one choice for every row, and any number of extras", () => {
    assert.deepEqual(validateAnswers("direction", answers(), direction), [])
    const ids = row(direction, "extras").options.map((o) => o.id)
    assert.deepEqual(
      validateAnswers("direction", answers(undefined, { picked: ids }), direction),
      []
    )
  })

  it("rejects a missing row, an extra row, a site that is not A or B, and a wrong code", () => {
    const choices = allChoices()
    delete choices.motion
    choices["section:blog"] = { site: "A" }
    choices.type = { site: "C" }
    choices.palette = { site: "B", code: "B7" }
    const problems = validateAnswers("direction", answers(choices), direction)
    assert.ok(problems.includes('choices: no choice for "motion"'))
    assert.ok(problems.includes('choices: "section:blog" is not a row on the board'))
    assert.ok(problems.includes('choices "type".site: expected "A" or "B"'))
    assert.ok(problems.includes('choices "palette".code: expected B2, found B7'))
  })

  it("rejects a choice whose site id does not match its letter", () => {
    const choices = allChoices()
    choices.palette = { site: "B", from: "alder" }
    const problems = validateAnswers("direction", answers(choices), direction)
    assert.ok(problems.includes('choices "palette": site B is cedar, not "alder"'))
  })

  it("rejects unknown or repeated extras, and missing extras", () => {
    const ids = row(direction, "extras").options.map((o) => o.id)
    const problems = validateAnswers(
      "direction",
      answers(undefined, { picked: [ids[0], ids[0], "confetti"] }),
      direction
    )
    assert.ok(problems.includes("extras.picked: an extra is listed twice"))
    assert.ok(problems.includes('extras.picked: "confetti" is not on the board'))
    const none = validateAnswers(
      "direction",
      { board: "direction", choices: allChoices() },
      direction
    )
    assert.ok(
      none.includes("extras: missing, expected { picked: [...] } (it may be empty)")
    )
  })
})

describe("command line", () => {
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], { encoding: "utf8" })

  it("builds a board and validates answers", () => {
    const dir = mkdtempSync(join(tmpdir(), "board-"))
    try {
      const out = join(dir, "finalists.html")
      const built = run(
        "build",
        "finalists",
        "--data",
        join(fixtures, "boards", "finalists.json"),
        "--refs",
        refsDir,
        "--out",
        out
      )
      assert.equal(built.status, 0, built.stderr)
      assert.match(readFileSync(out, "utf8"), /<title>Choose two references<\/title>/)

      const good = join(dir, "good.json")
      const bad = join(dir, "bad.json")
      writeFileSync(
        good,
        JSON.stringify({ board: "finalists", chosen: ["alder", "cedar"] })
      )
      writeFileSync(bad, JSON.stringify({ board: "finalists", chosen: ["alder"] }))
      const data = ["--data", join(fixtures, "boards", "finalists.json")]
      assert.equal(run("validate", "finalists", good, ...data).status, 0)
      const refused = run("validate", "finalists", bad, ...data)
      assert.equal(refused.status, 1)
      assert.match(refused.stderr, /expected exactly two sites, found 1/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("exits 1 with a list of problems for bad data, and 2 for bad usage", () => {
    const missing = run(
      "build",
      "direction",
      "--data",
      join(fixtures, "boards", "nothing.json")
    )
    assert.equal(missing.status, 1)
    assert.match(missing.stderr, /not found/)
    assert.equal(run("build", "nonsense").status, 2)
  })
})
