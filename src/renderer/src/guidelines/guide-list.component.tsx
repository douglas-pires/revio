import { buildDefaultTitle } from '@shared/guide-title.util.ts'
import type { Guideline } from '@shared/guideline.types.ts'
import { joinClassNames } from '../common/format.util.ts'
import { ResizablePanel } from '../common/resizable-panel.component.tsx'
import { SectionHeading } from '../common/section-heading.component.tsx'
import type { GuideDrafts } from './guide-drafts.util.ts'
import { type Draft, groupGuides } from './guidelines.util.ts'

function DraftChip() {
  return <span className="chip ml-auto shrink-0 bg-warn/20 py-0 text-[10px] text-warn">draft</span>
}

/** The guides by repository, the selected one marked, and how guides stack. */
export function GuideList({
  list,
  selectedId,
  drafts,
  onSelect,
}: {
  list: readonly Guideline[]
  selectedId: string | undefined
  /** Unsaved edits by guide id (`new` for a guide not saved yet), marked in the list. */
  drafts: GuideDrafts
  onSelect: (draft: Draft) => void
}) {
  const newGuide = drafts.new
  return (
    <ResizablePanel
      name="guides"
      edge="right"
      defaultWidth={288}
      label="Resize the guides list"
      className="flex flex-col border-r border-line bg-panel"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
        {newGuide !== undefined && (
          <button
            type="button"
            onClick={() => onSelect(newGuide)}
            className={joinClassNames(
              'mb-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
              selectedId === undefined && 'bg-hover',
              selectedId !== undefined && 'hover:bg-hover/60',
            )}
          >
            <span className="truncate italic">{newGuide.title || buildDefaultTitle(newGuide)}</span>
            <DraftChip />
          </button>
        )}
        {groupGuides(list).map(([repo, items]) => (
          <div key={repo} className="mb-3">
            <SectionHeading title={repo} count={items.length} className="mb-1 px-2" />
            {items.map((guideline) => (
              <button
                type="button"
                key={guideline.id}
                onClick={() => onSelect(guideline)}
                className={joinClassNames(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                  selectedId === guideline.id && 'bg-hover',
                  selectedId !== guideline.id && 'hover:bg-hover/60',
                  !guideline.enabled && 'opacity-50',
                )}
              >
                <span className="font-mono text-[11px] text-muted">{guideline.path || '/'}</span>
                <span className="truncate">{guideline.title}</span>
                {drafts[guideline.id] !== undefined && <DraftChip />}
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
    </ResizablePanel>
  )
}
