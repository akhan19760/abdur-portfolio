import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { axe } from "vitest-axe"
import i18n from "@/lib/i18n"
import en from "@/locales/en.json"
import ur from "@/locales/ur.json"
import { HERO_FRAME, HeroContent } from "./hero-content"

function renderInFrame() {
  return render(
    <section aria-label="Hero" className={HERO_FRAME}>
      <HeroContent />
    </section>
  )
}

describe("HeroContent", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage("en"))
  })

  it("shows the role, the tagline and a link down to the work", () => {
    renderInFrame()
    expect(screen.getByText(en.hero.role)).toBeInTheDocument()
    expect(screen.getByText(en.hero.tagline)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: en.hero.cta })).toHaveAttribute(
      "href",
      "#work"
    )
  })

  it("has the language switcher", () => {
    renderInFrame()
    expect(
      screen.getByRole("group", { name: en.languageSwitcher.label })
    ).toBeInTheDocument()
  })

  it("fades with --hero-exit, unless the link has keyboard focus", () => {
    renderInFrame()
    const layer = screen.getByText(en.hero.role).parentElement!
    expect(layer.className).toContain("var(--hero-exit,0)")
    expect(layer.className).toContain("has-[:focus-visible]:opacity-100")
  })

  it("switches copy with the language", async () => {
    renderInFrame()
    await act(() => i18n.changeLanguage("ur"))
    expect(screen.getByText(ur.hero.role)).toBeInTheDocument()
  })

  it("has no accessibility violations", async () => {
    const { container } = renderInFrame()
    expect(await axe(container)).toHaveNoViolations()
  })
})
