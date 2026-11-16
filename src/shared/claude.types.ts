import type { DiffSide } from './pull.types'

export interface FocusItem {
  path: string
  lines: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}
export interface Briefing {
  gist: string
  intent: string
  risk: 'low' | 'medium' | 'high'
  focus: FocusItem[]
  ignore: { path: string; reason: string }[]
  concerns: { title: string; detail: string; path: string; line: number | null }[]
  questions: string[]
  guidelineChecks: { guideline: string; status: 'ok' | 'concern' | 'unclear'; note: string }[]
}
export interface BriefingRecord {
  headSha: string
  createdAt: string
  backend: 'api' | 'cli'
  model: string
  briefing: Briefing
  /** Files whose diff was not sent to Claude (binary, or over the size budget). */
  omittedFiles: string[]
}
export interface AskMessage {
  role: 'user' | 'assistant'
  content: string
}
/** A conversation with Claude about a selected range of the diff. */
export interface AskThread {
  id: string
  path: string
  side: DiffSide
  startLine: number
  endLine: number
  /** The selected diff lines, with +/- markers, as shown to the reviewer. */
  snippet: string
  messages: AskMessage[]
  createdAt: string
}
