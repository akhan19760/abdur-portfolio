#!/usr/bin/env node
// Builds the owner's choice boards and checks the answers pasted back.
//
//   node .claude/skills/board/build.mjs build <finalists|direction> [--data F] [--out F] [--refs D]
//   node .claude/skills/board/build.mjs validate <finalists|direction> <answers.json> [--data F]
//
// Defaults: --data workflow/boards/<board>.json, --out workflow/boards/<board>.html,
// --refs workflow/refs. The page is one self-contained HTML file; pictures load
// from the refs folder by a path relative to the page. No dependencies.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))

export const BOARDS = ["finalists", "direction"]

// The scout's criteria, as in .claude/agents/reference-scout.md.
export const CRITERIA = [
  { key: "fit", label: "Fit for the owner's content", weight: 25 },
  { key: "stack", label: "Achievable in a normal web stack", weight: 25 },
  { key: "distinct", label: "Distinctiveness", weight: 20 },
  { key: "mobile", label: "Mobile quality", weight: 15 },
  { key: "perf", label: "Performance", weight: 15 },
]

// RULES.md rule 5: only these licences let a font be used.
export const OPEN_LICENCES = ["OFL-1.1", "Apache-2.0", "UFL-1.0", "MIT", "CC0-1.0"]

const MOMENTS = [
  { key: "hero", label: "Hero" },
  { key: "middle", label: "Middle" },
  { key: "footer", label: "Footer" },
]
const WIDTHS = [
  { key: "desktop", width: 1440, label: "Desktop" },
  { key: "mobile", width: 390, label: "Phone" },
]
const ROW_KINDS = {
  type: "type",
  palette: "palette",
  hero: "shots",
  footer: "shots",
  motion: "motion",
  scenes: "motion",
  live: "motion",
}
const ROW_TITLES = {
  type: "Type",
  palette: "Palette",
  hero: "Hero",
  footer: "Footer",
  motion: "Motion",
  scenes: "Scroll scenes",
  live: "The one live thing",
}

export class BoardError extends Error {
  constructor(problems) {
    super(problems.join("\n"))
    this.problems = problems
  }
}

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const isText = (v) => typeof v === "string" && v.trim() !== ""
const slugId = (s) => String(s).replace(/[^a-z0-9-]+/gi, "-")

// A picture's src: its path inside the refs folder, made relative to the page.
export function imageSrc(file, { refsDir, outFile }) {
  const rel = relative(dirname(outFile), join(refsDir, file))
  return rel.split(sep).join("/").split("/").map(encodeURIComponent).join("/")
}

export function weightedScore(scores) {
  const total = CRITERIA.reduce((sum, c) => sum + scores[c.key] * c.weight, 0) / 100
  return Math.round(total * 100) / 100
}

export function isOpenLicence(licence) {
  return OPEN_LICENCES.includes(licence)
}

// Every row of the direction board, in order: the fixed rows around one row per section.
export function directionRowIds(sections) {
  return [
    "type",
    "palette",
    "hero",
    ...sections.map((s) => `section:${s}`),
    "footer",
    "motion",
    "scenes",
    "live",
  ]
}

function rowKind(id) {
  return id.startsWith("section:") ? "shots" : ROW_KINDS[id]
}

function rowTitle(row) {
  if (isText(row.title)) return row.title
  if (row.id.startsWith("section:")) {
    const role = row.id.slice("section:".length)
    return role.charAt(0).toUpperCase() + role.slice(1).replace(/-/g, " ")
  }
  return ROW_TITLES[row.id]
}

// ---------------------------------------------------------------------------
// Data checks. Each returns a list of problems; an empty list means the data is usable.

