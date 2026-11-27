/** A line that mentions a name, with a few lines around it. */
export interface SymbolHit {
  path: string
  /** 1-based, in the file at the PR's head. */
  line: number
  text: string
  /** The file is one the PR changes, so the line can be opened in the diff. */
  inPull: boolean
  /** Where the name is declared (function, class, const…), or one of its uses. */
  kind: 'definition' | 'usage'
  /** The lines around it, starting at `contextStart`. */
  contextStart: number
  context: string[]
}
/** Where a name is defined and used: in the PR's files, and elsewhere in the repository. */
export interface SymbolSearch {
  name: string
  hits: SymbolHit[]
  /** Why the rest of the repository could not be searched, or why the list is cut short; null when complete. */
  note: string | null
}
