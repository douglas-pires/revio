import type { AskThread, BriefingRecord } from '@shared/claude.types.ts'
import type { DraftComment, PullLocalState, PullRef } from '@shared/pull.types.ts'
import { type Dispatch, type SetStateAction, useCallback, useState } from 'react'
import { saveThread, setViewed, updateDraftBody } from './pull-local-state.util.ts'

const EMPTY_STATE: PullLocalState = { drafts: [], viewed: {} }

type SetLocal = Dispatch<SetStateAction<PullLocalState>>

/** Draft comments: add, edit and delete, each saved through the main process. */
function useDrafts(pull: PullRef, setLocal: SetLocal) {
  const updateDrafts = useCallback(
    (change: (drafts: DraftComment[]) => DraftComment[]) =>
      setLocal((current) => {
        const drafts = change(current.drafts)
        globalThis.revio.saveDrafts(pull, drafts)
        return { ...current, drafts }
      }),
    [pull, setLocal],
  )
  return {
    addDraft: useCallback(
      (draft: Omit<DraftComment, 'id'>) => updateDrafts((ds) => [...ds, { ...draft, id: crypto.randomUUID() }]),
      [updateDrafts],
    ),
    updateDraft: useCallback(
      (id: string, body: string) => updateDrafts((ds) => updateDraftBody(ds, id, body)),
      [updateDrafts],
    ),
    deleteDraft: useCallback(
      (id: string) => updateDrafts((ds) => ds.filter((draft) => draft.id !== id)),
      [updateDrafts],
    ),
    /** After a review is submitted the main process already cleared them; mirror that locally. */
    forgetDrafts: useCallback(() => setLocal((current) => ({ ...current, drafts: [] })), [setLocal]),
  }
}

/** Claude conversations: saved (once asked) and deleted through the main process. */
function useAskThreads(pull: PullRef, setLocal: SetLocal) {
  const updateAsks = useCallback(
    (change: (asks: AskThread[]) => AskThread[]) =>
      setLocal((current) => {
        const asks = change(current.asks ?? [])
        globalThis.revio.saveAsks(pull, asks)
        return { ...current, asks }
      }),
    [pull, setLocal],
  )
  return {
    /** Saves a Claude conversation; empty (unasked) threads are not persisted. */
    saveThread: useCallback((thread: AskThread) => updateAsks((asks) => saveThread(asks, thread)), [updateAsks]),
    deleteThread: useCallback(
      (id: string) => updateAsks((asks) => asks.filter((saved) => saved.id !== id)),
      [updateAsks],
    ),
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
      setLocal((current) => ({ ...current, viewed: setViewed(current.viewed, path, viewedSha) }))
    },
    [pull],
  )
  const setBriefingRecord = useCallback(
    (briefing: BriefingRecord) => setLocal((current) => ({ ...current, briefing })),
    [],
  )
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
