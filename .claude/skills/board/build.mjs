#!/usr/bin/env node
// Builds the owner's choice boards and checks the answers pasted back.
//
//   node .claude/skills/board/build.mjs build <finalists|direction> [--data F] [--out F] [--refs D]
//   node .claude/skills/board/build.mjs validate <finalists|direction> <answers.json> [--data F]
//
// Defaults: --data workflow/boards/<board>.json, --out workflow/boards/<board>.html,
// --refs workflow/refs. The page is one self-contained HTML file; pictures load
// from the refs folder by a path relative to the page, fonts from Google Fonts.
// The look follows reference/lootledger-board.html. No dependencies.
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

// The board's own face, as on the reference.
const CHROME_FONT = { family: "Schibsted Grotesk", axes: "wght@400..700" }

const MOMENTS = [
  { key: "hero", label: "Hero" },
  { key: "middle", label: "Middle" },
  { key: "footer", label: "Footer" },
]
const WIDTHS = [
  { key: "desktop", width: 1440 },
  { key: "mobile", width: 390 },
]
const PALETTE_ROLES = ["bg", "fg", "accent", "ink", "soft"]

// The fixed rows. `compares` names the one thing an option may set for itself;
// everything else comes from the row's look, so only that thing differs.
const FIXED_ROWS = {
  type: { letter: "T", title: "Type", compares: "font" },
  palette: { letter: "P", title: "Palette", compares: "palette" },
  hero: { letter: "H", title: "Hero, the first screen", layout: true },
  footer: { letter: "F", title: "Footer, the finale", layout: true },
  motion: { letter: "M", title: "Motion" },
  scenes: { letter: "S", title: "Scroll scenes" },
  live: { letter: "L", title: "The one live thing" },
  extras: { letter: "X", title: "Extras (pick any)" },
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
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v ?? "")
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

// The choice rows of the direction board, in order: the fixed ones around one per section.
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

function rowInfo(id) {
  if (id.startsWith("section:")) {
    const role = id.slice("section:".length)
    return {
      title: role.charAt(0).toUpperCase() + role.slice(1).replace(/-/g, " "),
      layout: true,
    }
  }
  return FIXED_ROWS[id]
}

// One letter per row: the fixed ones, then each section's first free letter
// (never A or B, which name the sites).
export function rowLetters(ids) {
  const used = new Set([
    "A",
    "B",
    ...ids.filter((id) => FIXED_ROWS[id]).map((id) => FIXED_ROWS[id].letter),
  ])
  const letters = {}
  for (const id of ids) {
    if (FIXED_ROWS[id]) {
      letters[id] = FIXED_ROWS[id].letter
      continue
    }
    const role = id
      .slice("section:".length)
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
    const pick = [...role, ..."CDEGIJKNOQRUVWYZ"].find((c) => !used.has(c)) ?? "?"
    used.add(pick)
    letters[id] = pick
  }
  return letters
}

// ---------------------------------------------------------------------------
// Data checks. Each returns a list of problems; an empty list means usable.

function checkFont(f, at) {
  const p = []
  if (!f || typeof f !== "object") return [`${at}: missing`]
  if (!isText(f.family)) p.push(`${at}.family: missing`)
  if (f.axes !== undefined && !/^[a-z,]+@[0-9.,;]+$/i.test(f.axes)) {
    p.push(`${at}.axes: expected Google Fonts axes, like "wght@400..900"`)
  }
  if (!isOpenLicence(f.licence)) {
    p.push(
      `${at}.licence: "${f.licence ?? ""}" is not an open licence. Use one of ${OPEN_LICENCES.join(", ")}; ` +
        `when a reference's font is not open, use the closest open-licence font instead (RULES.md rule 5)`
    )
  }
  return p
}

function checkFonts(font, at) {
  if (!font || typeof font !== "object")
    return [`${at}: missing, expected { display, text }`]
  return [
    ...checkFont(font.display, `${at}.display`),
    ...checkFont(font.text, `${at}.text`),
  ]
}

