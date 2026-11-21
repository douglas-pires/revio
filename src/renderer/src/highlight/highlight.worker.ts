/// <reference lib="webworker" />
import { type Tok, TokenHighlighter, type TokenRow } from './highlight-tokens.util.ts'

const highlighter = new TokenHighlighter()

async function answer(req: HighlightRequest): Promise<HighlightResponse> {
  if (req.kind === 'code') {
    return { id: req.id, kind: 'code', lines: await highlighter.tokenizeCode(req.language, req.code) }
  }
  const map = await highlighter.tokenizeRows(req.path, req.rows, req.patchLength)
  return { id: req.id, kind: 'rows', tokens: map && [...map] }
}

/** The answer when tokenizing throws: the request's kind with nothing highlighted. */
function failedAnswer(req: HighlightRequest): HighlightResponse {
  if (req.kind === 'code') {
    return { id: req.id, kind: 'code', lines: null }
  }
  return { id: req.id, kind: 'rows', tokens: null }
}

globalThis.onmessage = async (event: MessageEvent<HighlightRequest>) => {
  const req = event.data
  globalThis.postMessage(await answer(req).catch(() => failedAnswer(req)))
}

/** Rows of a diff, tokenized per side, or a plain code block in a named language. */
export type HighlightRequest =
  | { id: number; kind: 'rows'; path: string; rows: TokenRow[]; patchLength: number }
  | { id: number; kind: 'code'; language: string; code: string }

export type HighlightResponse =
  | { id: number; kind: 'rows'; tokens: [number, Tok[]][] | null }
  | { id: number; kind: 'code'; lines: Tok[][] | null }
