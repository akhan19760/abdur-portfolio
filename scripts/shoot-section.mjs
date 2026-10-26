#!/usr/bin/env node
// Screenshots of one section for the owner's review, at 1440 and 390.
//
//   node scripts/shoot-section.mjs <url> <slug> [--out .taste-skill/review]
//
// The section's root element carries id="<slug>". Writes <slug>-1440.png and
// <slug>-390.png (the whole section) into the out folder.
import { mkdirSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { launch } from "./lib/browser.mjs"

const args = process.argv.slice(2)
const [url, slug] = args.filter(
  (a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")
)
const outIdx = args.indexOf("--out")
const out = resolve(outIdx === -1 ? join(".taste-skill", "review") : args[outIdx + 1])
if (!url || !/^[a-z0-9-]+$/.test(slug ?? "")) {
  console.error("usage: node scripts/shoot-section.mjs <url> <slug> [--out dir]")
  process.exit(2)
}
mkdirSync(out, { recursive: true })

const browser = await launch()
let failed = false
for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: width < 600,
    hasTouch: width < 600,
  })
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 })
  await page.evaluate(() => document.fonts.ready)
  const section = page.locator(`#${slug}`)
  if ((await section.count()) === 0) {
    console.error(`shoot-section: no element with id="${slug}" at ${url}`)
    failed = true
    await page.close()
    break
  }
  await section.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200) // let the section's entrance finish
  const file = join(out, `${slug}-${width}.png`)
  await section.screenshot({ path: file, timeout: 30000 })
  console.log(`shoot-section: ${relative(process.cwd(), file).split("\\").join("/")}`)
  await page.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
