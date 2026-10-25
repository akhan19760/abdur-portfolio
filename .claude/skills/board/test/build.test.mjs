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
  directionRowIds,
  esc,
  googleFontsHref,
  imageSrc,
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

  it("rejects scores outside 0 to 5 and bad colours", () => {
    const data = load("finalists")
    data.sites[0].scores.fit = 7
    data.sites[1].colours[0].hex = "red"
    const problems = checkFinalists(data)
    assert.ok(problems.includes("sites[0].scores.fit: expected a number from 0 to 5"))
    assert.ok(problems.includes("sites[1].colours[0].hex: expected #rrggbb"))
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

  it("needs a row for every category and no others", () => {
    const data = load("direction")
    data.rows = data.rows.filter((r) => r.id !== "motion")
    data.rows.push({ ...data.rows[0], id: "section:blog" })
    const problems = checkDirection(data)
    assert.ok(problems.includes('rows: no row for "motion"'))
    assert.ok(
      problems.some((p) => p.startsWith('rows: "section:blog" is not a board row'))
    )
  })

  it("needs a reason for taste's recommendation and a named rule for a waiver", () => {
    const data = load("direction")
    data.rows[0].reason = ""
    data.rows[1].options.A.verdict = { passes: false }
    const problems = checkDirection(data)
    assert.ok(problems.includes('rows "type".reason: missing'))
    assert.ok(
      problems.includes(
        'rows "palette" option A.verdict: a waived rule needs "rule" and "why"'
      )
    )
  })

  it("needs section shots at both widths, from that site's folder", () => {
    const data = load("direction")
    const hero = data.rows.find((r) => r.id === "hero")
    delete hero.options.A.shots.mobile
    hero.options.B.shots.desktop = "alder/section-01-1440.jpg"
    const problems = checkDirection(data)
    assert.ok(
      problems.includes(
        'rows "hero" option A.shots: needs desktop and mobile section shots'
      )
    )
    assert.ok(problems.some((p) => p.includes("is not in site B's folder")))
  })
})

describe("font licences (RULES.md rule 5)", () => {
  const withLicence = (licence) => {
    const data = load("direction")
    if (licence === undefined) delete data.rows[0].options.A.type.licence
    else data.rows[0].options.A.type.licence = licence
    return checkDirection(data).filter((p) => p.includes("type.licence"))
  }

  for (const licence of OPEN_LICENCES) {
    it(`accepts ${licence}`, () => assert.deepEqual(withLicence(licence), []))
  }

  for (const licence of ["Proprietary", "ofl-1.1", "OFL", "GPL-3.0", ""]) {
    it(`rejects "${licence}"`, () => assert.equal(withLicence(licence).length, 1))
  }

  it("rejects a missing licence", () => assert.equal(withLicence(undefined).length, 1))

  it("shows the reference font and the font that is used", () => {
    const html = buildPage("direction", load("direction"), { refsDir, outFile })
    assert.match(html, /On the reference<\/dt><dd>Neue Fixture Grotesk<\/dd>/)
    assert.match(
      html,
      /the closest open-licence font<\/dt><dd>Inter Tight, OFL-1\.1<\/dd>/
    )
    assert.match(html, /Used as is<\/dt><dd>Fraunces, OFL-1\.1<\/dd>/)
  })

  it("loads only the used fonts, only from Google Fonts", () => {
    assert.equal(
      googleFontsHref(["Inter Tight", "Fraunces"]),
      "https://fonts.googleapis.com/css2?family=Inter+Tight&family=Fraunces&display=swap"
    )
    assert.equal(googleFontsHref([]), null)
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

  it("draws five cards, ranked, with the scout's two marked", () => {
    const html = buildPage("finalists", load("finalists"), { refsDir, outFile })
    assert.equal(html.match(/<li class="card/g).length, 5)
    assert.equal(html.match(/The scout recommends this site\./g).length, 2)
    assert.ok(html.includes("Ranked 1 of 5, weighted score 4.25 of 5."))
    assert.equal(html.match(/<input type="checkbox" name="finalist"/g).length, 5)
  })

  it("draws one radio group per direction row, with taste's pick marked", () => {
    const data = load("direction")
    const html = buildPage("direction", data, { refsDir, outFile })
    assert.equal(html.match(/<fieldset>/g).length, data.rows.length)
    assert.equal(html.match(/Taste recommends this:/g).length, data.rows.length)
    assert.ok(html.includes('Needs the rule "No rows of identical cards" waived'))
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

  it("writes colour values beside the swatch, never on it", () => {
    const data = load("finalists")
    data.sites[0].colours = [{ hex: "#777777", role: "mid grey" }]
    const html = buildPage("finalists", data, { refsDir, outFile })
    assert.ok(
      html.includes(
        '<span class="swatch-chip" style="background:#777777"></span><span class="swatch-hex">#777777</span>'
      )
    )
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
  const allChoices = () =>
    Object.fromEntries(
      direction.rows.map((r) => [r.id, { site: "A", from: "alder", note: "" }])
    )

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

  it("accepts one choice for every direction row", () => {
    assert.deepEqual(
      validateAnswers(
        "direction",
        { board: "direction", choices: allChoices() },
        direction
      ),
      []
    )
  })

  it("rejects a missing row, an extra row and a site that is not A or B", () => {
    const choices = allChoices()
    delete choices.motion
    choices["section:blog"] = { site: "A" }
    choices.type = { site: "C" }
    const problems = validateAnswers(
      "direction",
      { board: "direction", choices },
      direction
    )
    assert.ok(problems.includes('choices: no choice for "motion"'))
    assert.ok(problems.includes('choices: "section:blog" is not a row on the board'))
    assert.ok(problems.includes('choices "type".site: expected "A" or "B"'))
  })

  it("rejects a choice whose site id does not match its letter", () => {
    const choices = allChoices()
    choices.palette = { site: "B", from: "alder" }
    const problems = validateAnswers(
      "direction",
      { board: "direction", choices },
      direction
    )
    assert.ok(problems.includes('choices "palette": site B is cedar, not "alder"'))
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
