#!/usr/bin/env node
// Draws the placeholder pictures for the board fixtures into fixtures/refs/.
// They stand in for the scout's screenshots, at half size to keep them small.
//
//   node .claude/skills/board/test/fixtures/make-images.mjs
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { launch } from "../browser.mjs"

const refs = join(dirname(fileURLToPath(import.meta.url)), "refs")

const SITES = [
  { id: "alder", name: "Alder", ground: "#1f2a24", ink: "#e9efe6", accent: "#c8f169" },
  { id: "birch", name: "Birch", ground: "#f4f1ea", ink: "#1b1b1b", accent: "#d2452c" },
  { id: "cedar", name: "Cedar", ground: "#0f1724", ink: "#f2f4f8", accent: "#5aa9ff" },
  {
    id: "dogwood",
    name: "Dogwood",
    ground: "#fbeee8",
    ink: "#2a1a14",
    accent: "#2b6f5e",
  },
  { id: "elm", name: "Elm", ground: "#e9e9e4", ink: "#111111", accent: "#ff5a1f" },
]
// One screen at each width, at half size.
const SCREEN = { 1440: [720, 450], 390: [195, 422] }
// The sections of the two sites used on the direction board, with their heights.
const SECTIONS = [
  ["hero", 450, 422],
  ["about", 300, 520],
  ["work", 520, 760],
  ["contact", 280, 400],
  ["footer", 180, 260],
]

function html(site, label, width, height) {
  const narrow = width < 400
  return `<!doctype html><html><body style="margin:0;width:${width}px;height:${height}px;background:${site.ground};color:${site.ink};font:600 ${narrow ? 13 : 22}px/1.2 system-ui;overflow:hidden">
  <div style="padding:${narrow ? 10 : 24}px;display:grid;gap:${narrow ? 8 : 14}px">
    <div style="font-size:${narrow ? 18 : 40}px;letter-spacing:-0.02em">${site.name} (fixture)</div>
    <div>${label}</div>
    <div style="height:${narrow ? 40 : 90}px;background:${site.accent}"></div>
    <div style="display:grid;grid-template-columns:repeat(${narrow ? 1 : 3},1fr);gap:${narrow ? 6 : 12}px">
      <div style="height:${narrow ? 24 : 60}px;background:${site.ink};opacity:.18"></div>
      <div style="height:${narrow ? 24 : 60}px;background:${site.ink};opacity:.18"></div>
      <div style="height:${narrow ? 24 : 60}px;background:${site.ink};opacity:.18"></div>
    </div>
  </div></body></html>`
}

const browser = await launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
async function shoot(site, label, [width, height], file, type) {
  await page.setViewportSize({ width, height })
  await page.setContent(html(site, label, width, height))
  const opts = type === "jpeg" ? { type, quality: 80 } : { type }
  await page.screenshot({ path: join(refs, site.id, file), ...opts })
}

for (const site of SITES) {
  mkdirSync(join(refs, site.id), { recursive: true })
  for (const moment of ["hero", "middle", "footer"]) {
    for (const width of [1440, 390]) {
      await shoot(
        site,
        `${moment}, ${width}`,
        SCREEN[width],
        `${moment}-${width}.png`,
        "png"
      )
    }
  }
}
for (const site of SITES.filter((s) => ["alder", "cedar"].includes(s.id))) {
  for (const [i, [role, desktopHeight, mobileHeight]] of SECTIONS.entries()) {
    const nn = String(i + 1).padStart(2, "0")
    await shoot(
      site,
      `${role}, 1440`,
      [720, desktopHeight],
      `section-${nn}-1440.jpg`,
      "jpeg"
    )
    await shoot(
      site,
      `${role}, 390`,
      [195, mobileHeight],
      `section-${nn}-390.jpg`,
      "jpeg"
    )
  }
}
await browser.close()
console.log(`make-images: wrote the fixture pictures to ${refs}`)