function checkPalette(palette, at) {
  if (!palette || typeof palette !== "object")
    return [`${at}: missing, expected ${PALETTE_ROLES.join(", ")}`]
  return PALETTE_ROLES.filter((r) => !isHex(palette[r])).map(
    (r) => `${at}.${r}: expected #rrggbb`
  )
}

// Mocks are drawn, not loaded: no scripts, handlers, links out or pictures.
const FORBIDDEN_IN_MOCKS = [
  [/<script/i, "a script"],
  [/\son[a-z]+\s*=/i, "an event handler"],
  [/javascript:/i, "a javascript: link"],
  [/https?:\/\//i, "an outside address"],
  [/@import/i, "an @import"],
  [/url\(/i, "a url()"],
  [/<(img|iframe|object|embed|link|video|audio|source)\b/i, "an embedded file"],
  [/\ssrc\s*=/i, "a src attribute"],
]

export function checkMock(html, at) {
  if (!isText(html)) return [`${at}: missing, expected an HTML fragment`]
  return FORBIDDEN_IN_MOCKS.filter(([re]) => re.test(html)).map(
    ([, what]) => `${at}: must not contain ${what}`
  )
}

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
        if (!isHex(c?.hex)) p.push(`${at}.colours[${j}].hex: expected #rrggbb`)
      })
    if (
      s?.measured !== undefined &&
      !(
        Array.isArray(s.measured) &&
        s.measured.every((m) => isText(m?.label) && isText(m?.value))
      )
    ) {
      p.push(`${at}.measured: expected a list of { label, value }`)
    }
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

function checkStudy(data) {
  const p = []
  for (const letter of ["A", "B"]) {
    const s = data.sites?.[letter]?.study
    const at = `sites.${letter}.study`
    if (!s) {
      p.push(`${at}: missing, expected { type, colours, layout, motion }`)
      continue
    }
    for (const f of ["type", "layout", "motion"])
      if (!isText(s[f])) p.push(`${at}.${f}: missing`)
    if (
      !Array.isArray(s.colours) ||
      s.colours.length === 0 ||
      s.colours.some((c) => !isHex(c?.hex))
    ) {
      p.push(`${at}.colours: expected a list of { hex, name }`)
    }
    if (
      s.more !== undefined &&
      !(
        Array.isArray(s.more) && s.more.every((m) => isText(m?.label) && isText(m?.value))
      )
    ) {
      p.push(`${at}.more: expected a list of { label, value }`)
    }
  }
  const st = data.study
  if (
    !Array.isArray(st?.principles) ||
    st.principles.length === 0 ||
    st.principles.some((x) => !isText(x?.title) || !isText(x?.text))
  ) {
    p.push("study.principles: expected a list of { title, text }")
  }
  if (
    !Array.isArray(st?.avoid) ||
    st.avoid.length === 0 ||
    st.avoid.some((x) => !isText(x))
  ) {
    p.push("study.avoid: expected a list of what taste says to avoid")
  }
  return p
}

function checkVerdict(v, at) {
  if (!v || typeof v.passes !== "boolean")
    return [
      `${at}.verdict: expected { "passes": true } or { "passes": false, "rule", "why" }`,
    ]
  if (!v.passes && (!isText(v.rule) || !isText(v.why)))
    return [`${at}.verdict: a waived rule needs "rule" and "why"`]
  return []
}

function checkShots(shots, at, required, folder) {
  const p = []
  if (shots === undefined)
    return required
      ? [`${at}.shots: needs the desktop and mobile shots from the site`]
      : []
  if (!isText(shots?.desktop) || !isText(shots?.mobile))
    return [`${at}.shots: give both desktop and mobile`]
  for (const f of [shots.desktop, shots.mobile]) {
    if (folder && !f.startsWith(`${folder}/`))
      p.push(`${at}: picture "${f}" is not in that site's folder (${folder}/)`)
  }
  return p
}

