import { createContext, useContext } from 'react'
import type { HighlightRequest, HighlightResponse } from './highlight.worker'
import type { DiffRow } from '../pull/diff.util'
import type { Tok } from './highlight-tokens.util'

export type { Tok } from './highlight-tokens.util'

export interface Highlighter {
  highlightRows(path: string, rows: readonly DiffRow[], patchLength: number): Promise<Map<number, Tok[]> | null>
  /** Tokens per line of a code block in `language` (a fence name like ts or python), or null if unknown. */
  highlightCode(language: string, code: string): Promise<Tok[][] | null>
}

type RequestBody = HighlightRequest extends infer R ? (R extends HighlightRequest ? Omit<R, 'id'> : never) : never

/** Highlights code in a Web Worker so tokenizing large files never blocks scrolling or typing. */
export class WorkerHighlighter implements Highlighter {
  #worker: Worker | null = null
  #nextId = 0
  #pending = new Map<number, (response: HighlightResponse | null) => void>()

  #ensureWorker() {
    if (this.#worker) return this.#worker
    const worker = new Worker(new URL('./highlight.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<HighlightResponse>) => {
      this.#pending.get(e.data.id)?.(e.data)
      this.#pending.delete(e.data.id)
    }
    worker.onerror = () => {
      for (const resolve of this.#pending.values()) resolve(null)
      this.#pending.clear()
    }
    this.#worker = worker
    return worker
  }

  #request(body: RequestBody) {
    const id = this.#nextId++
    return new Promise<HighlightResponse | null>((resolve) => {
      this.#pending.set(id, resolve)
      this.#ensureWorker().postMessage({ ...body, id } as HighlightRequest)
    })
  }

  async highlightRows(path: string, rows: readonly DiffRow[], patchLength: number) {
    const res = await this.#request({ kind: 'rows', path, patchLength, rows: rows.map((r) => ({ kind: r.kind, text: r.text })) })
    return res?.kind === 'rows' && res.tokens ? new Map(res.tokens) : null
  }

  async highlightCode(language: string, code: string) {
    const res = await this.#request({ kind: 'code', language, code })
    return res?.kind === 'code' ? res.lines : null
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
