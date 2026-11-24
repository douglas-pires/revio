import { useMemo } from 'react'
import { useEmojiSuggester } from '../emojis/use-emoji-suggester.hook.tsx'
import { useMentionSuggester } from '../mentionables/use-mention-suggester.hook.tsx'
import type { Suggester } from '../suggestions/suggestions.types.ts'

/** What comment boxes suggest as you type: emojis on ":" and who to mention on "@". */
export function useCommentSuggesters(): readonly Suggester[] {
  const emojis = useEmojiSuggester()
  const mentions = useMentionSuggester()
  return useMemo(() => [emojis, mentions], [emojis, mentions])
}
