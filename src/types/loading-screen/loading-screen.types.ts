import type { RefObject } from "react"

export type LoadingState = "loading" | "exiting" | "done"

export interface UseLoadingStateOptions {
  /**
   * How long to show the loading screen in normal / holding state (ms).
   * @default 3000
   */
  holdDuration?: number
  /**
   * Duration of the split-curtain exit animation before removing the overlay (ms).
   * @default 1000
   */
  exitDuration?: number
}

export type LoadingScreenProps = UseLoadingStateOptions

export interface RadarBlip {
  a: number
  d: number
  alpha: number
}

export interface WaveState {
  offset: number
  amplitude: number
  corrupted: boolean
}

export interface EntryAnimationParams {
  containerRef: RefObject<HTMLDivElement | null>
  binaryStripRef: RefObject<HTMLDivElement | null>
  ghostTextRef: RefObject<HTMLSpanElement | null>
  counterRef: RefObject<HTMLSpanElement | null>
  labelRef: RefObject<HTMLSpanElement | null>
  errFlashRef: RefObject<HTMLDivElement | null>
  waveRef: RefObject<WaveState>
  holdDuration: number
}

export interface ExitAnimationParams {
  state: LoadingState
  exitDuration: number
  containerRef: RefObject<HTMLDivElement | null>
  topCurtainRef: RefObject<HTMLDivElement | null>
  bottomCurtainRef: RefObject<HTMLDivElement | null>
}
