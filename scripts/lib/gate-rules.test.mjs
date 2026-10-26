// Tests for the section/page split of taste's inspector rules.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { RULE_IDS } from "../../.claude/skills/design-taste-frontend/scripts/lib/rules.mjs"
import {
  FIRST_SCREEN_RULES,
  IGNORED_RULES,
  PAGE_RULES,
  SECTION_RULES,
  classify,
  isKnown,
  sortFindings,
} from "./gate-rules.mjs"

const fail = (id) => ({ level: "FAIL", id, width: 1440, message: id })
const warn = (id) => ({ level: "WARN", id, width: 1440, message: id })

describe("gate rules", () => {
  it("place every rule the installed inspector knows", () => {
    const unplaced = RULE_IDS.filter((id) => !isKnown(id))
    assert.deepEqual(unplaced, [], "add these to scripts/lib/gate-rules.mjs")
  })

  it("place each rule in one group only", () => {
    const groups = [SECTION_RULES, FIRST_SCREEN_RULES, PAGE_RULES, IGNORED_RULES]
    for (const id of RULE_IDS) assert.equal(groups.filter((g) => g.has(id)).length, 1, id)
  })

  it("hold a section to its own type, colour, surfaces, margins and breakage", () => {
    for (const id of [
      "overflow",
      "contrast",
      "headline-lines",
      "eyebrow",
      "gradient",
      "off-centre",
      "body-size",
    ]) {
      assert.equal(classify(id), "section", id)
    }
  })

  it("leave pictures, motion, empty screens, the title and rhythm to the page", () => {
    for (const id of [
      "few-pictures",
      "still-page",
      "empty-screens",
      "no-title",
      "blank-gap",
      "ragged-edges",
    ]) {
      assert.equal(classify(id), "page", id)
    }
  })

  it("give the first-screen rules to the hero only", () => {
    assert.equal(classify("focal-point"), "page")
    assert.equal(classify("focal-point", { hero: true }), "section")
  })

  it("hold an unknown rule at section level", () => {
    assert.equal(classify("some-new-rule"), "section")
  })
})

describe("sorting findings", () => {
  const findings = [
    fail("overflow"),
    fail("few-pictures"),
    fail("focal-point"),
    warn("measure"),
    fail("dev-server"),
  ]

  it("block a section only on section-level FAILs", () => {
    const s = sortFindings(findings, { scope: "section" })
    assert.deepEqual(
      s.blocking.map((f) => f.id),
      ["overflow"]
    )
    assert.deepEqual(
      s.pageLevel.map((f) => f.id),
      ["few-pictures", "focal-point"]
    )
    assert.deepEqual(
      s.warnings.map((f) => f.id),
      ["measure"]
    )
    assert.deepEqual(
      s.ignored.map((f) => f.id),
      ["dev-server"]
    )
  })

  it("block the hero on the first-screen rules too", () => {
    assert.deepEqual(
      sortFindings(findings, { scope: "section", hero: true }).blocking.map((f) => f.id),
      ["overflow", "focal-point"]
    )
  })

  it("block the page on every FAIL", () => {
    assert.deepEqual(
      sortFindings(findings, { scope: "page" }).blocking.map((f) => f.id),
      ["overflow", "few-pictures", "focal-point"]
    )
  })
})
