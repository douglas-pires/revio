import type { Guideline } from '@shared/guideline.types.ts'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '../common/empty-state.component.tsx'
import { readErrorMessage } from '../common/format.util.ts'
import { Screen, ScreenHeader } from '../common/screen.component.tsx'
import {
  applyDraft,
  buildDraftKey,
  type GuideDrafts,
  hasUnsavedChanges,
  readGuideDrafts,
  removeDraft,
  storeGuideDrafts,
} from './guide-drafts.util.ts'
import { GuideEditor } from './guide-editor.component.tsx'
import { GuideList } from './guide-list.component.tsx'
import { buildDefaultTitle, type Draft, makeNewDraft } from './guidelines.util.ts'

/** How long "Saved" shows after a save. */
const SAVED_NOTICE_MS = 1500

/** The guides and the repositories you can write them for, loaded from the main process. */
function useGuides() {
  const [list, setList] = useState<Guideline[]>([])
  const [repos, setRepos] = useState<string[]>([])
  const load = useCallback(async () => {
    const [guidelines, r] = await Promise.all([globalThis.revio.listGuidelines(), globalThis.revio.knownRepos()])
    setList(guidelines)
    setRepos(r)
    return guidelines
  }, [])
  return { list, repos, load }
}

/** Unsaved edits per guide, written to storage as you type so they survive leaving the page. */
function useGuideDrafts() {
  const [drafts, setDrafts] = useState<GuideDrafts>(readGuideDrafts)
  const update = useCallback((change: (drafts: GuideDrafts) => GuideDrafts) => {
    setDrafts((current) => {
      const next = change(current)
      storeGuideDrafts(next)
      return next
    })
  }, [])
  return { drafts, update }
}

/** A guide as you left it: its unsaved draft when there is one, else as saved. */
function applyEdits(draft: Draft, drafts: GuideDrafts): Draft {
  return drafts[buildDraftKey(draft)] ?? draft
}

/** The guide to open first: the one asked for (or a new one there), else the first saved one. */
function findInitialDraft(
  list: readonly Guideline[],
  repo: string | undefined,
  path: string | undefined,
): Draft | null {
  if (!repo) {
    return list[0] ?? null
  }
  return (
    list.find((guideline) => guideline.repo === repo && guideline.path === (path ?? '')) ?? makeNewDraft(repo, path)
  )
}

interface GuideSelection {
  list: readonly Guideline[]
  draft: Draft | null
  setDraft: (draft: Draft | null) => void
  load: () => Promise<Guideline[]>
  update: (change: (drafts: GuideDrafts) => GuideDrafts) => void
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
      const savedGuideline = await globalThis.revio.saveGuideline({
        ...draft,
        title: draft.title || buildDefaultTitle(draft),
      })
      update((drafts) => removeDraft(drafts, buildDraftKey(draft)))
      await load()
      setDraft(savedGuideline)
      setSaved(true)
      setTimeout(() => setSaved(false), SAVED_NOTICE_MS)
    } catch (failure) {
      setError(readErrorMessage(failure))
    }
  }
  const remove = async () => {
    // biome-ignore lint/suspicious/noAlert: in Electron, confirm() is a native macOS sheet, the expected control for a destructive step.
    if (!(draft?.id && confirm(`Delete "${draft.title}"?`))) {
      return
    }
    await globalThis.revio.deleteGuideline(draft.id)
    update((drafts) => removeDraft(drafts, buildDraftKey(draft)))
    const loaded = await load()
    setDraft(loaded[0] ?? null)
  }
  return { error, saved, save, remove }
}

/** The open guide, as you left it: opening, editing (kept as a draft) and discarding the edits. */
function useGuideEditing(initialRepo: string | undefined, initialPath: string | undefined) {
  const { list, repos, load } = useGuides()
  const edits = useGuideDrafts()
  const [draft, setDraft] = useState<Draft | null>(null)
  const findSaved = (candidate: Draft) => list.find((guideline) => guideline.id === candidate.id)

  useEffect(() => {
    load().then((loaded) => {
      const first = findInitialDraft(loaded, initialRepo, initialPath)
      setDraft(first && applyEdits(first, readGuideDrafts()))
    })
  }, [initialRepo, initialPath, load])

  // Guides synced in from another Mac show up without leaving the page; unsaved edits stay as drafts.
  useEffect(
    () =>
      globalThis.revio.onEvent((event) => {
        if (event.type === 'sync' && event.applied) {
          load()
        }
      }),
    [load],
  )

  const discard = () => {
    if (draft) {
      edits.update((drafts) => removeDraft(drafts, buildDraftKey(draft)))
      setDraft(findSaved(draft) ?? list[0] ?? null)
    }
  }
  return {
    list,
    repos,
    drafts: edits.drafts,
    draft,
    unsaved: draft !== null && hasUnsavedChanges(draft, findSaved(draft)),
    open: (opened: Draft) => setDraft(applyEdits(opened, edits.drafts)),
    change: (changed: Draft) => {
      setDraft(changed)
      edits.update((drafts) => applyDraft(drafts, changed, findSaved(changed)))
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
  const editing = useGuideEditing(initialRepo, initialPath)
  const { draft, saving } = editing
  return (
    <Screen
      header={
        <ScreenHeader
          title="Review guides"
          subtitle="What Claude should look for, by repository and folder"
          actions={
            <button type="button" className="btn" onClick={() => editing.open(makeNewDraft(editing.repos[0] ?? '*'))}>
              + New guide
            </button>
          }
        />
      }
    >
      <div className="flex min-h-0 flex-1">
        <GuideList list={editing.list} selectedId={draft?.id} drafts={editing.drafts} onSelect={editing.open} />
        {draft !== null && (
          <GuideEditor
            draft={draft}
            repos={editing.repos}
            saved={saving.saved}
            error={saving.error}
            unsaved={editing.unsaved}
            onChange={editing.change}
            onDiscard={editing.discard}
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
