#!/usr/bin/env node
// Builds both boards from the fixtures and checks them in a real browser at
// 1440 and 390: screenshots, console errors, outside requests, axe, keyboard
// and the copied answers. Writes into test/out/ (not committed).
//
//   pnpm board:check
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { buildPage, validateAnswers } from "../build.mjs"
import { launch } from "./browser.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, "fixtures")
const outDir = join(here, "out")
mkdirSync(outDir, { recursive: true })

// axe-core comes with vitest-axe, which the project already uses.
const fromVitestAxe = createRequire(createRequire(import.meta.url).resolve("vitest-axe"))
const axeSource = readFileSync(fromVitestAxe.resolve("axe-core/axe.min.js"), "utf8")

const ALLOWED_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"]
const WIDTHS = [
  [1440, 900],
  [390, 844],
]
const failures = []
const fail = (msg) => failures.push(msg)

const data = {}
for (const board of ["finalists", "direction"]) {
  data[board] = JSON.parse(
    readFileSync(join(fixtures, "boards", `${board}.json`), "utf8")
  )
  const outFile = join(outDir, `${board}.html`)
  writeFileSync(
    outFile,
    buildPage(board, data[board], { refsDir: join(fixtures, "refs"), outFile })
  )
}

const browser = await launch()

async function open(board, [width, height]) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: width < 600,
    hasTouch: width < 600,
  })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
  page.on("pageerror", (e) => errors.push(e.message))
  page.on("request", (r) => {
    const url = new URL(r.url())
    if (
      url.protocol !== "file:" &&
      url.protocol !== "data:" &&
      !ALLOWED_HOSTS.includes(url.host)
    ) {
      errors.push(`outside request: ${r.url()}`)
    }
  })
  await page.goto(pathToFileURL(join(outDir, `${board}.html`)).href, {
    waitUntil: "load",
  })
  await page.evaluate(() => document.fonts.ready)
  return { context, page, errors }
}

async function axe(page) {
  await page.addScriptTag({ content: axeSource })
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
    })
    return r.violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}, ${v.nodes.length} element(s): ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(", ")}`
    )
  })
}

async function answers(page) {
  await page.click("#copy")
  return JSON.parse(await page.inputValue("#answers"))
}

for (const board of ["finalists", "direction"]) {
  for (const size of WIDTHS) {
    const tag = `${board} at ${size[0]}`
    const { context, page, errors } = await open(board, size)
    const broken = await page.evaluate(() =>
      [...document.images]
        .filter((i) => !i.complete || i.naturalWidth === 0)
        .map((i) => i.src)
    )
    broken.forEach((src) => fail(`${tag}: picture did not load: ${src}`))
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    if (overflow > 0) fail(`${tag}: page scrolls sideways by ${overflow}px`)
    await page.screenshot({
      path: join(outDir, `${board}-${size[0]}.png`),
      fullPage: true,
    })
    await page.screenshot({ path: join(outDir, `${board}-${size[0]}-first-screen.png`) })
    for (const v of await axe(page)) fail(`${tag}: axe ${v}`)

    if (board === "finalists") {
      // Copying with fewer than two chosen explains why and copies nothing.
      await page.click("#copy")
      const early = await page.textContent("#status")
      if (!/exactly two/.test(early) || (await page.inputValue("#answers")) !== "") {
        fail(`${tag}: copying with none chosen should refuse, said "${early}"`)
      }
      // Refusing moves focus to the first site's checkbox; Space chooses it.
      const focused = await page.evaluate(() => document.activeElement?.id)
      if (focused !== `pick-${data.finalists.sites[0].id}`) {
        fail(`${tag}: refusing should focus the first checkbox, focused "${focused}"`)
      }
      await page.keyboard.press("Space")
      await page.check(`#pick-${data.finalists.sites[2].id}`)
      const third = data.finalists.sites[4].id
      if (!(await page.isDisabled(`#pick-${third}`)))
        fail(`${tag}: a third site can still be chosen`)
      const got = await answers(page)
      const problems = validateAnswers("finalists", got, data.finalists)
      if (problems.length)
        fail(`${tag}: copied answers are not valid: ${problems.join("; ")}`)
      if (
        got.chosen.join() !==
        [data.finalists.sites[0].id, data.finalists.sites[2].id].join()
      ) {
        fail(`${tag}: copied the wrong sites: ${got.chosen.join(", ")}`)
      }
    } else {
      await page.click("#copy")
      const early = await page.textContent("#status")
      if (!/No choice yet/.test(early))
        fail(`${tag}: copying with rows missing should refuse, said "${early}"`)
      const focused = await page.evaluate(() => document.activeElement?.type)
      if (focused !== "radio")
        fail(`${tag}: refusing should move focus to the first missing row`)
      // Keyboard: arrow keys move within a row's radio group.
      await page.keyboard.press("Space")
      await page.keyboard.press("ArrowRight")
      // A click on an option's mock chooses that option.
      await page.click('[data-option="palette-A"] .mock')
      if (!(await page.isChecked("#opt-palette-A")))
        fail(`${tag}: clicking an option's mock did not choose it`)
      const choiceRows = data.direction.rows.filter((r) => r.id !== "extras")
      for (const row of choiceRows.slice(1)) {
        await page.check(`input[data-row="${row.id}"][value="${row.recommended}"]`)
      }
      await page.fill(`textarea[data-row="motion"]`, "Keep it slow.")
      // Extras take several: one by its control, one by its mock.
      const extras = data.direction.rows.find((r) => r.id === "extras").options
      await page.check(`#opt-x-${extras[0].id}`)
      await page.click(`[data-option="extras-${extras[2].id}"] .mock`)
      const got = await answers(page)
      if (got.extras?.picked?.join() !== [extras[0].id, extras[2].id].join())
        fail(`${tag}: copied the wrong extras: ${got.extras?.picked}`)
      const problems = validateAnswers("direction", got, data.direction)
      if (problems.length)
        fail(`${tag}: copied answers are not valid: ${problems.join("; ")}`)
      if (got.choices.type?.site !== "B")
        fail(`${tag}: arrow key should have chosen site B for type`)
      if (got.choices.motion?.note !== "Keep it slow.")
        fail(`${tag}: the motion note was not copied`)
      writeFileSync(
        join(outDir, "direction-answers.json"),
        JSON.stringify(got, null, 2) + "\n"
      )
    }
    await page.screenshot({ path: join(outDir, `${board}-${size[0]}-answered.png`) })
    errors.forEach((e) => fail(`${tag}: ${e}`))
    await context.close()
  }
}

await browser.close()
if (failures.length) {
  console.error(`board check: ${failures.length} problem(s)`)
  failures.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
console.log(`board check: both boards pass at 1440 and 390. Screenshots in ${outDir}`)
