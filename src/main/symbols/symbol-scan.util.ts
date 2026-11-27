import type { SymbolHit } from '@shared/symbol.types.ts'

/** Lines shown above and below a hit. */
const CONTEXT_LINES = 3
/** Hits kept per file, so one huge file cannot fill the list. */
const MAX_HITS_PER_FILE = 12
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/gu
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/u

/** Words that declare a name right before it, across common languages. */
const DECLARATION_WORDS = String.raw`(?:function\*?|class|interface|type|enum|namespace|const|let|var|def|fn|func|struct|trait|impl|module|record)`

const escapeRegex = (text: string) => text.replaceAll(REGEX_SPECIALS, String.raw`\$&`)

/** Names shorter or longer than this are not worth searching. */
const MIN_NAME_LENGTH = 2
const MAX_NAME_LENGTH = 80

/** Whether a name can be searched: one identifier, as code would write it. */
export const isSearchableName = (name: string) =>
  IDENTIFIER.test(name) && name.length >= MIN_NAME_LENGTH && name.length <= MAX_NAME_LENGTH

/**
 * Whether a line declares `name`: after a declaring word ("function name", "const name"), as an object or class
 * member defined with a function ("name(…) {", "name: (…) =>", "name = async ("), or as an exported name.
 */
export function isDefinitionLine(line: string, name: string) {
  const word = escapeRegex(name)
  const patterns = [
    String.raw`\b${DECLARATION_WORDS}\s+${word}\b`,
    String.raw`^\s*(?:(?:public|private|protected|static|async|readonly|override|export|default)\s+)*${word}\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?::[^={]+)?\{`,
    String.raw`^\s*(?:readonly\s+)?${word}\s*[:=]\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>`,
  ]
  return patterns.some((pattern) => new RegExp(pattern, 'u').test(line))
}

/** Whether a line declares the name or uses it. */
function classify(line: string, name: string): SymbolHit['kind'] {
  if (isDefinitionLine(line, name)) {
    return 'definition'
  }
  return 'usage'
}

/** Every line of a file that mentions `name` as a whole word, as hits with the lines around them. */
export function scanFile(path: string, content: string, name: string, inPull: boolean): SymbolHit[] {
  const lines = content.split('\n')
  const mentions = new RegExp(String.raw`(?<![\w$])${escapeRegex(name)}(?![\w$])`, 'u')
  const hits: SymbolHit[] = []
  for (const [index, text] of lines.entries()) {
    if (hits.length >= MAX_HITS_PER_FILE) {
      break
    }
    if (mentions.test(text)) {
      const contextStart = Math.max(0, index - CONTEXT_LINES)
      hits.push({
        path,
        line: index + 1,
        text,
        inPull,
        kind: classify(text, name),
        contextStart: contextStart + 1,
        context: lines.slice(contextStart, index + CONTEXT_LINES + 1),
      })
    }
  }
  return hits
}

/** Definitions first, then the PR's own files, then by path and line. */
export function sortHits(hits: readonly SymbolHit[]) {
  const rank = (hit: SymbolHit) => Number(hit.kind !== 'definition') * 2 + Number(!hit.inPull)
  return [...hits].sort(
    (left, right) => rank(left) - rank(right) || left.path.localeCompare(right.path) || left.line - right.line,
  )
}
