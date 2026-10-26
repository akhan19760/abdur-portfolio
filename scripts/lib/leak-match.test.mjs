// Tests for the leak scan's line matching. The fingerprints here are invented;
// "Margin" stands for any font whose name is also an ordinary CSS word.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { lineMatches } from "./leak-match.mjs"

describe("font fingerprints", () => {
  for (const line of [
    'font-family: "Margin", sans-serif;',
    "  font-family: Margin, system-ui;",
    "h1 { font: 700 2rem/1 'Margin', serif }",
    '  fontFamily: "Margin",',
    '<link href="https://fonts.googleapis.com/css2?family=Margin:wght@400&display=swap">',
    "--font-support: 'Margin', sans-serif;",
  ]) {
    it(`counts the font where it is named: ${line.trim()}`, () => {
      assert.equal(lineMatches(line, "margin", "font"), true)
    })
  }

  for (const line of [
    ".code { font: 700 .78rem/1 var(--chrome); margin: 0 auto }",
    ".x { margin-top: 12px; font-size: 2cqw }",
    "font-size: 1.4cqw; margin-bottom: 8px",
    ".fx div { margin-left: 4px; font: inherit }",
    "The margin of the font sample",
  ]) {
    it(`ignores the word elsewhere: ${line}`, () => {
      assert.equal(lineMatches(line, "margin", "font"), false)
    })
  }

  it("matches a whole name only", () => {
    assert.equal(lineMatches("font-family: Marginalia, serif", "margin", "font"), false)
    assert.equal(
      lineMatches(
        "font-family: Neue Margin Grotesk, serif",
        "neue margin grotesk",
        "font"
      ),
      true
    )
  })
})

describe("other fingerprints", () => {
  it("count anywhere on the line, case aside", () => {
    assert.equal(lineMatches("color: #A1B2C3;", "#a1b2c3", "colour"), true)
    assert.equal(
      lineMatches("<p>One Two Three Four Five</p>", "one two three four five", "copy"),
      true
    )
    assert.equal(
      lineMatches(
        "import { ShopWindow } from './shop-window'",
        "shop-window",
        "file name"
      ),
      true
    )
  })

  it("miss when the fingerprint is absent", () => {
    assert.equal(lineMatches("color: #111111;", "#a1b2c3", "colour"), false)
  })
})
