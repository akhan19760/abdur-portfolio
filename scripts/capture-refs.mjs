#!/usr/bin/env node
// Capture a reference site for the scout: screenshots and measurements.
//
//   node scripts/capture-refs.mjs <url> <slug>
//
// Writes workflow/refs/<slug>/: hero, middle and footer screenshots at 1440px
// and 390px, plus measure.json with the computed fonts, sizes and colours of
// key elements. Uses Playwright's Chromium, or an installed Chrome or Edge.
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
    // Scroll in steps so scroll-driven content has a chance to appear.
    await page.evaluate(async (to) => {
      const step = window.innerHeight / 2
      for (
        let p = window.scrollY;
        Math.abs(p - to) > step;
        p += Math.sign(to - p) * step
      ) {
        window.scrollTo(0, p)
        await new Promise((r) => setTimeout(r, 120))
      }
      window.scrollTo(0, to)
    }, y)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: join(outDir, `${name}-${width}.png`) })
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
  await page.close()
}

await browser.close()
writeFileSync(join(outDir, "measure.json"), JSON.stringify(measure, null, 2) + "\n")
console.log(`capture-refs: saved screenshots and measure.json to ${outDir}`)
