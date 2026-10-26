#!/usr/bin/env node
// The taste gate for one section, or for the whole page (RULES.md rule 4).
//
//   pnpm build
//   node scripts/taste-gate.mjs --scope section [--hero] [--allow rule,rule]
//   node scripts/taste-gate.mjs --scope page [--allow rule,rule]
//
// Runs taste's inspect.mjs on the production build in dist/ (unchanged; this
// only reads its findings) and sorts each FAIL by rule into section level or
// page level (scripts/lib/gate-rules.mjs). With --scope section, only
// section-level FAILs block; page-level FAILs are listed for the report. With
// --scope page, every FAIL blocks. --hero holds the first-screen rules at
// section level, for the section that is the first screen.
// Exit code: 0 pass, 1 blocking FAILs, 2 could not run.
import { spawn } from "node:child_process"
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, relative, resolve, sep } from "node:path"
import { isKnown, sortFindings } from "./lib/gate-rules.mjs"

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}
const scope = opt("scope", "section")
const hero = args.includes("--hero")
if (!["section", "page"].includes(scope)) {
  console.error(
    "usage: node scripts/taste-gate.mjs --scope section|page [--hero] [--allow rule,rule] [--dist dist] [--out dir] [--widths 1440,768,390]"
  )
  process.exit(2)
}
const root = process.cwd()
const dist = resolve(opt("dist", "dist"))
const out = resolve(opt("out", join(".taste-skill", "gate", scope)))
const inspect = resolve(".claude/skills/design-taste-frontend/scripts/inspect.mjs")
if (!existsSync(join(dist, "index.html"))) {
  console.error(
    `taste-gate: no ${relative(root, join(dist, "index.html"))}. Run pnpm build first.`
  )
  process.exit(2)
}
if (!existsSync(inspect)) {
  console.error(
    "taste-gate: the design-taste-frontend skill is missing (.claude/skills/design-taste-frontend)."
  )
  process.exit(2)
}
mkdirSync(out, { recursive: true })

// Serve dist/ at / the way a static host does (unknown paths get index.html), so the
// app's router sees "/" and the built /assets/ paths resolve.
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
}
const server = createServer((req, res) => {
  let file = resolve(
    join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname))
  )
  if (file !== dist && !file.startsWith(dist + sep)) {
    res.writeHead(403)
    return res.end()
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, "index.html")
  res.writeHead(200, {
    "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "no-store",
  })
  createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, "127.0.0.1", r))
const url = `http://127.0.0.1:${server.address().port}/`

const passOn = []
if (opt("allow")) passOn.push("--allow", opt("allow"))
if (opt("widths")) passOn.push("--widths", opt("widths"))
const run = await new Promise((done) => {
  const child = spawn(
    process.execPath,
    [inspect, url, "--json", "--out", out, ...passOn],
    { cwd: root }
  )
  let stdout = ""
  let stderr = ""
  child.stdout.on("data", (d) => (stdout += d))
  child.stderr.on("data", (d) => (stderr += d))
  child.on("close", (status) => done({ status, stdout, stderr }))
})
server.close()
let report
try {
  report = JSON.parse(run.stdout.slice(run.stdout.indexOf("{")))
} catch {
  console.error("taste-gate: inspect.mjs did not return a report.")
  console.error((run.stderr || run.stdout || "").slice(0, 2000))
  process.exit(2)
}

const sorted = sortFindings(report.findings, { scope, hero })
const where = (f) => `@${f.width}px${f.alsoAt ? ` (+${f.alsoAt.join(", ")})` : ""}`
const show = (title, list) => {
  if (!list.length) return
  console.log(title)
  for (const f of list) {
    console.log(
      `  [${f.id}] ${where(f)}  ${f.message}${isKnown(f.id) ? "" : "  (rule not in gate-rules.mjs; held at section level)"}`
    )
    if (f.fix) console.log(`      → ${f.fix}`)
  }
  console.log("")
}

console.log(`TASTE GATE · ${scope} scope${hero ? " · first screen (hero)" : ""}`)
console.log("")
show(
  scope === "section"
    ? "FAIL, section level: blocks this section"
    : "FAIL: blocks the page",
  sorted.blocking
)
show(
  "FAIL, page level: list it in the section's report; it does not block the section",
  sorted.pageLevel
)
show("WARN: fix, or defend in one sentence", sorted.warnings)
console.log("Screenshots to look at:")
for (const im of report.images) {
  for (const p of [im.fold, ...im.pages])
    console.log(`  ${relative(root, p).split("\\").join("/")}`)
}
console.log("")
const pageCount = sorted.pageLevel.length
console.log(
  sorted.blocking.length
    ? `RESULT: ${sorted.blocking.length} blocking FAIL${pageCount ? `, ${pageCount} page-level FAIL listed` : ""}, ${sorted.warnings.length} WARN. Not done.`
    : `RESULT: passes at ${scope} level${pageCount ? ` (${pageCount} page-level FAIL listed for the report)` : ""}, ${sorted.warnings.length} WARN.`
)
process.exit(sorted.blocking.length ? 1 : 0)
