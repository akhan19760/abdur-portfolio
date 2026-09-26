export { ContactDetails } from "./contact-details"
export type { ContactLabels } from "./contact-details"
export { letteringBox, wallStateAt } from "./wall-choreography"
export type { WallState } from "./wall-choreography"
// PinWall is deliberately not exported here: it pulls in three.js and is
// loaded with React.lazy from "@/components/contact/pin-wall" so it gets its
// own chunk. Re-exporting it would pull three.js into the main bundle.
