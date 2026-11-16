import { createContext, useContext } from 'react'
import type { HighlightRequest, HighlightResponse } from '../workers/highlight.worker'
import type { DiffRow } from './diff'
import type { Tok } from './highlightTokens'

export type { Tok } from './highlightTokens'

export interface Highlighter {
  highlightRows(path: string, rows: readonly DiffRow[], patchLength: number): Promise<Map<number, Tok[]> | null>
}

/** Highlights diffs in a Web Worker so tokenizing large files never blocks scrolling or typing. */
export class WorkerHighlighter implements Highlighter {
  #worker: Worker | null = null
  #nextId = 0
  #pending = new Map<number, (tokens: Map<number, Tok[]> | null) => void>()

  #ensureWorker() {
    if (this.#worker) return this.#worker
    const worker = new Worker(new URL('../workers/highlight.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<HighlightResponse>) => {
      this.#pending.get(e.data.id)?.(e.data.tokens ? new Map(e.data.tokens) : null)
      this.#pending.delete(e.data.id)
    }
    worker.onerror = () => {
      for (const resolve of this.#pending.values()) resolve(null)
      this.#pending.clear()
    }
    this.#worker = worker
    return worker
  }

  highlightRows(path: string, rows: readonly DiffRow[], patchLength: number) {
    const id = this.#nextId++
    const request: HighlightRequest = { id, path, patchLength, rows: rows.map((r) => ({ kind: r.kind, text: r.text })) }
    return new Promise<Map<number, Tok[]> | null>((resolve) => {
      this.#pending.set(id, resolve)
      this.#ensureWorker().postMessage(request)
    })
  }

  dispose() {
    this.#worker?.terminate()
    this.#worker = null
  }
}

/** Injected at the app root (no module-level singleton); components read it from context. */
export const HighlighterContext = createContext<Highlighter | null>(null)

export function useHighlighter(): Highlighter {
  const highlighter = useContext(HighlighterContext)
  if (!highlighter) throw new Error('HighlighterContext is missing a provider')
  return highlighter
}
