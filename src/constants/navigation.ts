import type { NavItem } from "@/types/shared"

// Ordered list of scrollable home-page sections, used for in-page nav / scroll-to
// targets. Extend as each section (Hero, About, Work, Process, Contact) is built.
export const NAV_ITEMS: NavItem[] = [
  { id: "hero", label: "Hero" },
  { id: "about", label: "About" },
  { id: "work", label: "Work" },
  { id: "process", label: "Process" },
  { id: "contact", label: "Contact" },
]
