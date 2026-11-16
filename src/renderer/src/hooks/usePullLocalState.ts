import { useCallback, useState } from 'react'
import type { AskThread, BriefingRecord, DraftComment, PullLocalState } from '@shared/types'

const EMPTY_STATE: PullLocalState = { drafts: [], viewed: {} }

/**
 * Local review state for one PR (drafts, viewed files, Claude chats, briefing), kept in React state
 * and persisted through the main process. Every updater is stable for the PR's lifetime.
 */
export function usePullLocalState(repo: string, number: number) {
  const [local, setLocal] = useState<PullLocalState>(EMPTY_STATE)

  const updateDrafts = useCallback(
    (change: (drafts: DraftComment[]) => DraftComment[]) =>
      setLocal((l) => {
        const drafts = change(l.drafts)
        void window.revio.saveDrafts(repo, number, drafts)
        return { ...l, drafts }
      }),
    [repo, number],
  )

  const addDraft = useCallback((d: Omit<DraftComment, 'id'>) => updateDrafts((ds) => [...ds, { ...d, id: crypto.randomUUID() }]), [updateDrafts])
  const updateDraft = useCallback((id: string, body: string) => updateDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, body } : d))), [updateDrafts])
  const deleteDraft = useCallback((id: string) => updateDrafts((ds) => ds.filter((d) => d.id !== id)), [updateDrafts])
  /** After a review is submitted the main process already cleared them; mirror that locally. */
  const forgetDrafts = useCallback(() => setLocal((l) => ({ ...l, drafts: [] })), [])

  const markViewed = useCallback(
    (path: string, sha: string, viewed: boolean) => {
      void window.revio.setViewed(repo, number, path, viewed ? sha : null)
      setLocal((l) => {
        const next = { ...l.viewed }
        if (viewed) next[path] = sha
        else delete next[path]
        return { ...l, viewed: next }
      })
    },
    [repo, number],
  )

  /** Saves a Claude conversation; empty (unasked) threads are not persisted. */
  const saveThread = useCallback(
    (thread: AskThread) =>
      setLocal((l) => {
        const others = (l.asks ?? []).filter((x) => x.id !== thread.id)
        const asks = thread.messages.length ? [thread, ...others] : others
        void window.revio.saveAsks(repo, number, asks)
        return { ...l, asks }
      }),
    [repo, number],
  )

  const setBriefingRecord = useCallback((briefing: BriefingRecord) => setLocal((l) => ({ ...l, briefing })), [])

  return { local, replaceLocal: setLocal, addDraft, updateDraft, deleteDraft, forgetDrafts, markViewed, saveThread, setBriefingRecord }
}
