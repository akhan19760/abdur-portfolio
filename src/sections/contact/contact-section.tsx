/**
 * Contact section ("Get in touch").
 *
 * Process ends with its paper plane flying off into the dark; this is where
 * it lands. Far ahead of it waits a vast wall of steel pins, like a pin-art
 * toy, unlit. The plane's light shows on the wall as it comes in, and when it
 * arrives the pins where it hits are driven in and a ring runs out across
 * the wall. As the section comes up, the camera comes down and in until the
 * wall fills the view, and the pins push out from behind to spell SAY HELLO.
 *
 * Then it's the visitor's to play with: the cursor is a fingertip and a lamp
 * (pins sink where it presses and spring back after it, and its light rakes
 * across the pin heads), holding the button presses harder, and a click
 * sends a ring across the wall. "Get in touch", literally.
 *
 * Under the letters, in plain type: a line of invitation, the email address
 * in big type (a mail link), a button that copies it, and LinkedIn and
 * GitHub.
 *
 * Scrolling on past it, the page loops (LoopSection): a hole opens in the
 * wall, the camera flies through, and the visitor comes back round to the
 * Hero without scrolling back up.
 *
 * Layers back → front (immersive mode):
 *   1. PinWall — R3F, lazy, fixed full-viewport canvas
 *   2. Sticky stage: heading, a dark scrim behind the text, the contact
 *      details, a one-line hint and the footer, fading in as the letters
 *      finish rising
 *
 * Two modes, decided once on mount:
 * - immersive: every device without a reduced-motion preference. In portrait
 *   the wall is tall and spells SAY / HELLO on two lines above the details
 *   (lib/stage-framing). useWallScroll fades the text in; the wall reads the
 *   same scroll position.
 * - flat: reduced motion. The same content in normal flow, with the words
 *   drawn in dots like pin heads, and no WebGL. The page ends here (no loop).
 */

import { Suspense, lazy, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { canHover, prefersImmersive } from "@/lib/media"
import { CONTACT, SITE_CONFIG } from "@/constants"
import { ErrorBoundary } from "@/components/layout"
import { ContactDetails } from "@/components/contact"
import type { ContactLabels } from "@/components/contact"
import { useLightProximity } from "@/hooks/cursor"
import { useWallScroll, wallPhases } from "@/hooks/contact"
import type { ContactLink } from "@/types/contact"

const PinWall = lazy(() =>
  import("@/components/contact/pin-wall").then((m) => ({ default: m.PinWall }))
)

const LINKS: ContactLink[] = [
  { id: "linkedin", name: "LinkedIn", href: CONTACT.linkedin },
  { id: "github", name: "GitHub", href: CONTACT.github },
]

export function ContactSection() {
  const { t } = useTranslation()

  // Input type and motion preference don't change mid-session in practice.
  const [immersive] = useState(prefersImmersive)
  const [pointer] = useState(canHover)
  const phases = useMemo(wallPhases, [])

  const { sectionRef, readUnits } = useWallScroll<HTMLElement>({ enabled: immersive })
  // The email address brightens as the cursor's light passes
  const { containerRef: lightRef } = useLightProximity<HTMLDivElement>()

  const labels: ContactLabels = {
    copy: t("contact.copy"),
    copied: t("contact.copied"),
    copyFailed: t("contact.copyFailed"),
    links: t("contact.linksLabel"),
    newTab: t("contact.newTab"),
  }
  const hud = immersive ? "" : undefined

  return (
    <section
      ref={sectionRef}
      id="contact"
      aria-labelledby="contact-heading"
      data-mode={immersive ? "immersive" : "flat"}
      // Flat: the social links only float (fixed, bottom left) on screens wide
      // enough to keep them in the margin, so no extra room is needed for them
      className={cn("relative", !immersive && "overflow-hidden py-20 sm:py-28")}
      // Derived from the timeline (wallPhases), so the scroll length can't drift from it
      style={immersive ? { height: `${phases.sectionVh}vh` } : undefined}
    >
      {/* ── 1. The wall (immersive only; decorative, so failures render nothing) ── */}
      {immersive && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <PinWall
              readUnits={readUnits}
              phases={phases}
              lettering={t("contact.wall")}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      <div
        ref={lightRef}
        className={cn(
          immersive
            ? "pointer-events-none sticky top-0 h-svh overflow-hidden"
            : "relative mx-auto max-w-4xl px-6"
        )}
      >
        {/* ── 2. Heading ────────────────────────────────────────────────────── */}
        <header
          data-wall-hud={hud}
          className={cn(
            immersive ? "absolute start-5 top-5 lg:start-10 lg:top-10" : "relative"
          )}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent-soft">
            {t("contact.label")}
          </p>
          <h2
            id="contact-heading"
            className={cn(
              "mt-3 font-sans uppercase text-text",
              immersive
                ? "text-lg tracking-[0.45em] lg:text-2xl lg:tracking-[0.6em]"
                : "text-3xl tracking-[0.35em] sm:text-5xl sm:tracking-[0.6em]"
            )}
          >
            {t("contact.heading")}
          </h2>
        </header>

        {/* The wall's words, in the flat version: drawn in dots, like pin heads */}
        {!immersive && (
          <p
            aria-hidden="true"
            className="mt-10 bg-[radial-gradient(circle,var(--color-text)_1.4px,transparent_1.9px)] bg-[length:6px_6px] bg-clip-text font-display text-[clamp(3.5rem,12vw,8rem)] leading-none font-normal text-transparent uppercase"
          >
            {t("contact.wall")}
          </p>
        )}

        {/* ── 3. The details, over a dark scrim so the pins never crowd the text ── */}
        {immersive && (
          <div
            aria-hidden="true"
            data-wall-hud={hud}
            className="absolute inset-x-0 bottom-0 h-[58%] bg-[radial-gradient(ellipse_62%_75%_at_50%_78%,rgba(10,10,10,0.92)_0%,rgba(10,10,10,0.7)_48%,transparent_78%)]"
          />
        )}
        <div
          data-wall-hud={hud}
          className={cn(
            immersive
              ? "pointer-events-auto absolute inset-x-0 bottom-[max(6.5rem,13vh)] mx-auto w-[min(92vw,56rem)] data-light-off:pointer-events-none max-lg:bottom-[4.75rem]"
              : "relative mt-12"
          )}
        >
          <ContactDetails
            intro={t("contact.intro")}
            email={CONTACT.email}
            links={LINKS}
            labels={labels}
            centered={immersive}
          />
        </div>

        {immersive && (
          <p
            data-wall-hud
            className="absolute end-10 bottom-10 max-w-[17rem] text-end font-support text-[11px] leading-relaxed text-text/55 max-lg:inset-x-5 max-lg:bottom-10 max-lg:max-w-none max-lg:text-center max-lg:text-[10px]"
          >
            {pointer ? t("contact.hint") : t("contact.hintTouch")}
          </p>
        )}

        <footer
          data-wall-hud={hud}
          className={cn(
            immersive
              ? "absolute inset-x-0 bottom-10 text-center max-lg:bottom-4"
              : "mt-24"
          )}
        >
          <p className="font-mono text-[11px] tracking-[0.2em] text-text/55">
            {t("contact.footer", {
              year: new Date().getFullYear(),
              name: SITE_CONFIG.author,
            })}
          </p>
        </footer>
      </div>
    </section>
  )
}
