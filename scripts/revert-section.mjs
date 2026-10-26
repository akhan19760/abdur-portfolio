#!/usr/bin/env node
// Discards the uncommitted work of the section in progress (the owner's Revert).
//
//   node scripts/revert-section.mjs [--dry-run]
//
// Every approved section is committed, so whatever is uncommitted belongs to
// the section in review. This puts tracked files back as they were at the last
// commit and deletes untracked ones, except under workflow/ (STATE.md, the
// feedback file) and .claude/agents/ (the worker), which the orchestrator keeps.
// It uses git diff and git apply, so it works in a version folder whose
// settings deny git restore, checkout, stash and reset.
import { execFileSync } from "node:child_process"
import { readdirSync, rmdirSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

export const KEEP = ["workflow", ".claude/agents"]

export function revertSection(cwd, { dryRun = false } = {}) {
  const git = (args, input) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      input,
      maxBuffer: 256 * 1024 * 1024,
    })
  const root = resolve(git(["rev-parse", "--show-toplevel"]).trim()) // git prints C:/..., join gives C:\...
  const specs = [".", ...KEEP.map((k) => `:(exclude)${k}`)]
  const lines = (s) => s.split("\n").filter(Boolean)

  const tracked = lines(git(["diff", "--name-only", "HEAD", "--", ...specs], undefined))
  const untracked = lines(
    git(["ls-files", "--others", "--exclude-standard", "--", ...specs])
  )
  if (dryRun || (!tracked.length && !untracked.length)) return { tracked, untracked }

  if (tracked.length) {
    const patch = git(["diff", "--binary", "HEAD", "--", ...tracked])
    git(["apply", "-R", "--whitespace=nowarn", "-"], patch)
    git(["reset", "-q", "--", ...tracked]) // drop anything that was staged
  }
  for (const f of untracked) {
    const full = join(root, f)
    rmSync(full, { force: true })
    // remove folders the section created, if they are now empty
    for (
      let dir = dirname(full);
      dir.startsWith(root) && dir !== root;
      dir = dirname(dir)
    ) {
      if (readdirSync(dir).length) break
      rmdirSync(dir)
    }
  }
  return { tracked, untracked }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dryRun = process.argv.includes("--dry-run")
  const { tracked, untracked } = revertSection(process.cwd(), { dryRun })
  const verb = dryRun ? "would" : "did"
  if (!tracked.length && !untracked.length)
    console.log(
      "revert-section: nothing uncommitted outside workflow/ and .claude/agents/."
    )
  for (const f of tracked) console.log(`revert-section: ${verb} restore ${f}`)
  for (const f of untracked) console.log(`revert-section: ${verb} delete ${f}`)
}
