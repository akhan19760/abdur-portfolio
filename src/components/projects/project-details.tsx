import { cn } from "@/lib/utils"
import type { Project } from "@/types/projects"
import { ProjectVisual } from "./project-visual"

type ProjectDetailsLabels = {
  stack: string
  highlights: string
  open: string
  newTab: string
  placeholder: string
  screenshotAlt: string
}

type ProjectDetailsProps = {
  project: Project
  index: number
  count: number
  labels: ProjectDetailsLabels
  /**
   * Immersive mode: pinned to the left of the sea's stage, beside the
   * project's screen standing on the water, and shown by the scroll as that
   * screen rises. Otherwise the project stacks in normal flow with its
   * picture beside it.
   */
  floating: boolean
  className?: string
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * One project, in plain words: its number, its name in huge type (each word
 * brightening as the cursor's light passes, like About's statement), role and
 * year, a one-line summary, the stack, two highlights and a link.
 *
 * An article with its own h3, so it reads the same with or without the sea.
 */
export function ProjectDetails({
  project,
  index,
  count,
  labels,
  floating,
  className,
}: ProjectDetailsProps) {
  const titleId = `${project.id}-title`
  const words = project.name.split(" ")

  const text = (
    <div className="min-w-0">
      <p
        aria-hidden="true"
        className="font-mono text-sm tracking-[0.3em] text-accent-soft"
      >
        {pad(index + 1)} <span className="text-text/40">/ {pad(count)}</span>
      </p>
      <h3
        id={titleId}
        className="mt-4 font-display text-[clamp(1.5rem,8vw,2.75rem)] font-light leading-[0.95] text-text [overflow-wrap:anywhere] sm:text-[clamp(2.75rem,5vw,5.25rem)]"
      >
        {words.map((word, i) => (
          <span key={i}>
            {i > 0 && " "}
            <span
              data-light
              className="inline-block opacity-[calc(0.62_+_var(--light,0)_*_0.38)] [text-shadow:0_0_calc(var(--light,0)*22px)_rgba(153,0,250,0.5)]"
            >
              {word}
            </span>
          </span>
        ))}
      </h3>
      <p className="mt-5 font-mono text-[12px] uppercase tracking-[0.25em] text-text/70 max-lg:mt-3 max-lg:text-[11px]">
        {project.role} · {project.year}
      </p>
      <p className="mt-4 max-w-md font-support text-[15px] leading-relaxed text-text/85 max-lg:mt-2.5 max-lg:text-[14px] sm:text-[16px]">
        {project.summary}
      </p>

      <h4 className="sr-only">{labels.stack}</h4>
      <ul className="mt-6 flex flex-wrap gap-2 max-lg:mt-4 max-lg:gap-1.5 short:hidden">
        {project.stack.map((tech, i) => (
          <li
            key={`${tech}-${i}`}
            className="border border-border px-2.5 py-1 font-mono text-[11px] text-text/80 max-lg:px-2 max-lg:text-[10px]"
          >
            {tech}
          </li>
        ))}
      </ul>

      <h4
        className={cn(
          "mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-text/60 max-lg:mt-4 short:sr-only",
          // Over the sea on a phone there's only room for the summary; the
          // highlights stay for screen readers
          floating && "max-sm:sr-only"
        )}
      >
        {labels.highlights}
      </h4>
      <ul className={cn("mt-2 space-y-1.5 short:sr-only", floating && "max-sm:sr-only")}>
        {project.highlights.map((highlight) => (
          <li
            key={highlight.id}
            className="flex items-baseline gap-3 font-support text-[15px] text-text/85 max-lg:text-[13px]"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 -translate-y-0.5 rotate-45 bg-accent"
            />
            {highlight.text}
          </li>
        ))}
      </ul>

      {project.href && (
        <a
          href={project.href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "mt-7 inline-flex min-h-8 items-center gap-2 border-b border-accent-soft/60 pb-1 font-mono text-[12px] uppercase tracking-[0.2em] text-accent-soft",
            "transition-colors duration-300 hover:border-accent hover:text-text",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          )}
        >
          {labels.open}
          <span aria-hidden="true">↗</span>
          <span className="sr-only">({labels.newTab})</span>
        </a>
      )}
    </div>
  )

  return (
    <article
      data-sea-panel={floating ? "" : undefined}
      aria-labelledby={titleId}
      className={cn(
        floating
          ? cn(
              "pointer-events-none absolute start-[max(9rem,10vw)] top-1/2 w-[min(38vw,36rem)] -translate-y-1/2",
              // Smaller landscape screens: less margin, a wider column
              "max-lg:start-6 max-lg:w-[44vw]",
              // Portrait: under the screen standing across the top of the view
              "portrait:inset-x-5 portrait:top-[49%] portrait:w-auto portrait:translate-y-0 sm:portrait:inset-x-10",
              "[&_a]:pointer-events-auto data-[light-off]:[&_a]:pointer-events-none"
            )
          : "relative grid items-center gap-8 sm:gap-10 lg:grid-cols-[5fr_6fr]",
        className
      )}
    >
      {text}
      {!floating && (
        <ProjectVisual
          project={project}
          placeholderLabel={labels.placeholder}
          alt={labels.screenshotAlt}
        />
      )}
    </article>
  )
}
