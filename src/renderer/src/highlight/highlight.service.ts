import { createContext, useContext } from 'react'
import type { DiffRow } from '../pull/diff.util.ts'
import type { HighlightRequest, HighlightResponse } from './highlight.worker.ts'
import type { Tok } from './highlight-tokens.util.ts'

type RequestBody = HighlightRequest extends infer R ? (R extends HighlightRequest ? Omit<R, 'id'> : never) : never

export type { Tok } from './highlight-tokens.util.ts'

export interface Highlighter {
  highlightRows: (path: string, rows: readonly DiffRow[], patchLength: number) => Promise<Map<number, Tok[]> | null>
  /** Tokens per line of a code block in `language` (a fence name like ts or python), or null if unknown. */
  highlightCode: (language: string, code: string) => Promise<Tok[][] | null>
}

/** Highlights code in a Web Worker so tokenizing large files never blocks scrolling or typing. */
export class WorkerHighlighter implements Highlighter {
  #worker: Worker | null = null
  #nextId = 0
  readonly #pending = new Map<number, (response: HighlightResponse | null) => void>()

  #ensureWorker() {
    if (this.#worker) {
      return this.#worker
    }
    const worker = new Worker(new URL('./highlight.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<HighlightResponse>) => {
      this.#pending.get(event.data.id)?.(event.data)
      this.#pending.delete(event.data.id)
    }
    worker.onerror = () => {
      for (const resolve of this.#pending.values()) {
        resolve(null)
      }
      this.#pending.clear()
    }
    this.#worker = worker
    return worker
  }

  #request(body: RequestBody) {
    const id = this.#nextId
    this.#nextId += 1
    return new Promise<HighlightResponse | null>((resolve) => {
      this.#pending.set(id, resolve)
      this.#ensureWorker().postMessage({ ...body, id } as HighlightRequest)
    })
  }

  async highlightRows(path: string, rows: readonly DiffRow[], patchLength: number) {
    const res = await this.#request({
      kind: 'rows',
      path,
      patchLength,
      rows: rows.map((row) => ({ kind: row.kind, text: row.text })),
    })
    if (res?.kind !== 'rows' || !res.tokens) {
      return null
    }
    return new Map(res.tokens)
  }

  async highlightCode(language: string, code: string) {
    const res = await this.#request({ kind: 'code', language, code })
    if (res?.kind !== 'code') {
      return null
    }
    return res.lines
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
  if (!highlighter) {
    throw new Error('HighlighterContext is missing a provider')
  }
  return highlighter
}
