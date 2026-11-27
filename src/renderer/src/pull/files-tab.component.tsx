import type { FocusItem } from '@shared/claude.types.ts'
import type { DraftComment, PullFile, ReviewComment } from '@shared/pull.types.ts'
import { EMPTY } from '../common/group.util.ts'
import { DiffFile } from './diff-file.component.tsx'
import type { DiffFileProps, DiffView } from './diff-file.types.ts'
import { findFilePathAt } from './file-in-view.util.ts'
import { readWordAtPoint } from './symbol-word.util.ts'

type FileCallbacks = Pick<
  DiffFileProps,
  | 'repo'
  | 'headSha'
  | 'blame'
  | 'onShowHistory'
  | 'onToggleCollapsed'
  | 'onToggleViewed'
  | 'onAddDraft'
  | 'onUpdateDraft'
  | 'onDeleteDraft'
  | 'onReplyNow'
  | 'onAsk'
  | 'onAddToChat'
>

/** Every changed file's diff, in the sidebar's order. */
export function FilesTab(
  props: FileCallbacks & {
    files: readonly PullFile[]
    view: DiffView
    commentsByPath: ReadonlyMap<string, readonly ReviewComment[]>
    draftsByPath: ReadonlyMap<string, readonly DraftComment[]>
    focusByPath: ReadonlyMap<string, readonly FocusItem[]>
    ignoreByPath: ReadonlyMap<string, string>
    viewed: Readonly<Record<string, string>>
    collapsed: Readonly<Record<string, boolean>>
    current: string | null
    /** Clicking anywhere in a file makes it the current one, for v and j/k. */
    onSelectFile: (path: string) => void
    /** ⌘-clicking a name opens where it is defined and used. */
    onFindUsages: (name: string) => void
  },
) {
  return (
    <div
      data-find-scope={true}
      className="space-y-3 p-4"
      onPointerDown={(event) => {
        const path = findFilePathAt(event.target as Element)
        if (path !== null && path !== props.current) {
          props.onSelectFile(path)
        }
      }}
      onClickCapture={(event) => {
        if (!event.metaKey) {
          return
        }
        const name = readWordAtPoint(event.clientX, event.clientY)
        if (name !== null) {
          event.preventDefault()
          event.stopPropagation()
          props.onFindUsages(name)
        }
      }}
    >
      {props.files.map((file) => (
        <DiffFile
          key={file.path}
          file={file}
          view={props.view}
          repo={props.repo}
          headSha={props.headSha}
          blame={props.blame}
          onShowHistory={props.onShowHistory}
          comments={props.commentsByPath.get(file.path) ?? EMPTY}
          drafts={props.draftsByPath.get(file.path) ?? EMPTY}
          focus={props.focusByPath.get(file.path) ?? EMPTY}
          ignoreReason={props.ignoreByPath.get(file.path)}
          viewed={props.viewed[file.path] === file.sha}
          collapsed={Boolean(props.collapsed[file.path])}
          current={props.current === file.path}
          onToggleCollapsed={props.onToggleCollapsed}
          onToggleViewed={props.onToggleViewed}
          onAddDraft={props.onAddDraft}
          onUpdateDraft={props.onUpdateDraft}
          onDeleteDraft={props.onDeleteDraft}
          onReplyNow={props.onReplyNow}
          onAsk={props.onAsk}
          onAddToChat={props.onAddToChat}
        />
      ))}
    </div>
  )
}
