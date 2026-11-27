import type { DiffSide } from './pull.types.ts'

export interface FocusItem {
  path: string
  lines: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}
/** A possible problem the briefing raises. */
export interface Concern {
  title: string
  detail: string
  path: string
  line: number | null
  /** How sure Claude is; missing on briefings written before it was asked. */
  confidence?: 'high' | 'medium' | 'low' | undefined
  /** The code in the diff that shows the problem. */
  evidence?: string | undefined
}
/** A concern you marked as not an issue on a PR, so a new briefing does not raise it again. */
export interface DismissedConcern {
  title: string
  path: string
  line: number | null
  dismissedAt: string
}
export interface Briefing {
  gist: string
  intent: string
  risk: 'low' | 'medium' | 'high'
  focus: FocusItem[]
  ignore: { path: string; reason: string }[]
  concerns: Concern[]
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
/** What Claude is doing while it answers: a step it started, or a piece of its (summarised) reasoning. */
export type AskActivity = { kind: 'step'; label: string } | { kind: 'thinking'; text: string }
/** Lines of the diff given to Claude: where they are and how they read. */
export interface AskContext {
  path: string
  side: DiffSide
  startLine: number
  endLine: number
  /** The selected diff lines, with +/- markers, as shown to the reviewer. */
  snippet: string
}
export interface AskMessage {
  role: 'user' | 'assistant'
  content: string
  /** More lines added to the chat for this question, besides the chat's own selection. */
  context?: AskContext[] | undefined
}
/** A conversation with Claude about a selected range of the diff. */
export interface AskThread extends AskContext {
  id: string
  messages: AskMessage[]
  /** Lines added to the chat that go with the next question. */
  pendingContext?: AskContext[] | undefined
  createdAt: string
}
