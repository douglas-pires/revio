import type { Guideline } from '@shared/guideline.types.ts'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '../common/empty-state.component.tsx'
import { errorMessage } from '../common/format.util.ts'
import { Screen, ScreenHeader } from '../common/screen.component.tsx'
import {
  draftKeyOf,
  type GuideDrafts,
  hasUnsavedChanges,
  readGuideDrafts,
  storeGuideDrafts,
  withDraft,
  withoutDraft,
} from './guide-drafts.util.ts'
import { GuideEditor } from './guide-editor.component.tsx'
import { GuideList } from './guide-list.component.tsx'
import { type Draft, defaultTitle, newDraft } from './guidelines.util.ts'

/** How long "Saved" shows after a save. */
const SAVED_NOTICE_MS = 1500

/** The guides and the repositories you can write them for, loaded from the main process. */
function useGuides() {
  const [list, setList] = useState<Guideline[]>([])
  const [repos, setRepos] = useState<string[]>([])
  const load = useCallback(async () => {
    const [l, r] = await Promise.all([globalThis.revio.listGuidelines(), globalThis.revio.knownRepos()])
    setList(l)
    setRepos(r)
    return l
  }, [])
  return { list, repos, load }
}

/** Unsaved edits per guide, written to storage as you type so they survive leaving the page. */
function useGuideDrafts() {
  const [drafts, setDrafts] = useState<GuideDrafts>(readGuideDrafts)
  const update = useCallback((change: (d: GuideDrafts) => GuideDrafts) => {
    setDrafts((d) => {
      const next = change(d)
      storeGuideDrafts(next)
      return next
    })
  }, [])
  return { drafts, update }
}

/** A guide as you left it: its unsaved draft when there is one, else as saved. */
function withEdits(d: Draft, drafts: GuideDrafts): Draft {
  return drafts[draftKeyOf(d)] ?? d
}

/** The guide to open first: the one asked for (or a new one there), else the first saved one. */
function initialDraft(list: readonly Guideline[], repo: string | undefined, path: string | undefined): Draft | null {
  if (!repo) {
    return list[0] ?? null
  }
  return list.find((g) => g.repo === repo && g.path === (path ?? '')) ?? newDraft(repo, path)
}

interface GuideSelection {
  list: readonly Guideline[]
  draft: Draft | null
  setDraft: (d: Draft | null) => void
  load: () => Promise<Guideline[]>
  update: (change: (d: GuideDrafts) => GuideDrafts) => void
}

/** Save (forgetting the draft, showing "Saved" briefly) and delete the open guide. */
function useGuideSaving({ draft, setDraft, load, update }: GuideSelection) {
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const save = async () => {
    if (!draft) {
      return
    }
    setError(null)
    try {
      const g = await globalThis.revio.saveGuideline({ ...draft, title: draft.title || defaultTitle(draft) })
      update((ds) => withoutDraft(ds, draftKeyOf(draft)))
      await load()
      setDraft(g)
      setSaved(true)
      setTimeout(() => setSaved(false), SAVED_NOTICE_MS)
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  const remove = async () => {
    // biome-ignore lint/suspicious/noAlert: in Electron, confirm() is a native macOS sheet, the expected control for a destructive step.
    if (!(draft?.id && confirm(`Delete "${draft.title}"?`))) {
      return
    }
    await globalThis.revio.deleteGuideline(draft.id)
    update((ds) => withoutDraft(ds, draftKeyOf(draft)))
    const l = await load()
    setDraft(l[0] ?? null)
  }
  return { error, saved, save, remove }
}

/** The open guide, as you left it: opening, editing (kept as a draft) and discarding the edits. */
function useGuideEditing(initialRepo: string | undefined, initialPath: string | undefined) {
  const { list, repos, load } = useGuides()
  const edits = useGuideDrafts()
  const [draft, setDraft] = useState<Draft | null>(null)
  const savedOf = (d: Draft) => list.find((g) => g.id === d.id)

  useEffect(() => {
    load().then((l) => {
      const first = initialDraft(l, initialRepo, initialPath)
      setDraft(first && withEdits(first, readGuideDrafts()))
    })
  }, [initialRepo, initialPath, load])

  // Guides synced in from another Mac show up without leaving the page; unsaved edits stay as drafts.
  useEffect(
    () =>
      globalThis.revio.onEvent((e) => {
        if (e.type === 'sync' && e.applied) {
          load()
        }
      }),
    [load],
  )

  const discard = () => {
    if (draft) {
      edits.update((ds) => withoutDraft(ds, draftKeyOf(draft)))
      setDraft(savedOf(draft) ?? list[0] ?? null)
    }
  }
  return {
    list,
    repos,
    drafts: edits.drafts,
    draft,
    unsaved: draft !== null && hasUnsavedChanges(draft, savedOf(draft)),
    open: (d: Draft) => setDraft(withEdits(d, edits.drafts)),
    change: (d: Draft) => {
      setDraft(d)
      edits.update((ds) => withDraft(ds, d, savedOf(d)))
    },
    discard,
    saving: useGuideSaving({ list, draft, setDraft, load, update: edits.update }),
  }
}

export function Guidelines({
  initialRepo,
  initialPath,
}: {
  initialRepo?: string | undefined
  initialPath?: string | undefined
}) {
  const g = useGuideEditing(initialRepo, initialPath)
  const { draft, saving } = g
  return (
    <Screen
      header={
        <ScreenHeader
          title="Review guides"
          subtitle="What Claude should look for, by repository and folder"
          actions={
            <button type="button" className="btn" onClick={() => g.open(newDraft(g.repos[0] ?? '*'))}>
              + New guide
            </button>
          }
        />
      }
    >
      <div className="flex min-h-0 flex-1">
        <GuideList list={g.list} selectedId={draft?.id} drafts={g.drafts} onSelect={g.open} />
        {draft !== null && (
          <GuideEditor
            draft={draft}
            repos={g.repos}
            saved={saving.saved}
            error={saving.error}
            unsaved={g.unsaved}
            onChange={g.change}
            onDiscard={g.discard}
            onSave={saving.save}
            onDelete={saving.remove}
          />
        )}
        {draft === null && (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState title="Create your first review guide">
              Tell Claude what matters in your repositories and what to skip.
            </EmptyState>
          </div>
        )}
      </div>
    </Screen>
  )
}
