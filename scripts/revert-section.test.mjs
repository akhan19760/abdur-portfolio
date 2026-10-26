// Tests for discarding a section's uncommitted work.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"
import { revertSection } from "./revert-section.mjs"

const dirs = []
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "revert-"))
  dirs.push(dir)
  const git = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" })
  git("init", "-q")
  git("config", "user.email", "test@example.invalid")
  git("config", "user.name", "Test")
  git("config", "core.autocrlf", "false")
  const put = (f, text) => {
    mkdirSync(join(dir, f, ".."), { recursive: true })
    writeFileSync(join(dir, f), text)
  }
  put("src/app.tsx", "export const App = 1\n")
  put("src/sections/hero/hero.tsx", "export const Hero = 1\n")
  put("workflow/STATE.md", "state\n")
  git("add", "-A")
  git("commit", "-q", "-m", "base")
  return { dir, git, put, read: (f) => readFileSync(join(dir, f), "utf8") }
}

describe("revert-section", () => {
  it("restores tracked files and deletes the section's new files", () => {
    const { dir, git, put, read } = repo()
    put("src/app.tsx", "export const App = 2\n")
    put("src/sections/about/about.tsx", "new\n")
    put("src/sections/about/parts/a.tsx", "new\n")
    put("src/sections/hero/hero.tsx", "export const Hero = 2\n")
    git("add", "src/sections/hero/hero.tsx") // a staged change too
    const result = revertSection(dir)
    assert.deepEqual(result.tracked.sort(), ["src/app.tsx", "src/sections/hero/hero.tsx"])
    assert.equal(read("src/app.tsx"), "export const App = 1\n")
    assert.equal(read("src/sections/hero/hero.tsx"), "export const Hero = 1\n")
    assert.equal(existsSync(join(dir, "src/sections/about")), false)
    assert.equal(git("status", "--porcelain"), "")
  })

  it("keeps workflow/ and .claude/agents/", () => {
    const { dir, git, put, read } = repo()
    put("workflow/STATE.md", "state, changed\n")
    put("workflow/feedback/about.md", "1. Steer\n")
    put(".claude/agents/about.md", "worker\n")
    put("src/sections/about/about.tsx", "new\n")
    revertSection(dir)
    assert.equal(read("workflow/STATE.md"), "state, changed\n")
    assert.equal(read("workflow/feedback/about.md"), "1. Steer\n")
    assert.equal(read(".claude/agents/about.md"), "worker\n")
    assert.equal(existsSync(join(dir, "src/sections/about")), false)
    assert.match(git("status", "--porcelain"), /workflow/)
  })

  it("only lists with dryRun", () => {
    const { dir, put, read } = repo()
    put("src/app.tsx", "changed\n")
    const result = revertSection(dir, { dryRun: true })
    assert.deepEqual(result.tracked, ["src/app.tsx"])
    assert.equal(read("src/app.tsx"), "changed\n")
  })

  it("does nothing on a clean tree", () => {
    const { dir } = repo()
    assert.deepEqual(revertSection(dir), { tracked: [], untracked: [] })
  })
})