export function checkFinalists(data) {
  const p = []
  const sites = Array.isArray(data?.sites) ? data.sites : null
  if (!sites) return ["sites: missing, expected a list of 5 sites"]
  if (sites.length !== 5) p.push(`sites: expected 5, found ${sites.length}`)
  const ids = new Set()
  sites.forEach((s, i) => {
    const at = `sites[${i}]`
    if (!/^[a-z0-9-]+$/.test(s?.id ?? ""))
      p.push(`${at}.id: expected a slug (a-z, 0-9, -)`)
    else if (ids.has(s.id)) p.push(`${at}.id: "${s.id}" is used twice`)
    else ids.add(s.id)
    for (const f of ["name", "url", "strongestIdea", "borrow", "risk"]) {
      if (!isText(s?.[f])) p.push(`${at}.${f}: missing`)
    }
    for (const c of CRITERIA) {
      const v = s?.scores?.[c.key]
      if (typeof v !== "number" || v < 0 || v > 5)
        p.push(`${at}.scores.${c.key}: expected a number from 0 to 5`)
    }
    if (!Array.isArray(s?.type) || s.type.length === 0)
      p.push(`${at}.type: expected a list of measured type`)
    else
      s.type.forEach((t, j) => {
        if (!isText(t?.role) || !isText(t?.family))
          p.push(`${at}.type[${j}]: needs role and family`)
      })
    if (!Array.isArray(s?.colours) || s.colours.length === 0)
      p.push(`${at}.colours: expected a list of swatches`)
    else
      s.colours.forEach((c, j) => {
        if (!/^#[0-9a-f]{6}$/i.test(c?.hex ?? ""))
          p.push(`${at}.colours[${j}].hex: expected #rrggbb`)
      })
  })
  const rec = data?.recommended
  if (!Array.isArray(rec) || rec.length !== 2 || rec[0] === rec[1]) {
    p.push("recommended: expected the ids of the scout's two sites")
  } else {
    rec
      .filter((id) => !ids.has(id))
      .forEach((id) => p.push(`recommended: "${id}" is not one of the sites`))
  }
  return p
}

function checkOption(row, letter, o, sites) {
  const p = []
  const at = `rows "${row.id}" option ${letter}`
  if (!o || typeof o !== "object") return [`${at}: missing`]
  if (!isText(o.summary)) p.push(`${at}.summary: missing`)
  if (!isText(o.twist)) p.push(`${at}.twist: missing`)
  const v = o.verdict
  if (!v || typeof v.passes !== "boolean")
    p.push(
      `${at}.verdict: expected { "passes": true } or { "passes": false, "rule", "why" }`
    )
  else if (!v.passes && (!isText(v.rule) || !isText(v.why)))
    p.push(`${at}.verdict: a waived rule needs "rule" and "why"`)
  const kind = rowKind(row.id)
  if (kind === "type") {
    const t = o.type
    if (!t) p.push(`${at}.type: missing`)
    else {
      if (!isText(t.referenceFont)) p.push(`${at}.type.referenceFont: missing`)
      if (!isText(t.usedFont)) p.push(`${at}.type.usedFont: missing`)
      if (!isOpenLicence(t.licence)) {
        p.push(
          `${at}.type.licence: "${t.licence ?? ""}" is not an open licence. Use one of ${OPEN_LICENCES.join(", ")}, ` +
            `and name the closest open-licence alternative as usedFont when the reference font is not open (RULES.md rule 5)`
        )
      }
    }
  }
  if (kind === "palette") {
    if (!Array.isArray(o.palette) || o.palette.length === 0)
      p.push(`${at}.palette: expected a list of swatches`)
    else
      o.palette.forEach((c, j) => {
        if (!/^#[0-9a-f]{6}$/i.test(c?.hex ?? ""))
          p.push(`${at}.palette[${j}].hex: expected #rrggbb`)
      })
  }
  if (kind === "shots" && (!isText(o.shots?.desktop) || !isText(o.shots?.mobile))) {
    p.push(`${at}.shots: needs desktop and mobile section shots`)
  }
  if (
    o.shots &&
    kind !== "shots" &&
    (!isText(o.shots.desktop) || !isText(o.shots.mobile))
  ) {
    p.push(`${at}.shots: give both desktop and mobile, or leave shots out`)
  }
  if (sites) {
    for (const file of [o.shots?.desktop, o.shots?.mobile, o.type?.shot]) {
      if (isText(file) && !file.startsWith(`${sites[letter]?.id}/`)) {
        p.push(
          `${at}: picture "${file}" is not in site ${letter}'s folder (${sites[letter]?.id}/)`
        )
      }
    }
  }
  return p
}

export function checkDirection(data) {
  const p = []
  const sites = data?.sites
  for (const letter of ["A", "B"]) {
    const s = sites?.[letter]
    if (!/^[a-z0-9-]+$/.test(s?.id ?? "") || !isText(s?.name))
      p.push(`sites.${letter}: needs id (a slug) and name`)
  }
  if (sites?.A?.id && sites.A.id === sites?.B?.id)
    p.push("sites: A and B must be different sites")
  const sections = data?.sections
  if (!Array.isArray(sections) || sections.some((s) => !/^[a-z0-9-]+$/.test(s))) {
    p.push(
      'sections: expected the section list as role slugs, e.g. ["about", "work", "contact"]'
    )
    return p
  }
  if (new Set(sections).size !== sections.length)
    p.push("sections: a role is listed twice")
  const rows = Array.isArray(data?.rows) ? data.rows : []
  const want = directionRowIds(sections)
  const have = rows.map((r) => r?.id)
  want
    .filter((id) => !have.includes(id))
    .forEach((id) => p.push(`rows: no row for "${id}"`))
  have
    .filter((id) => !want.includes(id))
    .forEach((id) =>
      p.push(`rows: "${id}" is not a board row (rows are ${want.join(", ")})`)
    )
  if (p.length === 0 && have.join() !== want.join())
    p.push(`rows: expected this order: ${want.join(", ")}`)
  for (const row of rows) {
    if (!want.includes(row?.id)) continue
    if (row.recommended !== "A" && row.recommended !== "B")
      p.push(`rows "${row.id}".recommended: expected "A" or "B"`)
    if (!isText(row.reason)) p.push(`rows "${row.id}".reason: missing`)
    for (const letter of ["A", "B"])
      p.push(...checkOption(row, letter, row.options?.[letter], sites))
  }
  return p
}

function imagesOf(board, data) {
  if (board === "finalists") {
    return data.sites.flatMap((s) =>
      MOMENTS.flatMap((m) => WIDTHS.map((w) => `${s.id}/${m.key}-${w.width}.png`))
    )
  }
  return data.rows.flatMap((r) =>
    ["A", "B"].flatMap((l) => {
      const o = r.options[l]
      return [o.shots?.desktop, o.shots?.mobile, o.type?.shot].filter(isText)
    })
  )
}

export function checkImages(board, data, refsDir) {
  return imagesOf(board, data)
    .filter((f) => !existsSync(join(refsDir, f)))
    .map((f) => `picture missing: ${join(refsDir, f)}`)
}

// ---------------------------------------------------------------------------
// Rendering.

// A chip of each colour with its value and role beside it, in the page's own
// ink: a mid-tone colour has no label ink that reads at 4.5:1 on it.
function swatches(list) {
  return `<ul class="swatches">${list
    .map(
      (c) =>
        `<li class="swatch"><span class="swatch-chip" style="background:${esc(c.hex)}"></span><span class="swatch-hex">${esc(
          c.hex.toLowerCase()
        )}</span>${isText(c.role) ? `<span class="swatch-role">${esc(c.role)}</span>` : ""}</li>`
    )
    .join("")}</ul>`
}

function siteLink(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return esc(url)
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return esc(url)
  return `<a href="${esc(parsed.href)}" rel="noreferrer">${esc(parsed.host + parsed.pathname.replace(/\/$/, ""))}</a>`
}

function picture(src, alt, cls) {
  return `<a class="shot ${cls}" href="${src}" target="_blank" rel="noreferrer"><img src="${src}" alt="${esc(alt)}" decoding="async"></a>`
}

function renderFinalistCard(site, rank, recommended, paths) {
  const id = slugId(site.id)
  const total = weightedScore(site.scores)
  const moments = MOMENTS.map(
    (m) => `<figure class="moment">
      <div class="moment-shots">${WIDTHS.map((w) =>
        picture(
          imageSrc(`${site.id}/${m.key}-${w.width}.png`, paths),
          `${site.name}, ${m.label.toLowerCase()} at ${w.width} pixels wide`,
          w.key
        )
      ).join("")}</div>
      <figcaption>${m.label}, desktop and phone</figcaption>
    </figure>`
  ).join("")
  const type = site.type
    .map(
      (t) =>
        `<li><span class="type-role">${esc(t.role)}</span> ${esc(t.family)}${
          [t.size, t.weight].filter(Boolean).length
            ? `, ${esc([t.size, t.weight].filter(Boolean).join(" at weight "))}`
            : ""
        }</li>`
    )
    .join("")
  const scores = CRITERIA.map(
    (c) =>
      `<tr><th scope="row">${esc(c.label)}</th><td>${c.weight}%</td><td>${esc(site.scores[c.key])} of 5</td></tr>`
  ).join("")
  return `<li class="card${recommended ? " is-recommended" : ""}" id="site-${id}">
  <article aria-labelledby="site-${id}-name">
    <div class="card-head">
      <h2 id="site-${id}-name">${esc(site.name)}</h2>
      <p class="card-meta">${siteLink(site.url)}. Ranked ${rank} of 5, weighted score ${total.toFixed(2)} of 5.</p>
      ${recommended ? `<p class="recommended">The scout recommends this site.</p>` : ""}
    </div>
    <div class="card-body">
      <div class="moments">${moments}</div>
      <div class="facts">
        <div><h3 id="site-${id}-idea">Strongest idea</h3><p>${esc(site.strongestIdea)}</p></div>
        <div><h3 id="site-${id}-borrow">Borrow, with a twist</h3><p>${esc(site.borrow)}</p></div>
        <div><h3 id="site-${id}-risk">Risk</h3><p>${esc(site.risk)}</p></div>
        <div><h3 id="site-${id}-type">Type, measured</h3><ul class="type-list">${type}</ul></div>
        <div><h3 id="site-${id}-colour">Colour, measured</h3>${swatches(site.colours)}</div>
        <div><h3 id="site-${id}-scores">Scores</h3>
          <table class="scores"><thead><tr><th scope="col">Criterion</th><th scope="col">Weight</th><th scope="col">Score</th></tr></thead>
          <tbody>${scores}</tbody><tfoot><tr><th scope="row">Weighted</th><td>100%</td><td>${total.toFixed(2)} of 5</td></tr></tfoot></table>
        </div>
      </div>
    </div>
    <div class="pick">
      <input type="checkbox" name="finalist" id="pick-${id}" value="${esc(site.id)}" data-name="${esc(site.name)}">
      <label for="pick-${id}">Choose ${esc(site.name)}</label>
    </div>
  </article>
</li>`
}

export function renderFinalists(data, paths) {
  const cards = data.sites
    .map((s, i) => renderFinalistCard(s, i + 1, data.recommended.includes(s.id), paths))
    .join("\n")
  return {
    title: "Choose two references",
    intro:
      "Five sites the scout found, best first. Pick any two: every later choice on the direction board comes from one of them. Pictures open full size in a new tab.",
    overview: `<ol>${data.sites
      .map(
        (s) =>
          `<li><a href="#site-${slugId(s.id)}">${esc(s.name)}, ${weightedScore(s.scores).toFixed(2)}${
            data.recommended.includes(s.id)
              ? `<span class="recommended-mark">, recommended</span>`
              : ""
          }</a></li>`
      )
      .join("")}</ol>`,
    body: `<ol class="cards">${cards}</ol>`,
    fonts: [],
  }
}

function verdictLine(v) {
  return v.passes
    ? `<p class="verdict passes">Passes taste's rules.</p>`
    : `<p class="verdict waives">Needs the rule "${esc(v.rule)}" waived: ${esc(v.why)}</p>`
}

function renderPreview(row, o, siteName, paths) {
  const kind = rowKind(row.id)
  if (kind === "type") {
    const t = o.type
    const same = t.referenceFont.trim().toLowerCase() === t.usedFont.trim().toLowerCase()
    const shot = isText(t.shot)
      ? picture(
          imageSrc(t.shot, paths),
          `${t.referenceFont} as set on ${siteName}`,
          "desktop"
        )
      : ""
    return `<div class="preview type-preview">
      <p class="type-sample" style="font-family:'${esc(t.usedFont.replace(/'/g, ""))}', var(--face)">${esc(
        t.sample || "Abdur Rahim, software engineer"
      )}</p>
      <dl class="font-pair">
        <div><dt>On the reference</dt><dd>${esc(t.referenceFont)}</dd></div>
        <div><dt>${same ? "Used as is" : "Used instead, the closest open-licence font"}</dt><dd>${esc(t.usedFont)}, ${esc(
          t.licence
        )}</dd></div>
      </dl>
      ${shot}
    </div>`
  }
  if (kind === "palette") return `<div class="preview">${swatches(o.palette)}</div>`
  if (!o.shots) return ""
  return `<div class="preview pair">${WIDTHS.map((w) =>
    picture(
      imageSrc(o.shots[w.key], paths),
      `${siteName}, ${rowTitle(row).toLowerCase()} at ${w.width} pixels wide`,
      w.key
    )
  ).join("")}</div>`
}

function renderRow(row, data, paths) {
  const id = slugId(row.id)
  const title = rowTitle(row)
  const options = ["A", "B"]
    .map((letter) => {
      const o = row.options[letter]
      const site = data.sites[letter]
      const oid = `${id}-${letter}`
      const recommended = row.recommended === letter
      return `<div class="option${recommended ? " is-recommended" : ""}">
        <div class="option-pick">
          <input type="radio" name="row-${id}" id="opt-${oid}" value="${letter}" data-row="${esc(row.id)}" data-from="${esc(
            site.id
          )}" aria-describedby="desc-${oid}">
          <label for="opt-${oid}">${esc(site.name)}</label>
        </div>
        ${renderPreview(row, o, site.name, paths)}
        <div class="option-text" id="desc-${oid}">
          <p>${esc(o.summary)}</p>
          <p><span class="lead">Twist:</span> ${esc(o.twist)}</p>
          ${verdictLine(o.verdict)}
          ${recommended ? `<p class="recommended">Taste recommends this: ${esc(row.reason)}</p>` : ""}
        </div>
      </div>`
    })
    .join("")
  return `<section class="row" id="row-${id}" data-row="${esc(row.id)}">
  <fieldset>
    <legend><h2>${esc(title)}</h2></legend>
    <div class="options">${options}</div>
    <div class="note">
      <label for="note-${id}">Note on ${esc(title.toLowerCase())}, if any</label>
      <textarea id="note-${id}" name="note-${id}" data-row="${esc(row.id)}" rows="2"></textarea>
    </div>
  </fieldset>
</section>`
}

export function renderDirection(data, paths) {
  const fonts = [
    ...new Set(
      data.rows.flatMap((r) =>
        ["A", "B"].map((l) => r.options[l].type?.usedFont).filter(isText)
      )
    ),
  ]
  return {
    title: "Choose the direction",
    intro: `One choice per row, from ${data.sites.A.name} or ${data.sites.B.name}. Taste's verdict and recommendation sit under each option; the choice is yours. Add a note to any row.`,
    overview: `<ul>${data.rows
      .map((r) => `<li><a href="#row-${slugId(r.id)}">${esc(rowTitle(r))}</a></li>`)
      .join("")}</ul>`,
    body: data.rows.map((r) => renderRow(r, data, paths)).join("\n"),
    fonts,
  }
}

export function googleFontsHref(families) {
  if (families.length === 0) return null
  const query = families
    .map((f) => `family=${encodeURIComponent(f.trim()).replace(/%20/g, "+")}`)
    .join("&")
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}

export function buildPage(board, data, { refsDir, outFile, template }) {
  const problems = board === "finalists" ? checkFinalists(data) : checkDirection(data)
  if (problems.length) throw new BoardError(problems)
  const missing = checkImages(board, data, refsDir)
  if (missing.length) throw new BoardError(missing)
  const paths = { refsDir, outFile }
  const page =
    board === "finalists" ? renderFinalists(data, paths) : renderDirection(data, paths)
  const href = googleFontsHref(page.fonts)
  const fontLinks = href
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(href)}">`
    : ""
  const fill = {
    "<!-- board:title -->": esc(page.title),
    "<!-- board:fonts -->": fontLinks,
    "<!-- board:intro -->": esc(page.intro),
    "<!-- board:overview -->": page.overview,
    "<!-- board:content -->": page.body,
  }
  let html = template ?? readFileSync(join(here, "template.html"), "utf8")
  for (const [marker, value] of Object.entries(fill)) {
    if (!html.includes(marker)) throw new Error(`template.html has no ${marker}`)
    html = html.split(marker).join(value)
  }
  return html.replace('data-board="board"', `data-board="${board}"`)
}

// ---------------------------------------------------------------------------
// Answers pasted back by the owner.

export function validateAnswers(board, answers, data) {
  const p = []
  if (!answers || typeof answers !== "object")
    return ["answers: expected the JSON block the board copied"]
  if (answers.board !== board)
    p.push(`board: expected "${board}", found "${answers.board ?? ""}"`)
  if (board === "finalists") {
    const ids = data.sites.map((s) => s.id)
    const chosen = answers.chosen
    if (!Array.isArray(chosen)) return [...p, "chosen: expected a list of two site ids"]
    if (chosen.length !== 2)
      p.push(`chosen: expected exactly two sites, found ${chosen.length}`)
    if (new Set(chosen).size !== chosen.length) p.push("chosen: a site is listed twice")
    chosen
      .filter((id) => !ids.includes(id))
      .forEach((id) => p.push(`chosen: "${id}" is not on the board`))
    return p
  }
  const choices = answers.choices
  if (!choices || typeof choices !== "object" || Array.isArray(choices)) {
    return [...p, "choices: expected one entry per row, keyed by row id"]
  }
  const want = data.rows.map((r) => r.id)
  want
    .filter((id) => !(id in choices))
    .forEach((id) => p.push(`choices: no choice for "${id}"`))
  Object.keys(choices)
    .filter((id) => !want.includes(id))
    .forEach((id) => p.push(`choices: "${id}" is not a row on the board`))
  for (const id of want) {
    const c = choices[id]
    if (!c) continue
    if (c.site !== "A" && c.site !== "B") {
      p.push(`choices "${id}".site: expected "A" or "B"`)
      continue
    }
    if (c.from !== undefined && c.from !== data.sites[c.site].id) {
      p.push(
        `choices "${id}": site ${c.site} is ${data.sites[c.site].id}, not "${c.from}"`
      )
    }
    if (c.note !== undefined && typeof c.note !== "string")
      p.push(`choices "${id}".note: expected text`)
  }
  return p
}

// ---------------------------------------------------------------------------
// Command line.

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i]
    else args._.push(argv[i])
  }
  return args
}

