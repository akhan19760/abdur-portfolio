import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "@/components/shared"

/**
 * The Hero's HTML layer over its particle name: the language switcher in the
 * top right, and the role, tagline and call to action around the space the
 * name takes up.
 *
 * Used twice: in the Hero itself, and as an exact copy on the last screen of
 * the page loop (made inert and hidden from assistive tech there), so the
 * frame where the scroll wraps back to the top matches it pixel for pixel.
 * Both must sit in the same box: `HERO_FRAME`, a full-screen flex column.
 *
 * Fades with `--hero-exit` from an ancestor (0 shown, fading out by ~0.4),
 * but comes back if the call to action receives keyboard focus.
 */
export function HeroContent() {
  const { t } = useTranslation()
  return (
    <>
      {/* ── Language switcher — EN · UR, top-right ─────────────────────────── */}
      <div className="absolute right-10 top-10 z-10">
        <LanguageSwitcher />
      </div>

      {/* ── Role, tagline, CTA ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "pointer-events-none relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center",
          "opacity-[calc(1_-_var(--hero-exit,0)_*_2.4)] has-[:focus-visible]:opacity-100"
        )}
      >
        <p className="mb-6 font-support text-xs uppercase tracking-[0.4em] text-accent/60">
          {t("hero.role")}
        </p>

        {/*
          Invisible spacer — reserves the canvas text area in the flex column.
          Height approximates two lines of Kiloy at clamp(4.5rem, 13vw, 12rem).
          Tune in browser if the role/tagline drift relative to the canvas name.
        */}
        <div aria-hidden="true" className="h-[clamp(10.5rem,28vw,26rem)]" />

        <p className="mb-10 mt-6 font-support text-sm tracking-widest text-text/35">
          {t("hero.tagline")}
        </p>

        <a
          href="#work"
          className={cn(
            "pointer-events-auto inline-flex items-center gap-3",
            "border border-accent/30 px-6 py-3",
            "font-hero text-xs uppercase tracking-widest text-accent/70",
            "transition-colors duration-300 hover:border-accent/60 hover:bg-accent/10",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          )}
        >
          {t("hero.cta")} <span aria-hidden="true">↓</span>
        </a>
      </div>
    </>
  )
}

/** The box the Hero's content sits in (the Hero section, and the loop's copy of it). */
export const HERO_FRAME = "relative flex min-h-screen flex-col overflow-hidden font-hero"
