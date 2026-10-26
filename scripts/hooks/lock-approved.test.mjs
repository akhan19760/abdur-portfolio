// Tests for the approved-section lock hook.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { check, parseState } from "./lock-approved.mjs"

const hook = join(dirname(fileURLToPath(import.meta.url)), "lock-approved.mjs")
const STATE = `# State of this version

## Sections

| Section | Folder | Status | Rounds | Commit |
| ------- | ------ | ------ | ------ | ------ |
| Hero | \`src/sections/hero/\` | approved | 1 | abc1234 |
| About | src/sections/about | in review | 2 | |
| Work | src/sections/work | brief approved | 0 | |
`

const dirs = []
function project(state = STATE) {
  const dir = mkdtempSync(join(tmpdir(), "lock-"))
  dirs.push(dir)
  if (state !== null) {
    mkdirSync(join(dir, "workflow"))
    writeFileSync(join(dir, "workflow", "STATE.md"), state)
  }
  return dir
}
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

const run = (dir, file, tool = "Edit") =>
  check({ tool_name: tool, tool_input: { file_path: file }, cwd: dir }, {})

describe("lock-approved", () => {
  it("reads the sections table, with backticks and trailing slashes", () => {
    const rows = parseState(STATE)
    assert.equal(rows.length, 3)
    assert.deepEqual(rows[0], {
      section: "Hero",
      folder: "src/sections/hero/",
      status: "approved",
      rounds: "1",
      commit: "abc1234",
    })
  })

  it("blocks an edit inside an approved section's folder", () => {
    const dir = project()
    for (const file of [
      join(dir, "src/sections/hero/hero.tsx"),
      "src/sections/hero/parts/title.tsx",
    ]) {
      const result = run(dir, file)
      assert.equal(result.allow, false, file)
      assert.match(result.message, /Hero section is approved/)
      assert.match(result.message, /back to "in review"/)
    }
  })

  it("allows edits elsewhere, including next to the folder and in STATE.md", () => {
    const dir = project()
    for (const file of [
      "src/sections/work/work.tsx",
      "src/sections/hero-extra/x.tsx",
      "src/app.tsx",
      "workflow/STATE.md",
    ]) {
      assert.equal(run(dir, file, "Write").allow, true, file)
    }
  })

  it("allows everything when STATE.md is missing", () => {
    assert.equal(run(project(null), "src/sections/hero/hero.tsx").allow, true)
  })

  it("allows edits once a section is set back to in review", () => {
    const dir = project(STATE.replace("| approved |", "| in review |"))
    assert.equal(run(dir, "src/sections/hero/hero.tsx").allow, true)
  })

  it("does not lock a section whose brief is approved", () => {
    assert.equal(run(project(), "src/sections/work/work.tsx").allow, true)
  })

  it("exits 2 with the message on stderr when run as a hook", () => {
    const dir = project()
    const payload = JSON.stringify({
      tool_name: "Edit",
      tool_input: { file_path: join(dir, "src/sections/hero/hero.tsx") },
      cwd: dir,
    })
    const blocked = spawnSync(process.execPath, [hook], {
      input: payload,
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    })
    assert.equal(blocked.status, 2)
    assert.match(blocked.stderr, /locked/)
    const allowed = spawnSync(process.execPath, [hook], {
      input: JSON.stringify({
        tool_name: "Write",
        tool_input: { file_path: join(dir, "src/app.tsx") },
        cwd: dir,
      }),
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    })
    assert.equal(allowed.status, 0)
  })
})