function checkOption(row, letter, o, sites) {
  const p = []
  const at = `rows "${row.id}" option ${letter}`
  if (!o || typeof o !== "object") return [`${at}: missing`]
  for (const f of ["name", "summary", "twist", "feelsLike"])
    if (!isText(o[f])) p.push(`${at}.${f}: missing`)
  p.push(...checkVerdict(o.verdict, at))
  p.push(...checkMock(o.mock, `${at}.mock`))
  const info = rowInfo(row.id)
  if (info.compares === "font") {
    p.push(...checkFonts(o.font, `${at}.font`))
    if (!isText(o.type?.reference?.display) || !isText(o.type?.reference?.text)) {
      p.push(`${at}.type.reference: needs the site's display and text fonts`)
    }
  } else if (o.font !== undefined)
    p.push(`${at}.font: this row takes its fonts from the row's look`)
  if (info.compares === "palette") p.push(...checkPalette(o.palette, `${at}.palette`))
  else if (o.palette !== undefined)
    p.push(`${at}.palette: this row takes its palette from the row's look`)
  p.push(...checkShots(o.shots, at, !!info.layout, sites?.[letter]?.id))
  return p
}

function checkExtras(row, sites) {
  const p = []
  if (!Array.isArray(row.options) || row.options.length === 0)
    return ['rows "extras".options: expected a list of extras']
  const ids = new Set()
  row.options.forEach((o, i) => {
    const at = `rows "extras" option ${i + 1}`
    if (!/^[a-z0-9-]+$/.test(o?.id ?? "")) p.push(`${at}.id: expected a slug`)
    else if (ids.has(o.id)) p.push(`${at}.id: "${o.id}" is used twice`)
    else ids.add(o.id)
    if (o?.from !== "A" && o?.from !== "B") p.push(`${at}.from: expected "A" or "B"`)
    for (const f of ["name", "summary", "twist", "feelsLike"])
      if (!isText(o?.[f])) p.push(`${at}.${f}: missing`)
    p.push(...checkVerdict(o?.verdict, at))
    p.push(...checkMock(o?.mock, `${at}.mock`))
    if (o?.font !== undefined || o?.palette !== undefined)
      p.push(`${at}: extras take their fonts and palette from the row's look`)
    p.push(...checkShots(o?.shots, at, false, sites?.[o?.from]?.id))
  })
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
  if (sites?.A && sites?.B) p.push(...checkStudy(data))
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
  const allowed = [...want, "extras"]
  want
    .filter((id) => !have.includes(id))
    .forEach((id) => p.push(`rows: no row for "${id}"`))
  have
    .filter((id) => !allowed.includes(id))
    .forEach((id) =>
      p.push(`rows: "${id}" is not a board row (rows are ${allowed.join(", ")})`)
    )
  const expected = have.includes("extras") ? [...want, "extras"] : want
  if (p.length === 0 && have.join() !== expected.join())
    p.push(`rows: expected this order: ${expected.join(", ")}`)
  for (const row of rows) {
    if (!allowed.includes(row?.id)) continue
    const info = rowInfo(row.id)
    if (!isText(row.purpose))
      p.push(`rows "${row.id}".purpose: missing, one line on what the row decides`)
    const look = row.look ?? {}
    if (info.compares !== "font")
      p.push(...checkFonts(look.font, `rows "${row.id}".look.font`))
    else if (look.font !== undefined)
      p.push(`rows "${row.id}".look.font: each option sets its own fonts in this row`)
    if (info.compares !== "palette")
      p.push(...checkPalette(look.palette, `rows "${row.id}".look.palette`))
    else if (look.palette !== undefined)
      p.push(
        `rows "${row.id}".look.palette: each option sets its own palette in this row`
      )
    if (row.id === "extras") {
      p.push(...checkExtras(row, sites))
      continue
    }
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
  const options = data.rows.flatMap((r) =>
    r.id === "extras" ? r.options : [r.options.A, r.options.B]
  )
  return options.flatMap((o) => [o.shots?.desktop, o.shots?.mobile]).filter(isText)
}

export function checkImages(board, data, refsDir) {
  return imagesOf(board, data)
    .filter((f) => !existsSync(join(refsDir, f)))
    .map((f) => `picture missing: ${join(refsDir, f)}`)
}

// ---------------------------------------------------------------------------
// Fonts.

function fontsOf(data) {
  const out = []
  for (const row of data.rows) {
    if (row.look?.font) out.push(row.look.font.display, row.look.font.text)
    if (row.id !== "extras")
      for (const l of ["A", "B"])
        if (row.options[l].font)
          out.push(row.options[l].font.display, row.options[l].font.text)
  }
  return out
}

// One Google Fonts request for the board's face and every face the mocks use.
export function googleFontsHref(specs) {
  const byFamily = new Map()
  for (const f of [CHROME_FONT, ...specs]) {
    const prev = byFamily.get(f.family)
    if (prev !== undefined && prev !== (f.axes ?? "")) {
      throw new BoardError([
        `fonts: "${f.family}" is asked for with two different axes ("${prev}" and "${f.axes ?? ""}")`,
      ])
    }
    byFamily.set(f.family, f.axes ?? "")
  }
  const query = [...byFamily]
    .map(
      ([family, axes]) =>
        `family=${encodeURIComponent(family.trim()).replace(/%20/g, "+")}${axes ? `:${axes}` : ""}`
    )
    .join("&")
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}

const fontStack = (f, fallback) => `'${f.family.replace(/'/g, "")}', ${fallback}`

function lookVars(font, palette) {
  return [
    `--o-bg:${palette.bg}`,
    `--o-fg:${palette.fg}`,
    `--o-ac:${palette.accent}`,
    `--o-ink:${palette.ink}`,
    `--o-2:${palette.soft}`,
    `--disp:${fontStack(font.display, "Impact, sans-serif")}`,
    `--dw:${font.display.weight ?? 700}`,
    `--ds:${font.display.stretch ?? "100%"}`,
    `--ui:${fontStack(font.text, "system-ui, sans-serif")}`,
    `--tw:${font.text.weight ?? 400}`,
  ].join(";")
}

// ---------------------------------------------------------------------------
// Rendering.

function swatch(hex) {
  return `<span class="sw" style="background:${esc(hex)}"></span>`
}

function siteLink(url, text) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return esc(text ?? url)
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return esc(text ?? url)
  return `<a href="${esc(parsed.href)}" rel="noreferrer">${esc(text ?? parsed.host + parsed.pathname.replace(/\/$/, ""))}</a>`
}

