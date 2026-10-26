// How the leak scan decides that a line carries an earlier version's fingerprint.
//
// Copy, colours and file names count wherever they appear. A font name is
// often an ordinary word ("Border", "Inter"), so it counts only where it names
// a font: as a whole word in a font-family or font declaration (CSS or JS), in
// a Google Fonts family= parameter, or as a quoted name on a line about fonts.

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const word = (fp) => new RegExp(`(?<![\\w-])${escape(fp)}(?![\\w-])`, "i")

export function lineMatches(line, fingerprint, kind) {
  const low = line.toLowerCase()
  const fp = fingerprint.toLowerCase()
  if (!low.includes(fp)) return false
  if (kind !== "font") return true
  const name = word(fp)
  // font-family: ..., font: ..., fontFamily: "..." (up to the end of the declaration)
  for (const m of low.matchAll(/\bfont(?:-family|family)?\s*:\s*([^;{}]*)/g)) {
    if (name.test(m[1])) return true
  }
  // https://fonts.googleapis.com/css2?family=Border:wght@400
  for (const m of low.matchAll(/family=([^&"'\s]*)/g)) {
    if (name.test(m[1].replace(/\+/g, " "))) return true
  }
  // "Border" or 'Border' on a line that is about fonts
  return low.includes("font") && new RegExp(`["']${escape(fp)}["']`, "i").test(low)
}
