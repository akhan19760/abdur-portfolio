// Tests for the leak scan's line matching.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { lineMatches } from "./leak-match.mjs"

describe("font fingerprints", () => {
  for (const line of [
    'font-family: "Border", sans-serif;',
    "  font-family: Border, system-ui;",
    "h1 { font: 700 2rem/1 'Border', serif }",
    '  fontFamily: "Border",',
    '<link href="https://fonts.googleapis.com/css2?family=Border:wght@400&display=swap">',
    'const fonts = ["Border", "Inter"] // font stack',
  ]) {
    it(`counts the font where it is named: ${line.trim()}`, () => {
      assert.equal(lineMatches(line, "border", "font"), true)
    })
  }

  for (const line of [
    ".code { font: 700 .78rem/1 var(--chrome); border: 1px solid var(--fg) }",
    ".x { border-top: 1px solid red; font-size: 2cqw }",
    "font-size: 1.4cqw; border-bottom: 1px solid #ffffff1a",
    ".fx div { border-top: 1px solid; font: inherit }",
    "The border of the font sample",
  ]) {
    it(`ignores the word elsewhere: ${line}`, () => {
      assert.equal(lineMatches(line, "border", "font"), false)
    })
  }

  it("matches a whole name only", () => {
    assert.equal(lineMatches("font-family: Borderline, serif", "border", "font"), false)
    assert.equal(
      lineMatches(
        "font-family: Neue Border Grotesk, serif",
        "neue border grotesk",
        "font"
      ),
      true
    )
  })
})

describe("other fingerprints", () => {
  it("count anywhere on the line, case aside", () => {
    assert.equal(lineMatches("color: #9900FA;", "#9900fa", "colour"), true)
    assert.equal(
      lineMatches(
        "<p>Built From Light And Shadow</p>",
        "built from light and shadow",
        "copy"
      ),
      true
    )
    assert.equal(
      lineMatches(
        "import { CursorLight } from './cursor-light'",
        "cursor-light",
        "file name"
      ),
      true
    )
  })

  it("miss when the fingerprint is absent", () => {
    assert.equal(lineMatches("color: #111111;", "#9900fa", "colour"), false)
  })
})