function shotPair(shots, paths, siteName, what) {
  return WIDTHS.map(
    (w) =>
      `<a class="shot ${w.key}" href="${imageSrc(shots[w.key], paths)}" target="_blank" rel="noreferrer"><img src="${imageSrc(
        shots[w.key],
        paths
      )}" alt="${esc(`${siteName}, ${what} at ${w.width} pixels wide`)}" decoding="async"></a>`
  ).join("")
}

function top({ kicker, title, intro, how }) {
  return `<header class="top">
    <span class="kicker">${esc(kicker)}</span>
    <h1>${esc(title)}</h1>
    <p>${intro}</p>
    <div class="how">${how.map((h) => `<span>${h}</span>`).join("")}</div>
  </header>`
}

function renderSiteCard(site, rank, recommended, paths) {
  const id = slugId(site.id)
  const total = weightedScore(site.scores)
  const moments = MOMENTS.map(
    (m) => `<figure class="moment">
      <div class="moment-shots">${shotPair(
        {
          desktop: `${site.id}/${m.key}-1440.png`,
          mobile: `${site.id}/${m.key}-390.png`,
        },
        paths,
        site.name,
        m.label.toLowerCase()
      )}</div>
      <figcaption>${m.label}, at 1440 and 390</figcaption>
    </figure>`
  ).join("")
  const type = site.type
    .map(
      (t) =>
        `${esc(t.role)}: ${esc(t.family)}${[t.size, t.weight].filter(Boolean).length ? `, ${esc([t.size, t.weight].filter(Boolean).join(" at "))}` : ""}`
    )
    .join("<br>")
  const colours = site.colours
    .map(
      (c) =>
        `${swatch(c.hex)}${esc(c.hex.toLowerCase())}${isText(c.role) ? ` ${esc(c.role)}` : ""}`
    )
    .join(" · ")
  const measured = (site.measured ?? [])
    .map((m) => `<dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd>`)
    .join("")
  const scores = CRITERIA.map(
    (c) =>
      `<tr><th scope="row">${esc(c.label)}</th><td>${c.weight}%</td><td>${esc(site.scores[c.key])} of 5</td></tr>`
  ).join("")
  return `<li class="site${recommended ? " is-recommended" : ""}" id="site-${id}">
  <article class="ref" aria-labelledby="site-${id}-name">
    <div class="site-head">
      <div class="opt-meta"><span class="code">${rank}</span><h3 id="site-${id}-name">${esc(site.name)}</h3>${
        recommended ? `<span class="rec">Recommended</span>` : ""
      }</div>
      <p class="site-line">${siteLink(site.url)} · ranked ${rank} of 5 · weighted score <b>${total.toFixed(2)}</b> of 5</p>
    </div>
    <div class="site-body">
      <div class="moments">${moments}</div>
      <div class="facts">
        <dl>
          <dt>Strongest idea</dt><dd>${esc(site.strongestIdea)}</dd>
          <dt>Borrow, with a twist</dt><dd>${esc(site.borrow)}</dd>
          <dt>Risk</dt><dd>${esc(site.risk)}</dd>
          <dt>Type</dt><dd>${type}</dd>
          <dt>Colour</dt><dd>${colours}</dd>
          ${measured}
        </dl>
        <table class="scores"><caption>Scores</caption><thead><tr><th scope="col">Criterion</th><th scope="col">Weight</th><th scope="col">Score</th></tr></thead>
        <tbody>${scores}</tbody><tfoot><tr><th scope="row">Weighted</th><td>100%</td><td>${total.toFixed(2)} of 5</td></tr></tfoot></table>
      </div>
    </div>
    <label class="choose"><input type="checkbox" name="finalist" id="pick-${id}" value="${esc(site.id)}" data-name="${esc(
      site.name
    )}"><span>Choose ${esc(site.name)}</span></label>
  </article>
</li>`
}

