export { AboutFx } from "./about-fx"
export { AboutLayer } from "./about-layer"
export { GLYPH_EDGES, STORY_LINKS, lineId, starId } from "./about-shared"
export { CaseFiles } from "./case-files"
export { LightFragment } from "./light-fragment"
export { LitStatement } from "./lit-statement"
export { OrbitField } from "./orbit-field"
export { StarStory } from "./star-story"
// SignalCore is deliberately not exported here: it pulls in three.js and is
// loaded with React.lazy from "@/components/about/signal-core" so it gets its
// own chunk. Re-exporting it would pull three.js into the main bundle.
