/// <reference lib="webworker" />
import { TokenHighlighter, type Tok, type TokenRow } from '../lib/highlightTokens'

export interface HighlightRequest {
  id: number
  path: string
  rows: TokenRow[]
  patchLength: number
}

export interface HighlightResponse {
  id: number
  tokens: [number, Tok[]][] | null
}

const highlighter = new TokenHighlighter()

self.onmessage = async (e: MessageEvent<HighlightRequest>) => {
  const { id, path, rows, patchLength } = e.data
  let tokens: HighlightResponse['tokens'] = null
  try {
    const map = await highlighter.tokenizeRows(path, rows, patchLength)
    tokens = map ? [...map] : null
  } catch {
    tokens = null
  }
  self.postMessage({ id, tokens } satisfies HighlightResponse)
}