export function renderFinalists(data, paths) {
  const header = top({
    kicker: data.kicker ?? "Portfolio · references · choose two",
    title: "Pick the two sites this version learns from.",
    intro:
      "The scout's five finalists, best first, each measured from the live site: <b>screenshots at desktop and phone width</b>, type, colour and <b>the weighted scores</b>. Choose any two. Every later choice on the direction board comes from one of them.",
    how: [
      "Pictures open full size in a new tab",
      "The scout's two picks are marked Recommended",
      `When you are done, <a href="#answers-h">copy your answers</a> at the end`,
    ],
  })
  const cards = data.sites
    .map((s, i) => renderSiteCard(s, i + 1, data.recommended.includes(s.id), paths))
    .join("\n")
  const set = data.recommended
    .map((id) => data.sites.find((s) => s.id === id).name)
    .join(" · ")
  return {
    title: "Choose two references",
    fonts: [],
    body: `${header}
  <section class="study" aria-labelledby="study-h">
    <span class="kicker">The scout's finalists</span>
    <h2 id="study-h">Five sites, measured</h2>
    <div class="recset"><span><b>Scout's two</b>${esc(set)}</span></div>
    <ol class="sites">${cards}</ol>
  </section>`,
  }
}

function verdictLine(v) {
  return v.passes
    ? `<p class="taste pass">Taste: passes its rules.</p>`
    : `<p class="taste waive">Taste: needs “${esc(v.rule)}” waived, because ${esc(v.why)}</p>`
}

