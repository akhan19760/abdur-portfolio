import { cn } from "@/lib/utils"
import type { Project } from "@/types/projects"

type ProjectVisualProps = {
  project: Pick<Project, "name" | "image">
  /** Written on the placeholder, e.g. "Screenshot placeholder". */
  placeholderLabel: string
  /** Alt text for a real screenshot, e.g. "Screenshot of Orbit". */
  alt: string
  className?: string
}

/**
 * A project's picture where there's no sea (the flat version): its
 * screenshot, or the same dark mock web page the sea's screens show until
 * one is added. The placeholder is decorative, so it's hidden from assistive
 * tech; a real screenshot gets alt text.
 */
export function ProjectVisual({
  project,
  placeholderLabel,
  alt,
  className,
}: ProjectVisualProps) {
  const frame = "aspect-video w-full overflow-hidden rounded-xl border border-border"

  if (project.image) {
    return (
      <img
        src={project.image}
        alt={alt}
        loading="lazy"
        className={cn(frame, "object-cover", className)}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        frame,
        "relative bg-[linear-gradient(180deg,#131318,#0c0c10)]",
        className
      )}
    >
      <div className="flex h-[7%] items-center gap-1.5 bg-[#191920] px-[2.3%]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[40%] max-h-2 w-auto aspect-square rounded-full bg-[#34343d]"
          />
        ))}
        <span className="ms-[4%] h-[45%] w-[37%] rounded-full bg-[#22222a]" />
      </div>
      <p className="absolute start-[6%] top-[17%] max-w-[48%] font-sans text-[clamp(1rem,2.6vw,2.25rem)] font-bold leading-tight text-text">
        {project.name}
      </p>
      <span className="absolute start-[6%] top-[42%] h-[2%] w-[39%] rounded-full bg-[#2c2c35]" />
      <span className="absolute start-[6%] top-[47%] h-[2%] w-[29%] rounded-full bg-[#2c2c35]" />
      <span className="absolute start-[6%] top-[55%] h-[6.5%] w-[13%] rounded-full bg-accent" />
      <span className="absolute end-[6%] top-[13.5%] h-[43%] w-[35%] rounded-lg bg-[radial-gradient(circle_at_65%_35%,rgba(153,0,250,0.25),transparent_60%),linear-gradient(135deg,#1f1f28,#15151b)]" />
      <span className="absolute bottom-[13%] start-[6%] end-[6%] flex h-[21%] gap-[3%]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex-1 rounded-lg bg-[#18181f]" />
        ))}
      </span>
      <span className="absolute bottom-[3%] end-[2.5%] font-mono text-[10px] uppercase tracking-[0.2em] text-text/40">
        {placeholderLabel}
      </span>
    </div>
  )
}
