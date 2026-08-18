// ── Constants for LoadingScreen ──────────────────────────────────────────────

export const LOG_LINES = [
  { text: "> init_sys_v4.2.1", isError: false },
  { text: "> mounting_virtual_mem...", isError: false },
  { text: "> calibrating_cursor_light", isError: false },
  { text: "> composing_layout", isError: false },
  { text: "> ERROR: heap_fragmentation", isError: true },
  { text: "> recovery_protocol_active", isError: false },
  { text: "> loading_creative_assets", isError: true },
  { text: "> handshake_complete", isError: false },
] as const

export const HEX_ADDRESSES = ["0x7FF3A2B9", "0xC4E91D02", "0x0A29FFBC"] as const

export const BINARY_CHUNK =
  "01001101 00110100 01110100 01110010 01101001 01111000 00100000 01110000 01110010 01101111 01110100 01101111 01100011 01101111 01101100 00100000 01000011 01000001 01001100 01001001 01000010 01010010 01000001 01010100 01001001 01001110 01000111 // 0xAR290F // MATRIX_PROTOCOL // CALIBRATING // "

// Status indicators that animate on load
export const STATUS_BARS = [
  { label: "SIG", pct: 82 },
  { label: "MEM", pct: 67 },
  { label: "CPU", pct: 91 },
  { label: "NET", pct: 44 },
] as const

// Ghost watermark text — glitches occasionally in entry GSAP
export const GHOST_TEXT = "arkitechts"
export const GLITCH_CHARS = "!#%<>{}[]XZQVKM░▒▓"