function mockBlock(o, look, label) {
  const shape = o.mockShape === "wide" || o.mockShape === "tall" ? ` ${o.mockShape}` : ""
  return `<div class="mock${shape}" style="${esc(lookVars(look.font, look.palette))}" role="img" aria-label="${esc(label)}">${o.mock}</div>`
}

function seenOn(o, site, paths, what) {
  if (!o.shots) return ""
  return `<figure class="seen"><div class="seen-shots">${shotPair(o.shots, paths, site.name, what)}</div><figcaption>As seen on ${esc(
    site.name
  )}</figcaption></figure>`
}

function optionText(o, recommendedReason) {
  return `<p>${esc(o.summary)}</p>
      <p class="twist"><b>Twist:</b> ${esc(o.twist)}</p>
      <p class="feels">Feels like: ${esc(o.feelsLike)}</p>
      ${verdictLine(o.verdict)}
      ${recommendedReason ? `<p class="taste rec-why">Taste recommends this: ${esc(recommendedReason)}</p>` : ""}`
}

function renderChoiceRow(row, number, letter, data, paths) {
  const id = slugId(row.id)
  const info = rowInfo(row.id)
  const title = row.title ?? info.title
  const options = ["A", "B"]
    .map((l) => {
      const o = row.options[l]
      const site = data.sites[l]
      const code = `${l}${number}`
      const look = {
        font: info.compares === "font" ? o.font : row.look.font,
        palette: info.compares === "palette" ? o.palette : row.look.palette,
      }
      const recommended = row.recommended === l
      const fontNote =
        info.compares === "font"
          ? `<p class="fontpair">On ${esc(site.name)}: ${esc(o.type.reference.display)} and ${esc(o.type.reference.text)}. Used here: <b>${esc(
              o.font.display.family
            )}</b> and <b>${esc(o.font.text.family)}</b> (${esc(
              [...new Set([o.font.display.licence, o.font.text.licence])].join(", ")
            )})${
              o.type.reference.display.toLowerCase() ===
              o.font.display.family.toLowerCase()
                ? ""
                : ", the closest open-licence fonts"
            }.</p>`
          : ""
      return `<article class="opt${recommended ? " is-recommended" : ""}" data-option="${id}-${l}">
        ${mockBlock(o, look, `${o.name}, drawn in ${look.font.display.family}: ${o.summary}`)}
        ${seenOn(o, site, paths, title.toLowerCase())}
        <div class="opt-meta"><span class="code">${code}</span><h3 id="name-${id}-${l}">${esc(o.name)}</h3><span class="from">${esc(
          site.name
        )}</span>${recommended ? `<span class="rec">Recommended</span>` : ""}</div>
        <div class="opt-text" id="desc-${id}-${l}">${fontNote}${optionText(o, recommended ? row.reason : null)}</div>
        <label class="choose"><input type="radio" name="row-${id}" id="opt-${id}-${l}" value="${l}" data-row="${esc(
          row.id
        )}" data-from="${esc(site.id)}" data-code="${code}" aria-describedby="name-${id}-${l} desc-${id}-${l}"><span>Choose ${code}</span></label>
      </article>`
    })
    .join("")
  return `<section class="row" id="row-${id}" data-row="${esc(row.id)}" data-kind="choice" aria-labelledby="row-${id}-h">
    <div class="row-h"><span class="letter">${letter}</span><h2 id="row-${id}-h">${esc(title)}</h2><p>${esc(row.purpose)}</p></div>
    <div class="opts" role="radiogroup" aria-labelledby="row-${id}-h">${options}</div>
    <div class="row-note"><label for="note-${id}">Note on ${esc(title.toLowerCase())}, if any</label><textarea id="note-${id}" data-row="${esc(
      row.id
    )}" rows="2"></textarea></div>
  </section>`
}

