// Shared navigation types — the ordered set of scrollable home-page sections.
// Extend SectionId as each section (Hero, About, Work, Process, Contact) is built.

export type SectionId = "hero" | "about" | "work" | "process" | "contact"

export interface NavItem {
  id: SectionId
  label: string
}

export interface CommonProps {
  className?: string
}
