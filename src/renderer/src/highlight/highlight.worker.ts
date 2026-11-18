/// <reference lib="webworker" />
import { TokenHighlighter, type Tok, type TokenRow } from './highlight-tokens.util'

/** Rows of a diff, tokenized per side, or a plain code block in a named language. */
export type HighlightRequest =
  | { id: number; kind: 'rows'; path: string; rows: TokenRow[]; patchLength: number }
  | { id: number; kind: 'code'; language: string; code: string }

export type HighlightResponse =
  | { id: number; kind: 'rows'; tokens: [number, Tok[]][] | null }
  | { id: number; kind: 'code'; lines: Tok[][] | null }

const highlighter = new TokenHighlighter()

async function answer(req: HighlightRequest): Promise<HighlightResponse> {
  if (req.kind === 'code') return { id: req.id, kind: 'code', lines: await highlighter.tokenizeCode(req.language, req.code) }
  const map = await highlighter.tokenizeRows(req.path, req.rows, req.patchLength)
  return { id: req.id, kind: 'rows', tokens: map ? [...map] : null }
}

self.onmessage = async (e: MessageEvent<HighlightRequest>) => {
  const req = e.data
  const failed: HighlightResponse = req.kind === 'code' ? { id: req.id, kind: 'code', lines: null } : { id: req.id, kind: 'rows', tokens: null }
  self.postMessage(await answer(req).catch(() => failed))
}
