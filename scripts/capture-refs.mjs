#!/usr/bin/env node
// Capture a reference site for the scout: screenshots and measurements.
//
//   node scripts/capture-refs.mjs <url> <slug>
//
// Writes workflow/refs/<slug>/ for each width (1440 and 390):
//   hero-<w>.png, middle-<w>.png, footer-<w>.png   one screen each
//   full-<w>.jpg                                    the whole page
//   section-NN-<w>.jpg                              one per visible section
// plus measure.json with the computed fonts, sizes and colours of key
// elements, and each section's box and label. The JPEGs are quality 80.
// Screenshots stay local: .gitignore keeps workflow/refs images out of git.
// Uses Playwright's Chromium, or an installed Chrome or Edge.
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "playwright"

const [url, slug] = process.argv.slice(2)
if (!url || !slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error("usage: node scripts/capture-refs.mjs <url> <slug>   (slug: a-z, 0-9, -)")
  process.exit(2)
}
const outDir = join("workflow", "refs", slug)
mkdirSync(outDir, { recursive: true })

const JPEG = { type: "jpeg", quality: 80 }
// Sections shorter than this are bars or spacers, not sections.
const MIN_SECTION_HEIGHT = 80
const MAX_SECTIONS = 20

async function launch() {
  for (const opts of [{}, { channel: "chrome" }, { channel: "msedge" }]) {
    try {
      return await chromium.launch(opts)
    } catch {
      /* try the next browser */
    }
  }
  throw new Error("No browser found. Run: pnpm exec playwright install chromium")
}

// Scroll in steps so scroll-driven content has a chance to appear.
async function scrollTo(page, y) {
  await page.evaluate(async (to) => {
    const step = window.innerHeight / 2
    for (let p = window.scrollY; Math.abs(p - to) > step; p += Math.sign(to - p) * step) {
      window.scrollTo(0, p)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, to)
  }, y)
}

// Finds the page's sections (header, the children of main, top-level
// sections, footer), tags each with data-capture-section and returns their
// boxes in page coordinates with a short label.
function findSections({ minHeight, max }) {
  const visible = (el) => {
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return (
      s.display !== "none" &&
      s.visibility !== "hidden" &&
      Number(s.opacity) > 0 &&
      r.height >= minHeight &&
      r.width >= window.innerWidth / 2
    )
  }
  const main = document.querySelector("main")
  let found = [
    ...document.querySelectorAll("body > header, body > section, body > footer"),
    ...(main ? main.children : []),
    ...document.querySelectorAll("header, footer"),
  ]
  // A wrapper that holds several sections is split into them.
  found = found.flatMap((el) => {
    const inner = [...el.querySelectorAll(":scope > section, :scope > * > section")]
    return el.getBoundingClientRect().height > window.innerHeight * 2.5 &&
      inner.length >= 2
      ? inner
      : [el]
  })
  let unique = [...new Set(found)].filter(visible)
  // Apps that wrap everything in a div#root have no main: use every section.
  if (unique.length < 2)
    unique = [...new Set([...unique, ...document.querySelectorAll("section")])].filter(
      visible
    )
  const top = (el) => el.getBoundingClientRect().top + window.scrollY
  // Top first; on a tie the taller one, so a section beats a header inside it.
  unique.sort((a, b) => top(a) - top(b) || b.offsetHeight - a.offsetHeight)
  const kept = []
  for (const el of unique) {
    if (!kept.some((k) => k.contains(el) || el.contains(k))) kept.push(el)
  }
  return kept.slice(0, max).map((el, i) => {
    el.setAttribute("data-capture-section", String(i + 1))
    const r = el.getBoundingClientRect()
    const heading = el.querySelector("h1, h2, h3")
    const label =
      heading?.textContent ||
      el.getAttribute("aria-label") ||
      el.id ||
      `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/)[0] : ""}`
    return {
      index: i + 1,
      box: {
        x: Math.round(r.left + window.scrollX),
        y: Math.round(r.top + window.scrollY),
        width: Math.round(r.width),
        height: Math.round(r.height),
      },
      label: label.replace(/\s+/g, " ").trim().slice(0, 60),
    }
  })
}

