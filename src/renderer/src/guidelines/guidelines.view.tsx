import type { Guideline } from '@shared/guideline.types.ts'
import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../common/format.util.ts'
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

/** The guide to open first: the one asked for (or a new one there), else the first saved one. */
function initialDraft(list: readonly Guideline[], repo: string | undefined, path: string | undefined): Draft | null {
  if (!repo) {
    return list[0] ?? null
  }
  return list.find((g) => g.repo === repo && g.path === (path ?? '')) ?? newDraft(repo, path)
}

export function Guidelines({
  initialRepo,
  initialPath,
}: {
  initialRepo?: string | undefined
  initialPath?: string | undefined
}) {
  const { list, repos, load } = useGuides()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    load().then((l) => setDraft(initialDraft(l, initialRepo, initialPath)))
  }, [initialRepo, initialPath, load])

  const save = async () => {
    if (!draft) {
      return
    }
    setError(null)
    try {
      const g = await globalThis.revio.saveGuideline({ ...draft, title: draft.title || defaultTitle(draft) })
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
    const l = await load()
    setDraft(l[0] ?? null)
  }

  return (
    <div className="flex h-full">
      <GuideList
        list={list}
        selectedId={draft?.id}
        onSelect={setDraft}
        onNew={() => setDraft(newDraft(repos[0] ?? '*'))}
      />
      {draft !== null && (
        <GuideEditor
          draft={draft}
          repos={repos}
          saved={saved}
          error={error}
          onChange={setDraft}
          onSave={save}
          onDelete={remove}
        />
      )}
      {draft === null && (
        <div className="flex flex-1 items-center justify-center text-muted">Create your first review guide.</div>
      )}
    </div>
  )
}
