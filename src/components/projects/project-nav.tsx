import { cn } from "@/lib/utils"
import type { Project } from "@/types/projects"

type ProjectNavProps = {
  projects: Pick<Project, "id" | "name">[]
  /** Index of the project on screen now. */
  active: number
  onSelect: (index: number) => void
  /** Accessible name for the list, e.g. "Projects". */
  label: string
  className?: string
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Every project by name, with the one on screen marked: shows at a glance how
 * many there are and where you are, and jumps straight to any of them.
 */
export function ProjectNav({
  projects,
  active,
  onSelect,
  label,
  className,
}: ProjectNavProps) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex flex-col items-end gap-1">
        {projects.map((project, i) => {
          const current = i === active
          return (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "group flex min-h-7 items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors duration-300",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  current ? "text-text" : "text-text/55 hover:text-text/90"
                )}
              >
                <span>{project.name}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px transition-all duration-500",
                    current ? "w-10 bg-accent" : "w-4 bg-text/30 group-hover:w-6"
                  )}
                />
                <span aria-hidden="true">{pad(i + 1)}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
