import { cn } from "@/lib/utils"
import type { FragmentContent } from "@/types/about"

type LightFragmentProps = {
  fragment: FragmentContent
  found: boolean
  onFind: (id: string) => void
  className?: string
}

/**
 * A hidden personal fact in the About section.
 *
 * Unfound, only a faint diamond shows; the text fades in as the cursor light
 * gets close (--light from useLightProximity). Once found, it stays visible.
 *
 * It is a real button, so it is found the same way by every input:
 * - mouse: lit by the light (the section calls onFind), or clicked
 * - keyboard: focused, which also shows the text straight away
 * - touch: tapped (the light sets --light to 1 on touch, so it's visible)
 * Screen readers always get the full text as the button's name.
 */
export function LightFragment({
  fragment,
  found,
  onFind,
  className,
}: LightFragmentProps) {
  const find = () => onFind(fragment.id)

  return (
    <button
      type="button"
      data-light
      data-fragment-id={fragment.id}
      onClick={find}
      onFocus={find}
      className={cn(
        "group flex max-w-[15rem] items-start gap-2.5 p-2 text-start max-lg:text-[10px]",
        "font-mono text-[11px] leading-snug",
        "transition-colors duration-300 hover:bg-accent/10",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-px shrink-0 text-accent transition-opacity duration-300",
          found ? "opacity-100" : "opacity-[calc(0.35_+_var(--light,0)_*_0.65)]"
        )}
      >
        {found ? "◆" : "◇"}
      </span>
      <span
        className={cn(
          "transition-opacity duration-300",
          found
            ? "opacity-100"
            : "opacity-[var(--light,0)] group-focus-visible:opacity-100"
        )}
      >
        <span className="block tracking-[0.2em] text-accent-soft">{fragment.code}</span>
        <span className="block font-support text-text/85">{fragment.text}</span>
      </span>
    </button>
  )
}
