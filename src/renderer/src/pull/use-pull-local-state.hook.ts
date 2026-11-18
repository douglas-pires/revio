import { useCallback, useState } from 'react'
import type { AskThread, BriefingRecord } from '@shared/claude.types'
import type { DraftComment, PullLocalState, PullRef } from '@shared/pull.types'

const EMPTY_STATE: PullLocalState = { drafts: [], viewed: {} }

/**
 * Local review state for one PR (drafts, viewed files, Claude chats, briefing), kept in React state
 * and persisted through the main process. Every updater is stable for the PR's lifetime.
 */
export function usePullLocalState(pull: PullRef) {
  const [local, setLocal] = useState<PullLocalState>(EMPTY_STATE)

  const updateDrafts = useCallback(
    (change: (drafts: DraftComment[]) => DraftComment[]) =>
      setLocal((l) => {
        const drafts = change(l.drafts)
        void window.revio.saveDrafts(pull, drafts)
        return { ...l, drafts }
      }),
    [pull],
  )

  const addDraft = useCallback((d: Omit<DraftComment, 'id'>) => updateDrafts((ds) => [...ds, { ...d, id: crypto.randomUUID() }]), [updateDrafts])
  const updateDraft = useCallback((id: string, body: string) => updateDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, body } : d))), [updateDrafts])
  const deleteDraft = useCallback((id: string) => updateDrafts((ds) => ds.filter((d) => d.id !== id)), [updateDrafts])
  /** After a review is submitted the main process already cleared them; mirror that locally. */
  const forgetDrafts = useCallback(() => setLocal((l) => ({ ...l, drafts: [] })), [])

  const markViewed = useCallback(
    (path: string, sha: string, viewed: boolean) => {
      void window.revio.setViewed(pull, path, viewed ? sha : null)
      setLocal((l) => {
        const next = { ...l.viewed }
        if (viewed) next[path] = sha
        else delete next[path]
        return { ...l, viewed: next }
      })
    },
    [pull],
  )

  /** Saves a Claude conversation; empty (unasked) threads are not persisted. */
  const saveThread = useCallback(
    (thread: AskThread) =>
      setLocal((l) => {
        const others = (l.asks ?? []).filter((x) => x.id !== thread.id)
        const asks = thread.messages.length ? [thread, ...others] : others
        void window.revio.saveAsks(pull, asks)
        return { ...l, asks }
      }),
    [pull],
  )

  const deleteThread = useCallback(
    (id: string) =>
      setLocal((l) => {
        const asks = (l.asks ?? []).filter((x) => x.id !== id)
        void window.revio.saveAsks(pull, asks)
        return { ...l, asks }
      }),
    [pull],
  )

  const setBriefingRecord = useCallback((briefing: BriefingRecord) => setLocal((l) => ({ ...l, briefing })), [])

  return { local, replaceLocal: setLocal, addDraft, updateDraft, deleteDraft, forgetDrafts, markViewed, saveThread, deleteThread, setBriefingRecord }
}
