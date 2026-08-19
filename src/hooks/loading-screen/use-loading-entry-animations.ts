import { gsap } from "gsap"
import { useGSAP } from "@gsap/react"
import {
  GHOST_TEXT,
  GLITCH_CHARS,
  LOG_LINES,
} from "@/components/loading-screen/constants"
import type { EntryAnimationParams } from "@/types/loading-screen"

export function useLoadingEntryAnimations({
  containerRef,
  binaryStripRef,
  ghostTextRef,
  counterRef,
  labelRef,
  errFlashRef,
  waveRef,
  holdDuration,
}: EntryAnimationParams): void {
  useGSAP(
    () => {
      const logLines = containerRef.current?.querySelectorAll<HTMLElement>(".js-log-line")
      const glitchBars =
        containerRef.current?.querySelectorAll<HTMLElement>(".js-glitch-bar")
      const eqBars = containerRef.current?.querySelectorAll<HTMLElement>(".js-eq-bar")
      const statusBars =
        containerRef.current?.querySelectorAll<HTMLElement>(".js-status-bar")
      if (!logLines?.length) return

      // Binary strip: scrolls continuously left (duplicate content = seamless)
      if (binaryStripRef.current) {
        const half = binaryStripRef.current.scrollWidth / 2
        gsap.to(binaryStripRef.current, {
          x: -half,
          duration: 22,
          ease: "none",
          repeat: -1,
        })
      }

      // EQ spectrum bars: each bar independently loops to random heights
      if (eqBars?.length) {
        eqBars.forEach((bar, i) => {
          const bounce = () => {
            gsap.to(bar, {
              height: `${4 + Math.random() * 38}px`,
              duration: 0.08 + Math.random() * 0.16,
              ease: "power1.inOut",
              onComplete: bounce,
            })
          }
          gsap.delayedCall(i * 0.055, bounce)
        })
      }

      // Status bars: fill from 0 to their target percentage
      if (statusBars?.length) {
        statusBars.forEach((bar) => {
          gsap.from(bar, {
            width: "0%",
            duration: (holdDuration * 0.45) / 1000,
            ease: "power1.inOut",
            delay: 0.5,
          })
        })
      }

      // Ghost text glitches at 3 fixed moments
      const glitchGhost = (delay: number) => {
        gsap.delayedCall(delay, () => {
          if (!ghostTextRef.current) return
          ghostTextRef.current.textContent = Array.from(
            GHOST_TEXT,
            () => GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
          ).join("")
          gsap.delayedCall(0.1, () => {
            if (ghostTextRef.current) ghostTextRef.current.textContent = GHOST_TEXT
          })
        })
      }
      glitchGhost(1.2)
      glitchGhost(2.9)
      glitchGhost(4.6)

      // CRT flicker: two brief opacity dips simulating power fluctuation
      gsap.to(containerRef.current, {
        opacity: 0.87,
        duration: 0.05,
        yoyo: true,
        repeat: 1,
        ease: "none",
        delay: 1.1,
      })
      gsap.to(containerRef.current, {
        opacity: 0.92,
        duration: 0.04,
        yoyo: true,
        repeat: 3,
        ease: "none",
        delay: (holdDuration * 0.38) / 1000,
      })

      // Counter
      const counter = { value: 0 }
      gsap.to(counter, {
        value: 100,
        // End 1.2 s before holdDuration so the calming effects are fully visible
        // before the split-curtain exit fires.
        duration: (holdDuration - 1400) / 1000,
        ease: "power1.inOut",
        delay: 0.2,
        onUpdate() {
          if (counterRef.current) {
            counterRef.current.textContent = String(Math.round(counter.value)).padStart(
              3,
              "0"
            )
          }
        },
        onComplete() {
          if (labelRef.current) labelRef.current.textContent = "LINK_ESTABLISHED"
          // Wave calms to a flat straight line (amplitude → 0)
          gsap.to(waveRef.current, { amplitude: 0, duration: 0.35, ease: "power2.out" })
          // Status label box fills with accent purple, text becomes white
          gsap.to(labelRef.current, {
            backgroundColor: "#ff851b",
            color: "#ffffff",
            borderColor: "rgba(255, 255, 255, 0.4)",
            duration: 0.5,
            ease: "power2.inOut",
            delay: 0.05,
          })
        },
      })

      // Log lines: instant appear, staggered across 65% of hold duration
      const staggerAmount = (holdDuration * 0.65) / 1000
      gsap.fromTo(
        Array.from(logLines),
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.001,
          stagger: { amount: staggerAmount, ease: "none" },
          delay: 0.4,
        }
      )

      // Corruption trigger — when ERROR line (index 4) appears
      const errorDelay = 0.4 + staggerAmount * (4 / (LOG_LINES.length - 1))

      gsap.delayedCall(errorDelay, () => {
        waveRef.current.corrupted = true

        gsap.fromTo(
          errFlashRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.05,
            yoyo: true,
            repeat: 9,
            ease: "none",
          }
        )

        if (glitchBars?.length) {
          glitchBars.forEach((bar) => {
            gsap.set(bar, { top: `${5 + Math.random() * 87}%` })
            gsap.fromTo(
              bar,
              { opacity: 0 },
              {
                opacity: () => 0.35 + Math.random() * 0.55,
                duration: 0.04,
                yoyo: true,
                repeat: 11,
                ease: "none",
              }
            )
          })
        }
      })

      gsap.delayedCall(errorDelay + 0.45, () => {
        waveRef.current.corrupted = false
      })
    },
    { scope: containerRef }
  )
}
