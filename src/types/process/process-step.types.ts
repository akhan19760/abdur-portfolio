/**
 * One step of the Process section. There are always five, in this order —
 * discover, design, build, refine, launch — because the paper's folds are
 * choreographed around them; the words are yours to change.
 */
export type ProcessStep = {
  id: string
  /** Shown in huge type, so keep it to one short word. */
  name: string
  /** One plain sentence about what happens in this step. */
  summary: string
}
