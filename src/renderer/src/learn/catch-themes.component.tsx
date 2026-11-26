import type { CatchTheme, SavedCatchThemes } from '@shared/learn.types.ts'
import { useCallback, useState } from 'react'
import { formatAge } from '../common/format.util.ts'
import { Markdown } from '../common/markdown.component.tsx'
import { useAsyncAction } from '../common/use-async-action.hook.ts'
import { GuideEntryDialog } from '../guidelines/guide-entry-dialog.component.tsx'
import { useLoaded } from './use-loaded.hook.ts'

/** One kind of catch, with its tip and the way to keep the tip in a guide. */
function ThemeRow({ theme, repo }: { theme: CatchTheme; repo: string }) {
  const [adding, setAdding] = useState(false)
  return (
    <li className="border-t border-line px-4 py-2.5 first:border-t-0">
      <div className="flex items-baseline gap-2">
        <span className="font-medium">{theme.name}</span>
        <span className="text-[11.5px] text-muted">{theme.count}</span>
      </div>
      <Markdown className="text-[12.5px] text-muted">{theme.description}</Markdown>
      <div className="mt-1.5 flex items-start gap-2 rounded-md bg-accent/10 px-2.5 py-1.5">
        <span aria-hidden={true}>💡</span>
        <Markdown className="flex-1 text-[12.5px]">{theme.tip}</Markdown>
        <button type="button" className="btn btn-ghost shrink-0 py-0 text-accent" onClick={() => setAdding(true)}>
          Add to a guide
        </button>
      </div>
      {Boolean(adding) && <GuideEntryDialog repo={repo} path="" comment={theme.tip} onClose={() => setAdding(false)} />}
    </li>
  )
}

/** The button that asks Claude: to group the points the first time, or again later. */
function GroupButton({ grouped, busy, onClick }: { grouped: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn text-accent" disabled={busy} onClick={onClick}>
      {Boolean(busy) && 'Claude is reading their points…'}
      {!(busy || grouped) && '✦ What kinds of things do others catch?'}
      {!busy && grouped && 'Group again'}
    </button>
  )
}

/**
 * "What kinds of things do others catch?" and Claude's grouping, saved so it is there on the next visit; separate for
 * people only and for bots and AI reviewers too.
 */
export function CatchThemes({ repo, includeBots, days }: { repo: string; includeBots: boolean; days: number }) {
  const loadSaved = useCallback(() => globalThis.revio.getOtherCatches(includeBots, days), [includeBots, days])
  const saved = useLoaded(loadSaved)
  const [fresh, setFresh] = useState<{ includeBots: boolean; themes: SavedCatchThemes } | null>(null)
  const grouping = useAsyncAction()
  let current = saved.value
  if (fresh?.includeBots === includeBots) {
    current = fresh.themes
  }
  const group = () =>
    grouping.run(async () =>
      setFresh({ includeBots, themes: await globalThis.revio.summarizeOtherCatches(includeBots, days) }),
    )
  return (
    <div className="mb-5">
      {current !== null && (
        <ul className="card mb-2 text-[12.5px]">
          {current.themes.map((theme) => (
            <ThemeRow key={theme.name} theme={theme} repo={repo} />
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <GroupButton grouped={current !== null} busy={grouping.busy} onClick={group} />
        {current !== null && (
          <span className="text-[11.5px] text-muted">Grouped {formatAge(current.createdAt)} ago</span>
        )}
      </div>
      {Boolean(grouping.error) && <p className="mt-1 text-[12px] text-danger">{grouping.error}</p>}
    </div>
  )
}
