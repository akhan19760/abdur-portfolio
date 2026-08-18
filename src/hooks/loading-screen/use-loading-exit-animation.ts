import { gsap } from "gsap"
import { useGSAP } from "@gsap/react"
import type { ExitAnimationParams } from "@/types/loading-screen"

export function useLoadingExitAnimation({
  state,
  exitDuration,
  containerRef,
  topCurtainRef,
  bottomCurtainRef,
}: ExitAnimationParams): void {
  useGSAP(
    () => {
      if (state !== "exiting") return

      // 1. Hide all loading content instantly (every child except the curtain
      //    panels, which carry data-curtain="true").
      const contentChildren = containerRef.current
        ? Array.from(containerRef.current.children).filter(
            (el) => !el.hasAttribute("data-curtain")
          )
        : []
      gsap.set(contentChildren, { opacity: 0 })

      // 2. Make the container transparent so the gap between the sliding panels
      //    reveals the page content that sits behind the overlay.
      gsap.set(containerRef.current, { backgroundColor: "transparent" })

      // 3. Snap curtain panels from their off-screen starting position
      //    (translateY −100% / +100%) to cover the full overlay.
      gsap.set(topCurtainRef.current, { y: "0%" })
      gsap.set(bottomCurtainRef.current, { y: "0%" })

      // 4. Hold for one frame so the purple split line is visible at centre,
      //    then slide both halves away simultaneously.
      gsap.to(topCurtainRef.current, {
        y: "-100%",
        duration: 0.75,
        delay: 0.1,
        ease: "power2.inOut",
      })
      gsap.to(bottomCurtainRef.current, {
        y: "100%",
        duration: 0.75,
        delay: 0.1,
        ease: "power2.inOut",
      })
    },
    { dependencies: [state, exitDuration] }
  )
}
