import type { Emoji } from '@shared/emoji.types.ts'
import { useMemo, useState } from 'react'
import type { Suggester } from '../suggestions/suggestions.types.ts'
import { suggestEmojis } from './emoji-suggestions.util.ts'

const PICTURE_PX = 18

/** ":" suggests GitHub's emojis. They are loaded the first time it is typed. */
export function useEmojiSuggester(): Suggester {
  const [emojis, setEmojis] = useState<readonly Emoji[] | null>(null)
  return useMemo(
    () => ({
      character: ':',
      prepare: () => {
        if (emojis) {
          return
        }
        globalThis.revio
          .listEmojis()
          .then(setEmojis)
          .catch(() => {
            // No suggestions now; the next ":" tries again.
          })
      },
      suggest: (query) =>
        suggestEmojis(emojis ?? [], query).map((emoji) => ({
          key: emoji.name,
          text: emoji.text,
          label: `:${emoji.name}:`,
          picture: <img src={emoji.imageUrl} alt="" width={PICTURE_PX} height={PICTURE_PX} className="shrink-0" />,
        })),
    }),
    [emojis],
  )
}
