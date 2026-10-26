// Launches Playwright's Chromium, or an installed Chrome or Edge.
import { chromium } from "playwright"

export async function launch() {
  for (const opts of [{}, { channel: "chrome" }, { channel: "msedge" }]) {
    try {
      return await chromium.launch(opts)
    } catch {
      /* try the next browser */
    }
  }
  throw new Error("No browser found. Run: pnpm exec playwright install chromium")
}