function renderExtrasRow(row, data, paths) {
  const title = row.title ?? FIXED_ROWS.extras.title
  const options = row.options
    .map((o, i) => {
      const site = data.sites[o.from]
      const code = `X${i + 1}`
      const oid = slugId(o.id)
      return `<article class="opt${o.recommended ? " is-recommended" : ""}" data-option="extras-${oid}">
        ${mockBlock(o, row.look, `${o.name}: ${o.summary}`)}
        ${seenOn(o, site, paths, o.name.toLowerCase())}
        <div class="opt-meta"><span class="code">${code}</span><h3 id="name-x-${oid}">${esc(o.name)}</h3><span class="from">${esc(
          site.name
        )}</span>${o.recommended ? `<span class="rec">Recommended</span>` : ""}</div>
        <div class="opt-text" id="desc-x-${oid}">${optionText(o, o.recommended ? (o.reason ?? null) : null)}</div>
        <label class="choose"><input type="checkbox" name="extras" id="opt-x-${oid}" value="${esc(o.id)}" data-code="${code}" data-from="${esc(
          site.id
        )}" aria-describedby="name-x-${oid} desc-x-${oid}"><span>Add ${code}</span></label>
      </article>`
    })
    .join("")
  return `<section class="row" id="row-extras" data-row="extras" data-kind="extras" aria-labelledby="row-extras-h">
    <div class="row-h"><span class="letter">X</span><h2 id="row-extras-h">${esc(title)}</h2><p>${esc(row.purpose)}</p></div>
    <div class="opts" role="group" aria-labelledby="row-extras-h">${options}</div>
    <div class="row-note"><label for="note-extras">Note on the extras, if any</label><textarea id="note-extras" data-row="extras" rows="2"></textarea></div>
  </section>`
}

function renderStudy(data) {
  const card = (letter) => {
    const site = data.sites[letter]
    const s = site.study
    const colours = s.colours
      .map((c) => `${swatch(c.hex)}${esc(c.name ?? c.hex.toLowerCase())}`)
      .join(" · ")
    const more = (s.more ?? [])
      .map((m) => `<dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd>`)
      .join("")
    return `<article class="ref">
      <h3>${esc(site.name)}${site.url ? ` <span class="ref-url">${siteLink(site.url)}</span>` : ""}</h3>
      <dl>
        <dt>Type</dt><dd>${esc(s.type)}</dd>
        <dt>Colour</dt><dd>${colours}</dd>
        <dt>Layout</dt><dd>${esc(s.layout)}</dd>
        <dt>Motion</dt><dd>${esc(s.motion)}</dd>
        ${more}
      </dl>
    </article>`
  }
  const principles = data.study.principles
    .map((x) => `<li><b>${esc(x.title)}</b><span>${esc(x.text)}</span></li>`)
    .join("")
  const avoid = data.study.avoid.map((x) => `<li>${esc(x)}</li>`).join("")
  return `<section class="study" aria-labelledby="study-h">
    <span class="kicker">The homework</span>
    <h2 id="study-h">${esc(data.study.title ?? "What makes the two sites feel expensive")}</h2>
    <div class="refs">${card("A")}${card("B")}</div>
    <ol class="principles">${principles}</ol>
    <div class="verdict"><span class="kicker">What taste says to avoid</span><ul>${avoid}</ul></div>
  </section>`
}

