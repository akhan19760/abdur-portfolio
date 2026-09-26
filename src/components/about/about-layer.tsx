import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type AboutLayerProps = {
  /** Two-digit layer number shown before the title, e.g. "01". */
  index: string
  title: string
  /** True when the section runs the z-axis dive; false for the flat fallback. */
  depth: boolean
  /** Hidden fragments that belong to this layer. */
  fragments?: ReactNode
  /** Classes for the content column (width, alignment). */
  contentClassName?: string
  /** Classes for the h3, e.g. to float it over a full-bleed layer. */
  titleClassName?: string
  children: ReactNode
}

/**
 * One layer of the About section, with its own `h3`.
 *
 * In depth mode every layer fills the sticky stage and is moved along the
 * z axis by useDepthScroll (`data-depth-layer`). Fragments are then placed
 * around the content by the classes the section gives them. The layer itself
 * never takes the pointer (the About stage overlaps the Hero during the
 * handoff and must not block it) — only its buttons do, and not while the
 * layer is faded out (`data-light-off`).
 *
 * In the flat fallback the layer is a normal block and its fragments sit in
 * a row under the content.
 */
export function AboutLayer({
  index,
  title,
  depth,
  fragments,
  contentClassName,
  titleClassName,
  children,
}: AboutLayerProps) {
  return (
    <div
      data-depth-layer
      className={cn(
        depth
          ? cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center px-16 will-change-transform",
              "[&_button]:pointer-events-auto data-[light-off]:[&_button]:pointer-events-none"
            )
          : "relative"
      )}
    >
      <div className={cn("relative w-full", contentClassName)}>
        <h3
          className={cn(
            "mb-8 font-mono text-[11px] uppercase tracking-[0.35em] text-accent-soft",
            titleClassName
          )}
        >
          <span aria-hidden="true">{index} / </span>
          {title}
        </h3>
        {children}
      </div>

      {fragments &&
        (depth ? (
          fragments
        ) : (
          <div className="mt-10 flex flex-wrap gap-3">{fragments}</div>
        ))}
    </div>
  )
}
