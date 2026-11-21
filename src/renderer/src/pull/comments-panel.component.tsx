import type { ConversationComment, DraftComment } from '@shared/pull.types.ts'
import { memo, useState } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { groupBy } from '../common/group.util.ts'
import { PanelHeader } from '../common/panel-header.component.tsx'
import { ToggleButton } from '../common/toggle-button.component.tsx'
import { CommentSearch } from './comment-search.component.tsx'
import { CommentThreadItem, type JumpTo } from './comment-thread-item.component.tsx'
import {
  type CommentThread,
  findNewComments,
  type ReviewedBy,
  searchConversation,
  searchDrafts,
} from './comment-threads.util.ts'
import {
  countMatchesShown,
  describeEmptyList,
  filterVisibleThreads,
  hasYourComment,
  isSettled,
  keepYourThreads,
} from './comments-panel.util.ts'
import { ConversationList } from './conversation-list.component.tsx'
import { PendingDrafts } from './pending-drafts.component.tsx'

function FileHeading({ path, current }: { path: string; current: boolean }) {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return (
    <div
      className={joinClassNames(
        'truncate px-1.5 pt-1.5 pb-0.5 font-mono text-[10.5px]',
        current && 'text-accent',
        !current && 'text-muted',
      )}
      title={path}
    >
      {name}
    </div>
  )
}

/** "3 open · 2 new" beside the panel's title. */
function OpenAndNewCounts({ openCount, newCount }: { openCount: number; newCount: number }) {
  return (
    <span>
      {openCount} open
      {newCount > 0 && (
        <span className="text-accent" title="Comments by others since your last review">
          {' '}
          · {newCount} new
        </span>
      )}
    </span>
  )
}

/** The panel's toggles: only your threads, and resolved threads shown or hidden. Each shows only when it matters. */
function PanelToggles(props: {
  yourThreadCount: number
  onlyYours: boolean
  onToggleYours: () => void
  settledCount: number
  showResolved: boolean
  onToggleResolved: () => void
}) {
  return (
    <>
      {props.yourThreadCount > 0 && (
        <ToggleButton on={props.onlyYours} onToggle={props.onToggleYours}>
          Mine {props.yourThreadCount}
        </ToggleButton>
      )}
      {props.settledCount > 0 && (
        <ToggleButton on={props.showResolved} onToggle={props.onToggleResolved}>
          {Boolean(props.showResolved) && 'Hide'}
          {!props.showResolved && 'Show'} {props.settledCount} resolved
        </ToggleButton>
      )}
    </>
  )
}

/** The review threads, under a heading per file. */
function ThreadsByFile(props: {
  threads: readonly CommentThread[]
  current: string | null
  query: string
  reviewed: ReviewedBy
  onJump: JumpTo
}) {
  const threadsByFile = groupBy(props.threads, (thread) => thread.path)
  return (
    <>
      {[...threadsByFile].map(([path, threads]) => (
        <div key={path} className="mb-2">
          <FileHeading path={path} current={path === props.current} />
          {threads.map((thread) => (
            <CommentThreadItem
              key={thread.rootId}
              thread={thread}
              query={props.query}
              reviewed={props.reviewed}
              onJump={props.onJump}
            />
          ))}
        </div>
      ))}
    </>
  )
}

/**
 * Right-hand sidebar: your pending comments, the PR's conversation, then every review thread grouped by file.
 * Click a thread to jump to it, or a conversation comment to show it on the overview.
 */
export const CommentsPanel = memo(function CommentsPanelView(props: {
  threads: readonly CommentThread[]
  conversation: readonly ConversationComment[]
  onOpenConversation: (comment: ConversationComment) => void
  drafts: readonly DraftComment[]
  current: string | null
  reviewed: ReviewedBy
  onJump: JumpTo
  onClose: () => void
}) {
  const { reviewed } = props
  const [showResolved, setShowResolved] = useState(false)
  const [query, setQuery] = useState('')
  const [onlyYours, setOnlyYours] = useState(false)
  const yours = keepYourThreads(props.threads, onlyYours, reviewed.viewer)
  const visible = filterVisibleThreads(yours, query, showResolved, reviewed)
  const drafts = searchDrafts(props.drafts, query)
  const conversation = searchConversation(props.conversation, query)
  const shownCount = visible.length + drafts.length + conversation.length
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-panel">
      <PanelHeader
        title="Comments"
        detail={
          <OpenAndNewCounts
            openCount={props.threads.filter((thread) => !thread.resolved).length}
            newCount={props.threads.reduce((total, thread) => total + findNewComments(thread, reviewed).length, 0)}
          />
        }
        actions={
          <PanelToggles
            yourThreadCount={props.threads.filter((thread) => hasYourComment(thread, reviewed.viewer)).length}
            onlyYours={onlyYours}
            onToggleYours={() => setOnlyYours(!onlyYours)}
            settledCount={props.threads.filter((thread) => isSettled(thread, reviewed)).length}
            showResolved={showResolved}
            onToggleResolved={() => setShowResolved(!showResolved)}
          />
        }
        onClose={props.onClose}
        closeLabel="Hide comments"
      />
      <CommentSearch query={query} onChange={setQuery} matches={countMatchesShown(query.trim() !== '', shownCount)} />
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {drafts.length > 0 && <PendingDrafts drafts={drafts} query={query} onJump={props.onJump} />}
        <ConversationList comments={conversation} query={query} onOpen={props.onOpenConversation} />
        {shownCount === 0 && (
          <div className="px-3 py-8 text-center text-[12px] text-muted">
            {describeEmptyList(query, props.threads.length, onlyYours)}
          </div>
        )}
        <ThreadsByFile
          threads={visible}
          current={props.current}
          query={query}
          reviewed={reviewed}
          onJump={props.onJump}
        />
      </div>
    </aside>
  )
})
