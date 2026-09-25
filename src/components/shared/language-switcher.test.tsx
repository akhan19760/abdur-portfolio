import { act, render, screen, fireEvent } from "@testing-library/react"
import { axe } from "vitest-axe"
import { describe, expect, it, beforeEach } from "vitest"

import i18n from "@/lib/i18n"

import { LanguageSwitcher } from "./language-switcher"

describe("LanguageSwitcher", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage("en"))
  })

  it("renders EN and UR buttons", () => {
    render(<LanguageSwitcher />)
    expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "UR" })).toBeInTheDocument()
  })

  it("marks English as active by default", () => {
    render(<LanguageSwitcher />)
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "UR" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("switches to Roman Urdu when UR is clicked", () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByRole("button", { name: "UR" }))
    expect(i18n.language).toBe("ur")
  })

  it("updates aria-pressed after switching", () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByRole("button", { name: "UR" }))
    expect(screen.getByRole("button", { name: "UR" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("switches back to English when EN is clicked", () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByRole("button", { name: "UR" }))
    fireEvent.click(screen.getByRole("button", { name: "EN" }))
    expect(i18n.language).toBe("en")
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("resolves a regional variant (en-GB) to the EN button", async () => {
    await act(() => i18n.changeLanguage("en-GB"))
    render(<LanguageSwitcher />)
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("keeps <html lang> in sync with the active language", () => {
    render(<LanguageSwitcher />)
    expect(document.documentElement.lang).toBe("en")
    fireEvent.click(screen.getByRole("button", { name: "UR" }))
    expect(document.documentElement.lang).toBe("ur-Latn")
    fireEvent.click(screen.getByRole("button", { name: "EN" }))
    expect(document.documentElement.lang).toBe("en")
  })

  it("tags each button with its own language", () => {
    render(<LanguageSwitcher />)
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("lang", "en")
    expect(screen.getByRole("button", { name: "UR" })).toHaveAttribute("lang", "ur-Latn")
  })

  it("labels the group in the active language", () => {
    render(<LanguageSwitcher />)
    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "UR" }))
    expect(screen.getByRole("group", { name: "Zabaan" })).toBeInTheDocument()
  })

  it("passes axe accessibility audit", async () => {
    const { container } = render(<LanguageSwitcher />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
