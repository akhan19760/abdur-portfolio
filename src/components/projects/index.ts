export { ProjectDetails } from "./project-details"
export { ProjectNav } from "./project-nav"
export { ProjectVisual } from "./project-visual"
export { ABOUT_HORIZON_Y, PAPER_LANDING, seaStateAt } from "./sea-choreography"
export type { SeaState } from "./sea-choreography"
// MirrorSea is deliberately not exported here: it pulls in three.js and is
// loaded with React.lazy from "@/components/projects/mirror-sea" so it gets
// its own chunk. Re-exporting it would pull three.js into the main bundle.
