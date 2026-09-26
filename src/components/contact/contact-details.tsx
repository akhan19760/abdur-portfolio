import { cn } from "@/lib/utils"
import { useCopyText } from "@/hooks/contact"
import type { ContactLink } from "@/types/contact"

export type ContactLabels = {
  /** The copy button's text. */
  copy: string
  /** Announced (and shown) once the address is on the clipboard. */
  copied: string
  /** Announced (and shown) if the browser won't copy it. */
  copyFailed: string
  /** Accessible name for the list of other links. */
  links: string
  /** Read out after each link that opens a new tab. */
  newTab: string
}

type ContactDetailsProps = {
  /** One or two plain sentences inviting people to get in touch. */
  intro: string
  email: string
  links: ContactLink[]
  labels: ContactLabels
  /** Centred (over the pin wall) rather than aligned to the start. */
  centered?: boolean
  className?: string
}

const chip = cn(
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-text/25 bg-base/70 px-5",
  "font-mono text-[11px] uppercase tracking-[0.22em] text-text/85",
  "transition-colors duration-300 hover:border-accent hover:text-text",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
)

/**
 * How to reach Abdur: a line of invitation, the email address in big type
 * (a mail link, brightening as the cursor's light passes), a button that
 * copies it for people without a mail app, and the other places to find him.
 * The copy result is announced politely and shown under the buttons.
 */
export function ContactDetails({
  intro,
  email,
  links,
  labels,
  centered = false,
  className,
}: ContactDetailsProps) {
  const { status, copy } = useCopyText()
  const message =
    status === "copied" ? labels.copied : status === "failed" ? labels.copyFailed : ""
  // On a narrow screen the address breaks before the @ rather than mid-word
  const at = email.indexOf("@")

  return (
    <div className={cn(centered && "text-center", className)}>
      <p
        className={cn(
          "max-w-xl font-support text-[17px] leading-relaxed text-text/85",
          centered && "mx-auto"
        )}
      >
        {intro}
      </p>
      <a
        href={`mailto:${email}`}
        // The same as its text; the <wbr> below would otherwise read as a space
        aria-label={email}
        className={cn(
          "group mt-6 inline-block font-display text-[clamp(1.75rem,3.6vw,3.4rem)] font-light leading-tight text-text [overflow-wrap:anywhere]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-accent"
        )}
      >
        <span
          data-light
          // A border, not an underline: text-shadow would also draw a (purple) shadow of the underline
          className="border-b-2 border-transparent transition-colors duration-300 [text-shadow:0_0_calc(var(--light,0)*24px)_rgba(153,0,250,0.55)] group-hover:border-accent group-focus-visible:border-accent"
        >
          {at > 0 ? (
            <>
              {email.slice(0, at)}
              <wbr />
              {email.slice(at)}
            </>
          ) : (
            email
          )}
        </span>
      </a>
      <div
        className={cn(
          "mt-8 flex flex-wrap items-center gap-3",
          centered && "justify-center"
        )}
      >
        <button type="button" onClick={() => void copy(email)} className={chip}>
          {labels.copy}
        </button>
        <ul aria-label={labels.links} className="flex flex-wrap gap-3">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={chip}
              >
                {link.name}
                <span aria-hidden="true">↗</span>
                <span className="sr-only"> ({labels.newTab})</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <p
        role="status"
        className="mt-4 min-h-5 font-support text-[11px] tracking-[0.15em] text-accent-soft"
      >
        {message}
      </p>
    </div>
  )
}