export function renderDirection(data, paths) {
  const choiceRows = data.rows.filter((r) => r.id !== "extras")
  const letters = rowLetters(data.rows.map((r) => r.id))
  const rows = data.rows
    .map((r) =>
      r.id === "extras"
        ? renderExtrasRow(r, data, paths)
        : renderChoiceRow(r, choiceRows.indexOf(r) + 1, letters[r.id], data, paths)
    )
    .join("\n")
  const extras = data.rows.find((r) => r.id === "extras")
  const set = [
    ...choiceRows.map((r, i) => `${r.recommended}${i + 1}`),
    ...(extras
      ? extras.options.map((o, i) => (o.recommended ? `X${i + 1}` : null)).filter(Boolean)
      : []),
  ].join(" · ")
  const header = top({
    kicker:
      data.kicker ??
      `Portfolio · ${data.sites.A.name} and ${data.sites.B.name} · choose before I build`,
    title: "Pick the portfolio this version becomes.",
    intro: `Each row below is one decision. Every option is drawn live in its <b>real fonts and colours</b>, filled with <b>your real content</b>, with the reference it comes from shown small beneath it. Pick one per row, from ${esc(
      data.sites.A.name
    )} (A) or ${esc(data.sites.B.name)} (B); the extras row takes several.`,
    how: [
      "Codes name the site and the row: A3 is site A's option in row 3",
      "Taste's verdict sits under every option; the choice is yours",
      `When you are done, <a href="#answers-h">copy your answers</a> at the end`,
    ],
  })
  return {
    title: "Choose the direction",
    fonts: fontsOf(data),
    body: `${header}
  ${renderStudy(data).replace("</section>", `<div class="recset" aria-label="Taste's set"><span><b>Taste's set</b>${esc(set)}</span></div></section>`)}
  ${rows}`,
  }
}

export function buildPage(board, data, { refsDir, outFile, template }) {
  const problems = board === "finalists" ? checkFinalists(data) : checkDirection(data)
  if (problems.length) throw new BoardError(problems)
  const missing = checkImages(board, data, refsDir)
  if (missing.length) throw new BoardError(missing)
  const paths = { refsDir, outFile }
  const page =
    board === "finalists" ? renderFinalists(data, paths) : renderDirection(data, paths)
  const fontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(
    googleFontsHref(page.fonts)
  )}">`
  const fill = {
    "<!-- board:title -->": esc(page.title),
    "<!-- board:fonts -->": fontLinks,
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
  const choiceRows = data.rows.filter((r) => r.id !== "extras")
  const want = choiceRows.map((r) => r.id)
  want
    .filter((id) => !(id in choices))
    .forEach((id) => p.push(`choices: no choice for "${id}"`))
  Object.keys(choices)
    .filter((id) => !want.includes(id))
    .forEach((id) => p.push(`choices: "${id}" is not a row on the board`))
  choiceRows.forEach((row, i) => {
    const c = choices[row.id]
    if (!c) return
    if (c.site !== "A" && c.site !== "B") {
      p.push(`choices "${row.id}".site: expected "A" or "B"`)
      return
    }
    if (c.from !== undefined && c.from !== data.sites[c.site].id) {
      p.push(
        `choices "${row.id}": site ${c.site} is ${data.sites[c.site].id}, not "${c.from}"`
      )
    }
    if (c.code !== undefined && c.code !== `${c.site}${i + 1}`)
      p.push(`choices "${row.id}".code: expected ${c.site}${i + 1}, found ${c.code}`)
    if (c.note !== undefined && typeof c.note !== "string")
      p.push(`choices "${row.id}".note: expected text`)
  })
  const extras = data.rows.find((r) => r.id === "extras")
  if (answers.extras !== undefined) {
    if (!extras) p.push("extras: this board has no extras row")
    else if (!Array.isArray(answers.extras?.picked))
      p.push("extras.picked: expected a list of extra ids")
    else {
      const ids = extras.options.map((o) => o.id)
      const picked = answers.extras.picked
      if (new Set(picked).size !== picked.length)
        p.push("extras.picked: an extra is listed twice")
      picked
        .filter((id) => !ids.includes(id))
        .forEach((id) => p.push(`extras.picked: "${id}" is not on the board`))
    }
  } else if (extras)
    p.push("extras: missing, expected { picked: [...] } (it may be empty)")
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
