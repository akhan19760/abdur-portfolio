/**
 * LanguageSwitcher — a two-position toggle (EN | UR).
 *
 * A recessed `surface` track holds both labels; a 3D squircle thumb — the same
 * `.social-btn-3d` style as the hero's social links — slides under whichever
 * language is active. The slide uses a spring (overshooting cubic-bezier) on
 * `translate`, and the labels cross-fade their colour as the thumb passes.
 *
 * Semantically it stays two real buttons with `aria-pressed`: the thumb is a
 * purely decorative, aria-hidden layer. The global prefers-reduced-motion rule
 * in index.css collapses the slide to an instant swap.
 *
 * i18n must be initialised (via @/lib/i18n) before this component mounts —
 * it also keeps <html lang> in sync whenever the language changes.
 */

import { useTranslation } from "react-i18next"

import { HTML_LANG } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// ── Locale config ──────────────────────────────────────────────────────────────

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "ur", label: "UR" },
] as const

// ── Component ──────────────────────────────────────────────────────────────────

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  // resolvedLanguage is always one of the supported locales (e.g. "en-GB" → "en")
  const active = i18n.resolvedLanguage

  return (
    <div
      role="group"
      aria-label={t("languageSwitcher.label")}
      className={cn(
        // Recessed track — the thumb sits "inside" it
        "relative flex gap-1 rounded-[20px] border border-border bg-surface p-1",
        "shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)]"
      )}
    >
      {/* Sliding thumb — same 3D squircle as the social links. 2.75rem = button width + gap */}
      <span
        aria-hidden="true"
        className={cn(
          "social-btn-3d pointer-events-none absolute left-1 top-1 h-10 w-10 rounded-[16px]",
          "transition-[translate] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          active === "ur" ? "translate-x-[2.75rem]" : "translate-x-0"
        )}
      />

      {LOCALES.map(({ code, label }) => {
        const isActive = active === code
        return (
          <button
            key={code}
            type="button"
            lang={HTML_LANG[code]}
            onClick={() => {
              if (!isActive) void i18n.changeLanguage(code)
            }}
            aria-pressed={isActive}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-[16px]",
              "font-sans text-xs font-semibold tracking-wider",
              "transition-colors duration-300",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              isActive
                ? "text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.45))]"
                : "text-text/60 hover:text-text"
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
