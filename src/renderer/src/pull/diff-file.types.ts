import type { FocusItem } from '@shared/claude.types.ts'
import type { DiffSide, DraftComment, PullFile, ReviewComment } from '@shared/pull.types.ts'

export type DiffView = 'unified' | 'split'

export interface AskSelection {
  path: string
  side: DiffSide
  startLine: number
  endLine: number
  snippet: string
}

export interface DiffFileProps {
  file: PullFile
  /** Where the file lives, for blame and history. */
  repo: string
  headSha: string
  /** Show who last changed each line on hover. */
  blame: boolean
  onShowHistory: (path: string) => void
  view: DiffView
  comments: readonly ReviewComment[]
  drafts: readonly DraftComment[]
  focus: readonly FocusItem[]
  ignoreReason?: string | undefined
  viewed: boolean
  /** The file j/k navigation is on. */
  current?: boolean
  collapsed: boolean
  onToggleCollapsed: (path: string, collapsed: boolean) => void
  onToggleViewed: (path: string, sha: string, viewed: boolean) => void
  onAddDraft: (draft: Omit<DraftComment, 'id'>) => void
  onUpdateDraft: (id: string, body: string) => void
  onDeleteDraft: (id: string) => void
  onReplyNow: (commentId: number, body: string) => Promise<void>
  onAsk: (selection: AskSelection) => void
  /** Set while a Claude chat is open: adds selected lines to it. */
  onAddToChat?: ((selection: AskSelection) => void) | undefined
}