// Hides (or shows again) the fixed and sticky elements outside one section.
function toggleFloating({ index, hide }) {
  if (!hide) {
    document.querySelectorAll("[data-capture-hidden]").forEach((el) => {
      el.style.visibility = el.getAttribute("data-capture-hidden")
      el.removeAttribute("data-capture-hidden")
    })
    return
  }
  const target = document.querySelector(`[data-capture-section="${index}"]`)
  for (const el of document.body.querySelectorAll("*")) {
    const { position } = getComputedStyle(el)
    if (position !== "fixed" && position !== "sticky") continue
    if (target.contains(el) || el.contains(target)) continue
    el.setAttribute("data-capture-hidden", el.style.visibility)
    el.style.visibility = "hidden"
  }
}

const browser = await launch()
const measure = { url, capturedAt: new Date().toISOString(), viewports: {} }

for (const [label, width, height] of [
  ["desktop", 1440, 900],
  ["mobile", 390, 844],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: width < 600,
    hasTouch: width < 600,
  })
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2500)

  const total = await page.evaluate(() => document.documentElement.scrollHeight)
  const shots = {
    hero: 0,
    middle: Math.max(0, total / 2 - height / 2),
    footer: Math.max(0, total - height),
  }
  for (const [name, y] of Object.entries(shots)) {
    await scrollTo(page, y)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: join(outDir, `${name}-${width}.png`) })
  }

  // The whole page, after one pass to the bottom so lazy content has loaded.
  await scrollTo(page, total)
  await page.waitForTimeout(800)
  await scrollTo(page, 0)
  await page.waitForTimeout(800)
  await page.screenshot({
    path: join(outDir, `full-${width}.jpg`),
    fullPage: true,
    ...JPEG,
  })

  // One shot per section, taken with the section scrolled into view.
  const sections = await page.evaluate(findSections, {
    minHeight: MIN_SECTION_HEIGHT,
    max: MAX_SECTIONS,
  })
  const sectionShots = []
  for (const s of sections) {
    const file = `section-${String(s.index).padStart(2, "0")}-${width}.jpg`
    await scrollTo(page, s.box.y)
    await page.waitForTimeout(800)
    // A fixed or sticky bar from elsewhere on the page would cover the shot.
    await page.evaluate(toggleFloating, { index: s.index, hide: true })
    try {
      await page
        .locator(`[data-capture-section="${s.index}"]`)
        .screenshot({ path: join(outDir, file), ...JPEG, timeout: 15000 })
      sectionShots.push({ file, ...s })
    } catch (err) {
      sectionShots.push({ file: null, ...s, error: err.message.split("\n")[0] })
    }
    await page.evaluate(toggleFloating, { index: s.index, hide: false })
  }

  measure.viewports[label] = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const s = getComputedStyle(el)
      return {
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        color: s.color,
        textTransform: s.textTransform,
      }
    }
    const body = getComputedStyle(document.body)
    const header = document.querySelector("header, nav")
    const radii = new Set()
    document.querySelectorAll("a, button, img, section > div").forEach((el) => {
      const r = getComputedStyle(el).borderRadius
      if (r && r !== "0px") radii.add(r)
    })
    return {
      title: document.title,
      pageHeight: document.documentElement.scrollHeight,
      background: body.backgroundColor,
      text: body.color,
      h1: pick("h1"),
      h2: pick("h2"),
      p: pick("p"),
      a: pick("a"),
      headerHeight: header ? header.getBoundingClientRect().height : null,
      radii: [...radii].slice(0, 12),
      fontsLoaded: [...document.fonts]
        .filter((f) => f.status === "loaded")
        .map((f) => f.family),
      tech: {
        gsap: typeof window.gsap !== "undefined",
        lenis: !!document.querySelector("html.lenis, .lenis"),
        webgl: !!document.querySelector("canvas"),
      },
      sections: [...document.querySelectorAll("main > *, body > section, section")]
        .slice(0, 20)
        .map((s) => (s.id || s.className || s.tagName).toString().slice(0, 60)),
    }
  })
  measure.viewports[label].sectionShots = sectionShots
  await page.close()
}

await browser.close()
writeFileSync(join(outDir, "measure.json"), JSON.stringify(measure, null, 2) + "\n")
console.log(`capture-refs: saved screenshots and measure.json to ${outDir}`)