function readJson(file, what) {
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch (err) {
    throw new BoardError([
      `${what} ${file}: ${err.code === "ENOENT" ? "not found" : err.message}`,
    ])
  }
}

export function main(argv) {
  const args = parseArgs(argv)
  const [command, board, answersFile] = args._
  const usage =
    "usage: build.mjs build <finalists|direction> [--data F] [--out F] [--refs D]\n" +
    "       build.mjs validate <finalists|direction> <answers.json> [--data F]"
  if (!["build", "validate"].includes(command) || !BOARDS.includes(board)) {
    console.error(usage)
    return 2
  }
  const dataFile = resolve(args.data ?? join("workflow", "boards", `${board}.json`))
  try {
    const data = readJson(dataFile, "data")
    if (command === "build") {
      const outFile = resolve(args.out ?? join("workflow", "boards", `${board}.html`))
      const refsDir = resolve(args.refs ?? join("workflow", "refs"))
      const html = buildPage(board, data, { refsDir, outFile })
      mkdirSync(dirname(outFile), { recursive: true })
      writeFileSync(outFile, html)
      console.log(`board: wrote ${outFile}`)
      return 0
    }
    if (!answersFile) {
      console.error(usage)
      return 2
    }
    const problems = validateAnswers(
      board,
      readJson(resolve(answersFile), "answers"),
      data
    )
    if (problems.length) throw new BoardError(problems)
    console.log(`board: the ${board} answers are valid`)
    return 0
  } catch (err) {
    if (!(err instanceof BoardError)) throw err
    console.error(
      `board: ${err.problems.length} problem${err.problems.length === 1 ? "" : "s"}`
    )
    for (const line of err.problems) console.error(`  - ${line}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2))
}
