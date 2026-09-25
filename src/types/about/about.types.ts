/** One run of the About statement; `accent` runs are the purple keywords. */
export type StatementSegment = {
  text: string
  accent?: boolean
}

/** A Field Log entry — one job or one qualification. */
export type LogEntry = {
  org: string
  period: string
  role: string
}

/** A label/value pair in the Status layer. */
export type StatusItem = {
  label: string
  value: string
}

/** A hidden personal fact the visitor can find with the light. */
export type FragmentContent = {
  id: string
  code: string
  text: string
}

/** One beat of the Origin story; each is a star in the constellation. */
export type OriginBeat = {
  /** Short tag shown beside the star, e.g. a year or keyword. */
  mark: string
  text: string
}

/** A status fact orbiting the core in the Status layer. */
export type Satellite = {
  id: string
  /** Short code shown on the satellite, e.g. "SAT_01". */
  code: string
  label: string
  value: string
  detail?: string
}

/** A Field log entry as a case file card. */
export type CaseFile = {
  id: string
  /** Short code shown on the card, e.g. "LOG_01". */
  code: string
  /** Which part of the log it's from, e.g. "Experience". */
  group: string
  org: string
  period: string
  role: string
}
