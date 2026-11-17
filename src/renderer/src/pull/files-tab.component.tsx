import type { FocusItem } from '@shared/claude.types'
import type { DraftComment, PullFile, ReviewComment } from '@shared/pull.types'
import { EMPTY } from '../common/group.util'
import { DiffFile, type DiffFileProps, type DiffView } from './diff-file.component'

type FileCallbacks = Pick<DiffFileProps, 'onToggleCollapsed' | 'onToggleViewed' | 'onAddDraft' | 'onUpdateDraft' | 'onDeleteDraft' | 'onReplyNow' | 'onAsk'>

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
  },
) {
  return (
    <div className="space-y-3 p-4">
      {props.files.map((f) => (
        <DiffFile
          key={f.path}
          file={f}
          view={props.view}
          comments={props.commentsByPath.get(f.path) ?? EMPTY}
          drafts={props.draftsByPath.get(f.path) ?? EMPTY}
          focus={props.focusByPath.get(f.path) ?? EMPTY}
          ignoreReason={props.ignoreByPath.get(f.path)}
          viewed={props.viewed[f.path] === f.sha}
          collapsed={!!props.collapsed[f.path]}
          current={props.current === f.path}
          onToggleCollapsed={props.onToggleCollapsed}
          onToggleViewed={props.onToggleViewed}
          onAddDraft={props.onAddDraft}
          onUpdateDraft={props.onUpdateDraft}
          onDeleteDraft={props.onDeleteDraft}
          onReplyNow={props.onReplyNow}
          onAsk={props.onAsk}
        />
      ))}
    </div>
  )
}
