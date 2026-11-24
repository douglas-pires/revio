import { useMemo } from 'react'
import { useEmojiSuggester } from '../emojis/use-emoji-suggester.hook.tsx'
import type { Suggester } from '../suggestions/suggestions.types.ts'

/** What comment boxes suggest as you type: emojis on ":". */
export function useCommentSuggesters(): readonly Suggester[] {
  const emojis = useEmojiSuggester()
  return useMemo(() => [emojis], [emojis])
}
