import type { Guideline } from '@shared/guideline.types.ts'
import { cx } from '../common/format.util.ts'
import type { GuideDrafts } from './guide-drafts.util.ts'
import { type Draft, defaultTitle, groupGuides } from './guidelines.util.ts'

function DraftChip() {
  return <span className="chip ml-auto shrink-0 bg-warn/20 py-0 text-[10px] text-warn">draft</span>
}

/** The guides by repository, the selected one marked, and how guides stack. */
export function GuideList({
  list,
  selectedId,
  drafts,
  onSelect,
  onNew,
}: {
  list: readonly Guideline[]
  selectedId: string | undefined
  /** Unsaved edits by guide id (`new` for a guide not saved yet), marked in the list. */
  drafts: GuideDrafts
  onSelect: (g: Draft) => void
  onNew: () => void
}) {
  const newGuide = drafts.new
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-panel">
      <header className="drag flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <h1 className="text-[14px] font-semibold">Review guides</h1>
        <button type="button" className="btn no-drag" onClick={onNew}>
          + New
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {newGuide !== undefined && (
          <button
            type="button"
            onClick={() => onSelect(newGuide)}
            className={cx(
              'mb-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
              selectedId === undefined && 'bg-hover',
              selectedId !== undefined && 'hover:bg-hover/60',
            )}
          >
            <span className="truncate italic">{newGuide.title || defaultTitle(newGuide)}</span>
            <DraftChip />
          </button>
        )}
        {groupGuides(list).map(([repo, items]) => (
          <div key={repo} className="mb-3">
            <div className="px-2 py-1 text-[11px] font-semibold text-muted">{repo}</div>
            {items.map((g) => (
              <button
                type="button"
                key={g.id}
                onClick={() => onSelect(g)}
                className={cx(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                  selectedId === g.id && 'bg-hover',
                  selectedId !== g.id && 'hover:bg-hover/60',
                  !g.enabled && 'opacity-50',
                )}
              >
                <span className="font-mono text-[11px] text-muted">{g.path || '/'}</span>
                <span className="truncate">{g.title}</span>
                {drafts[g.id] !== undefined && <DraftChip />}
              </button>
            ))}
          </div>
        ))}
        <p className="px-2 pt-2 text-[11.5px] leading-relaxed text-muted">
          Guides stack from general to specific: <b>All repositories</b> → <b>repo root</b> → <b>folders</b> (e.g.{' '}
          <code>apps/web/</code>). A folder guide applies only when a PR touches files under it, and it is shown to
          Claude alongside the files it covers.
        </p>
      </div>
    </aside>
  )
}
