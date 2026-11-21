/// <reference lib="webworker" />
import { type Tok, TokenHighlighter, type TokenRow } from './highlight-tokens.util.ts'

const highlighter = new TokenHighlighter()

async function answer(requestedIds: HighlightRequest): Promise<HighlightResponse> {
  if (requestedIds.kind === 'code') {
    return {
      id: requestedIds.id,
      kind: 'code',
      lines: await highlighter.tokenizeCode(requestedIds.language, requestedIds.code),
    }
  }
  const map = await highlighter.tokenizeRows(requestedIds.path, requestedIds.rows, requestedIds.patchLength)
  return { id: requestedIds.id, kind: 'rows', tokens: map && [...map] }
}

/** The answer when tokenizing throws: the request's kind with nothing highlighted. */
function buildFailedAnswer(requestedIds: HighlightRequest): HighlightResponse {
  if (requestedIds.kind === 'code') {
    return { id: requestedIds.id, kind: 'code', lines: null }
  }
  return { id: requestedIds.id, kind: 'rows', tokens: null }
}

globalThis.onmessage = async (event: MessageEvent<HighlightRequest>) => {
  const requestedIds = event.data
  globalThis.postMessage(await answer(requestedIds).catch(() => buildFailedAnswer(requestedIds)))
}

/** Rows of a diff, tokenized per side, or a plain code block in a named language. */
export type HighlightRequest =
  | { id: number; kind: 'rows'; path: string; rows: TokenRow[]; patchLength: number }
  | { id: number; kind: 'code'; language: string; code: string }

export type HighlightResponse =
  | { id: number; kind: 'rows'; tokens: [number, Tok[]][] | null }
  | { id: number; kind: 'code'; lines: Tok[][] | null }
