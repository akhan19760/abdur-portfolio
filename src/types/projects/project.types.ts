/** One line about what a project achieved or what you owned on it. */
export type ProjectHighlight = {
  id: string
  text: string
}

/** A project in the Work section. */
export type Project = {
  id: string
  /** Shown in huge type, so keep it short. */
  name: string
  role: string
  year: string
  /** One line: what it is, who it's for, and what you did. */
  summary: string
  stack: string[]
  highlights: ProjectHighlight[]
  /** Live site or repository. Empty or missing: no link is shown. */
  href?: string
  /**
   * A screenshot (16:9 works best), e.g. "/projects/orbit.jpg" from public/.
   * Empty or missing: a placeholder is shown instead.
   */
  image?: string
}
