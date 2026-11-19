import type { AskThread, BriefingRecord } from '@shared/claude.types.ts'
import type { DraftComment, PullLocalState, PullRef } from '@shared/pull.types.ts'
import { type Dispatch, type SetStateAction, useCallback, useState } from 'react'
import { withDraftBody, withSavedThread, withViewed } from './pull-local-state.util.ts'

const EMPTY_STATE: PullLocalState = { drafts: [], viewed: {} }

type SetLocal = Dispatch<SetStateAction<PullLocalState>>

/** Draft comments: add, edit and delete, each saved through the main process. */
function useDrafts(pull: PullRef, setLocal: SetLocal) {
  const updateDrafts = useCallback(
    (change: (drafts: DraftComment[]) => DraftComment[]) =>
      setLocal((l) => {
        const drafts = change(l.drafts)
        globalThis.revio.saveDrafts(pull, drafts)
        return { ...l, drafts }
      }),
    [pull, setLocal],
  )
  return {
    addDraft: useCallback(
      (d: Omit<DraftComment, 'id'>) => updateDrafts((ds) => [...ds, { ...d, id: crypto.randomUUID() }]),
      [updateDrafts],
    ),
    updateDraft: useCallback(
      (id: string, body: string) => updateDrafts((ds) => withDraftBody(ds, id, body)),
      [updateDrafts],
    ),
    deleteDraft: useCallback((id: string) => updateDrafts((ds) => ds.filter((d) => d.id !== id)), [updateDrafts]),
    /** After a review is submitted the main process already cleared them; mirror that locally. */
    forgetDrafts: useCallback(() => setLocal((l) => ({ ...l, drafts: [] })), [setLocal]),
  }
}

/** Claude conversations: saved (once asked) and deleted through the main process. */
function useAskThreads(pull: PullRef, setLocal: SetLocal) {
  const updateAsks = useCallback(
    (change: (asks: AskThread[]) => AskThread[]) =>
      setLocal((l) => {
        const asks = change(l.asks ?? [])
        globalThis.revio.saveAsks(pull, asks)
        return { ...l, asks }
      }),
    [pull, setLocal],
  )
  return {
    /** Saves a Claude conversation; empty (unasked) threads are not persisted. */
    saveThread: useCallback((thread: AskThread) => updateAsks((asks) => withSavedThread(asks, thread)), [updateAsks]),
    deleteThread: useCallback((id: string) => updateAsks((asks) => asks.filter((x) => x.id !== id)), [updateAsks]),
  }
}

/**
 * Local review state for one PR (drafts, viewed files, Claude chats, briefing), kept in React state
 * and persisted through the main process. Every updater is stable for the PR's lifetime.
 */
export function usePullLocalState(pull: PullRef) {
  const [local, setLocal] = useState<PullLocalState>(EMPTY_STATE)
  const markViewed = useCallback(
    (path: string, sha: string, viewed: boolean) => {
      let viewedSha: string | null = null
      if (viewed) {
        viewedSha = sha
      }
      globalThis.revio.setViewed(pull, path, viewedSha)
      setLocal((l) => ({ ...l, viewed: withViewed(l.viewed, path, viewedSha) }))
    },
    [pull],
  )
  const setBriefingRecord = useCallback((briefing: BriefingRecord) => setLocal((l) => ({ ...l, briefing })), [])
  return {
    local,
    replaceLocal: setLocal,
    ...useDrafts(pull, setLocal),
    markViewed,
    ...useAskThreads(pull, setLocal),
    setBriefingRecord,
  }
}

export type PullLocalStateApi = ReturnType<typeof usePullLocalState>
