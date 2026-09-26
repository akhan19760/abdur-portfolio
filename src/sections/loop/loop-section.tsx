/**
 * The page loop: what comes after Contact.
 *
 * Scrolling on past Contact doesn't hit the end of the page. A hole opens in
 * the middle of Contact's pin wall and the camera flies through it into the
 * dark, where the Hero's name comes toward you as particles until it's back
 * in place, exactly as the page starts. There the scroll wraps back to the
 * top (Lenis's infinite mode), with nothing to show it happened, and carries
 * on into the Hero as if it had never stopped. One continuous forward flight
 * round the whole site; scrolling up at the top does nothing, as before.
 *
 * This section is only the scroll length for that, plus an exact copy of the
 * Hero's text on its last screen, so the frame where the scroll wraps
 * matches the top of the page. The wall's exit is drawn by Contact's
 * PinWall, and the name's approach by the Hero's own canvas (lib/page-loop).
 *
 * Purely visual: aria-hidden and inert, so the copy is never read out or
 * focused twice. Immersive mode only (it needs the page's smooth scroll):
 * with touch, reduced motion or a narrow screen the page just ends at
 * Contact.
 */

import { useState } from "react"
import { cn } from "@/lib/utils"
import { prefersImmersive } from "@/lib/media"
import { HERO_FRAME, HeroContent } from "@/components/hero"
import { LOOP_SCREENS, usePageLoop } from "@/hooks/loop"

export function LoopSection() {
  // Input type and motion preference don't change mid-session in practice.
  const [immersive] = useState(prefersImmersive)
  return immersive ? <LoopStretch /> : null
}

/** The stretch itself (split out so the loop's hook only runs when it's on). */
function LoopStretch() {
  const { loopRef, copyRef } = usePageLoop<HTMLDivElement, HTMLDivElement>({
    enabled: true,
  })

  return (
    <div
      ref={loopRef}
      id="loop"
      data-page-loop
      aria-hidden="true"
      inert
      className="relative"
      // Derived from the loop's length (LOOP_SCREENS), so the two can't drift apart
      style={{ height: `${LOOP_SCREENS * 100}vh` }}
    >
      {/* The top of the page, again: where the scroll wraps */}
      <div ref={copyRef} className={cn(HERO_FRAME, "absolute inset-x-0 bottom-0")}>
        <HeroContent />
      </div>
    </div>
  )
}
