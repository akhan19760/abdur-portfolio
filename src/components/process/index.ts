export { FoldDiagram } from "./fold-diagram"
export { StepDetails } from "./step-details"
export { StepNav } from "./step-nav"
export { PAPER_SCREEN_X, paperStateAt } from "./fold-choreography"
export type { PaperState } from "./fold-choreography"
// FoldingPaper is deliberately not exported here: it pulls in three.js and is
// loaded with React.lazy from "@/components/process/folding-paper" so it gets
// its own chunk. Re-exporting it would pull three.js into the main bundle.
