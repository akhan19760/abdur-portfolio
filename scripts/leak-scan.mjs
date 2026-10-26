#!/usr/bin/env node
// Check a version folder for anything carried over from earlier versions.
//
// Run from the main folder (it needs the earlier version branches):
//   node scripts/leak-scan.mjs ../abdur-portfolio-v2
//   node scripts/leak-scan.mjs ../abdur-portfolio-v2 --against version/portfolio_v1
//
// It collects fingerprints from each earlier version branch (colours, font
// names, longer copy strings, distinctive file names), drops any that also
// appear in workflow/content.md, then searches the version folder for them.
// It also checks the folder's git refs. Copy, font and git-ref matches fail the
// scan (exit code 1); colour and file-name matches are listed for review.
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { basename, extname, join, relative, resolve } from "node:path"
import { lineMatches } from "./lib/leak-match.mjs"

const args = process.argv.slice(2)
const target = args.find((a) => !a.startsWith("--"))
if (!target) {
  console.error(
    "usage: node scripts/leak-scan.mjs <version-folder> [--against <branch,...>]"
  )
  process.exit(2)
}
const targetDir = resolve(target)
if (!existsSync(join(targetDir, ".git"))) {
  console.error(`leak-scan: ${targetDir} is not a git folder`)
  process.exit(2)
}

const git = (cwd, ...a) =>
  execFileSync("git", a, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
const mainDir = git(process.cwd(), "rev-parse", "--show-toplevel").trim()

const targetBranch = git(targetDir, "branch", "--show-current").trim()
const targetN = Number((targetBranch.match(/^version\/portfolio_v(\d+)$/) || [])[1])
if (!targetN) {
  console.error(`leak-scan: ${targetDir} is on ${targetBranch}, not a version branch`)
  process.exit(2)
}

let against
const againstIdx = args.indexOf("--against")
if (againstIdx !== -1) {
  against = (args[againstIdx + 1] || "").split(",").filter(Boolean)
} else {
  against = git(
    mainDir,
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads/version/"
  )
    .split("\n")
    .filter((b) => {
      const n = Number((b.match(/portfolio_v(\d+)$/) || [])[1])
      return n && n < targetN
    })
}
if (against.length === 0) {
  console.error("leak-scan: no earlier version branches to compare against")
  process.exit(2)
}

const TEXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".css",
  ".json",
  ".html",
  ".md",
  ".svg",
])
const GENERIC = new Set([
  "setup-tests",
  "vite-env",
  "index",
  "main",
  "app",
  "router",
  "error-boundary",
])

const fingerprints = new Map() // value -> kind
const add = (kind, value) => {
  const v = value.trim()
  if (v.length >= 4 && !fingerprints.has(v.toLowerCase()))
    fingerprints.set(v.toLowerCase(), kind)
}

const flatten = (obj, out = []) => {
  if (typeof obj === "string") out.push(obj)
  else if (obj && typeof obj === "object")
    Object.values(obj).forEach((v) => flatten(v, out))
  return out
}

for (const ref of against) {
  const files = git(mainDir, "ls-tree", "-r", "--name-only", ref)
    .split("\n")
    .filter((f) => (f.startsWith("src/") || f === "index.html") && TEXT.has(extname(f)))
  for (const f of files) {
    const name = basename(f, extname(f)).replace(/\.(test|stories)$/, "")
    if (name.includes("-") && name.length >= 8 && !GENERIC.has(name))
      add("file name", name)
    let text
    try {
      text = git(mainDir, "show", `${ref}:${f}`)
    } catch {
      continue
    }
    for (const m of text.matchAll(/#([0-9a-f]{6})(?:[0-9a-f]{2})?\b/gi)) {
      const hex = m[1].toLowerCase()
      if (hex !== "000000" && hex !== "ffffff") add("colour", `#${hex}`)
    }
    for (const m of text.matchAll(/font-family:\s*["']([^"']+)["']/gi)) add("font", m[1])
    if (f.startsWith("src/locales/") && f.endsWith(".json")) {
      try {
        for (const s of flatten(JSON.parse(text))) {
          if (s.split(/\s+/).length >= 4)
            add("copy", s.replace(/<[^>]+>|\{\{[^}]+\}\}/g, "").trim())
        }
      } catch {
        /* not JSON */
      }
    }
  }
}

// Facts the owner provided may appear in any version.
const contentPath = join(targetDir, "workflow", "content.md")
const facts = existsSync(contentPath)
  ? readFileSync(contentPath, "utf8").toLowerCase()
  : ""
for (const key of [...fingerprints.keys()])
  if (facts.includes(key)) fingerprints.delete(key)

const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".taste-skill", "coverage"])
const SKIP_PATHS = [
  "workflow/refs",
  ".claude/skills/design-taste-frontend",
  "scripts/leak-scan.mjs",
]
const hits = []
const warnings = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = relative(targetDir, full).split("\\").join("/")
    if (
      SKIP_DIRS.has(entry) ||
      SKIP_PATHS.some((p) => rel === p || rel.startsWith(p + "/"))
    )
      continue
    const st = statSync(full)
    if (st.isDirectory()) walk(full)
    else if (TEXT.has(extname(entry)) || entry === "CLAUDE.md") {
      const lines = readFileSync(full, "utf8").split("\n")
      lines.forEach((line, i) => {
        for (const [fp, kind] of fingerprints) {
          // Font names are often ordinary words, so they count only where they name a font.
          if (!lineMatches(line, fp, kind)) continue
          const hit = `${rel}:${i + 1}  ${kind}: ${fp}`
          ;(kind === "copy" || kind === "font" ? hits : warnings).push(hit)
        }
      })
    }
  }
}
walk(targetDir)

// Git refs: nothing should point at an earlier version except the base commit.
const refs = git(targetDir, "for-each-ref", "--format=%(refname)")
  .split("\n")
  .filter(Boolean)
const strayRefs = refs.filter(
  (r) => r !== `refs/heads/${targetBranch}` && r !== `refs/remotes/origin/${targetBranch}`
)
const tags = git(targetDir, "tag", "--list").trim()

console.log(`leak-scan: ${targetDir} (${targetBranch})`)
console.log(`  compared against ${against.join(", ")}: ${fingerprints.size} fingerprints`)
let failed = false
if (hits.length) {
  failed = true
  console.log(`\n  ${hits.length} copy or font match(es) from an earlier version:`)
  for (const h of hits) console.log(`    ${h}`)
}
if (warnings.length) {
  console.log(
    `\n  ${warnings.length} colour or file-name match(es) to review (not a failure):`
  )
  for (const w of warnings) console.log(`    ${w}`)
}
if (strayRefs.length || tags) {
  failed = true
  console.log("\n  git refs that could expose an earlier version:")
  for (const r of strayRefs) console.log(`    ${r}`)
  if (tags) console.log(`    tags: ${tags.split("\n").join(", ")}`)
}
console.log(failed ? "\nleak-scan: FAILED" : "\nleak-scan: clean")
process.exit(failed ? 1 : 0)
