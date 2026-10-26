#!/usr/bin/env node
// PreToolUse hook for Edit and Write: approved sections are locked.
//
// Reads the hook's JSON from stdin, finds workflow/STATE.md in the project,
// and blocks (exit code 2) an edit to any file inside the Folder of a section
// whose Status is "approved". Without STATE.md, or outside those folders, it
// allows the edit. Registered in .claude/settings.json.
import { existsSync, readFileSync } from "node:fs"
import { isAbsolute, join, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"

// Rows of every markdown table in STATE.md that has Section, Folder and Status columns.
export function parseState(text) {
  const rows = []
  let header = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line.startsWith("|")) {
      header = null
      continue
    }
    const cells = line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim().replace(/^`|`$/g, "").trim())
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue
    if (!header) {
      const names = cells.map((c) => c.toLowerCase())
      header =
        names.includes("section") && names.includes("status") && names.includes("folder")
          ? names
          : null
      continue
    }
    rows.push(Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])))
  }
  return rows
}

const norm = (p) => (process.platform === "win32" ? p.toLowerCase() : p)

// The approved section whose folder holds `file`, or null.
export function lockedBy(rows, file, projectDir) {
  const target = norm(resolve(projectDir, file))
  for (const row of rows) {
    if (row.status.toLowerCase() !== "approved" || !row.folder) continue
    const folder = norm(resolve(projectDir, row.folder.replace(/[\\/]+$/, "")))
    if (target === folder || target.startsWith(folder + sep)) return row
  }
  return null
}

export function check(input, env = process.env) {
  const projectDir = env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
  const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path
  if (!file) return { allow: true }
  const statePath = join(projectDir, "workflow", "STATE.md")
  if (!existsSync(statePath)) return { allow: true }
  const row = lockedBy(
    parseState(readFileSync(statePath, "utf8")),
    isAbsolute(file) ? file : resolve(projectDir, file),
    projectDir
  )
  if (!row) return { allow: true }
  return {
    allow: false,
    message:
      `The ${row.section} section is approved, so its folder (${row.folder}) is locked. ` +
      `To change it, ask the owner first; to unlock it, set its status in workflow/STATE.md back to "in review".`,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let raw = ""
  process.stdin.setEncoding("utf8")
  process.stdin.on("data", (d) => (raw += d))
  process.stdin.on("end", () => {
    let input
    try {
      input = JSON.parse(raw || "{}")
    } catch {
      process.exit(0) // not a hook payload; never block on our own parse error
    }
    const result = check(input)
    if (!result.allow) {
      process.stderr.write(result.message + "\n")
      process.exit(2)
    }
    process.exit(0)
  })
}
