import type {
  AskThread,
  BriefingRecord,
  DraftComment,
  Guideline,
  Inbox,
  MainEvent,
  PullDetail,
  PullLocalState,
  ResolvedGuideline,
  Settings,
  SettingsPatch,
  Stack,
  SubmitReviewInput,
} from './types'

/** Everything the renderer can ask the main process to do. Exposed as `window.revio`. */
export interface RevioApi {
  getSettings(): Promise<Settings>
  updateSettings(patch: SettingsPatch): Promise<Settings>

  getInbox(): Promise<Inbox | null>
  refreshInbox(): Promise<Inbox>

  /** PR details; a cached copy up to `maxAgeMs` old is fine (0 = always fetch). */
  getPull(repo: string, number: number, maxAgeMs?: number): Promise<PullDetail>
  /** The stack this PR belongs to, or null. */
  getStack(repo: string, number: number): Promise<Stack | null>
  getLocalState(repo: string, number: number): Promise<PullLocalState>
  saveDrafts(repo: string, number: number, drafts: DraftComment[]): Promise<void>
  setViewed(repo: string, number: number, path: string, sha: string | null): Promise<void>
  submitReview(input: SubmitReviewInput): Promise<{ url: string }>
  replyToComment(repo: string, number: number, commentId: number, body: string): Promise<void>

  listGuidelines(): Promise<Guideline[]>
  saveGuideline(g: Omit<Guideline, 'id' | 'updatedAt'> & { id?: string }): Promise<Guideline>
  deleteGuideline(id: string): Promise<void>
  resolveGuidelines(repo: string, paths: string[]): Promise<ResolvedGuideline[]>
  knownRepos(): Promise<string[]>

  generateBriefing(repo: string, number: number): Promise<BriefingRecord>
  /** Answers the last user message of `thread`. Streams text via `ask-delta` events. */
  askClaude(repo: string, number: number, thread: AskThread): Promise<{ answer: string }>
  saveAsks(repo: string, number: number, threads: AskThread[]): Promise<void>

  openExternal(url: string): Promise<void>
  onEvent(listener: (event: MainEvent) => void): () => void
}

export const IPC = {
  invoke: 'revio:invoke',
  event: 'revio:event',
} as const

export type ApiMethod = Exclude<keyof RevioApi, 'onEvent'>
