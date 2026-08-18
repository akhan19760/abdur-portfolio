import type { RefObject } from "react"

export function SplitCurtain({
  topCurtainRef,
  bottomCurtainRef,
}: {
  topCurtainRef: RefObject<HTMLDivElement | null>
  bottomCurtainRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      <div
        ref={topCurtainRef}
        data-curtain="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[75] bg-base"
        style={{
          height: "50%",
          transform: "translateY(-100%)",
          borderBottom: "2px solid var(--color-accent)",
        }}
      />
      <div
        ref={bottomCurtainRef}
        data-curtain="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[75] bg-base"
        style={{
          height: "50%",
          transform: "translateY(100%)",
          borderTop: "2px solid var(--color-accent)",
        }}
      />
    </>
  )
}
