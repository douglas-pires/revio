/** Lines shorter than this (braces, `return`, blank-ish) say nothing about whose code was changed. */
const MIN_LINE_CHARS = 12
const IMPORT_LINE = /^(?:import\b|from\s|export\s+\{|export\s+\*|require\()/u

/** A line as compared: its text without surrounding spaces, or null when it is too generic to count. */
function readMeaningfulLine(line: string) {
  const text = line.slice(1).trim()
  if (text.length < MIN_LINE_CHARS || IMPORT_LINE.test(text)) {
    return null
  }
  return text
}

/** The meaningful lines a unified diff adds ('+') or removes ('-'). */
function collectLines(patch: string, marker: '+' | '-') {
  const lines = new Set<string>()
  for (const line of patch.split('\n')) {
    if (line.startsWith(marker) && !line.startsWith(`${marker}${marker}${marker}`)) {
      const text = readMeaningfulLine(line)
      if (text !== null) {
        lines.add(text)
      }
    }
  }
  return lines
}

/**
 * How many lines the approved PR added that the later PR removed or rewrote, over the files both changed: the sign
 * that the later PR changed that code rather than just touching the same files.
 */
export function countRewrittenLines(
  approvedPatches: Readonly<Record<string, string | undefined>>,
  fixPatches: Readonly<Record<string, string | undefined>>,
  sharedFiles: readonly string[],
) {
  let count = 0
  for (const path of sharedFiles) {
    const added = collectLines(approvedPatches[path] ?? '', '+')
    for (const removed of collectLines(fixPatches[path] ?? '', '-')) {
      if (added.has(removed)) {
        count += 1
      }
    }
  }
  return count
}
