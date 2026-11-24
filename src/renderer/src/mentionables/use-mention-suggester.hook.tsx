import type { Mentionable } from '@shared/mentionable.types.ts'
import { useContext, useMemo, useState } from 'react'
import type { Suggester } from '../suggestions/suggestions.types.ts'
import { MentionScopeContext } from './mention-scope.context.ts'
import { suggestMentionables } from './mention-suggestions.util.ts'

const AVATAR_PX = 18
const NOBODY: ReadonlySet<string> = new Set()

/** "@" suggests who can be mentioned in the repository. They are loaded the first time it is typed. */
export function useMentionSuggester(): Suggester {
  const scope = useContext(MentionScopeContext)
  const [mentionables, setMentionables] = useState<readonly Mentionable[] | null>(null)
  return useMemo(
    () => ({
      character: '@',
      prepare: () => {
        if (mentionables || !scope) {
          return
        }
        globalThis.revio
          .listMentionables(scope.repo)
          .then(setMentionables)
          .catch(() => {
            // No suggestions now; the next "@" tries again.
          })
      },
      suggest: (query) =>
        suggestMentionables(mentionables ?? [], scope?.participants ?? NOBODY, query).map((mentionable) => ({
          key: mentionable.handle,
          text: `@${mentionable.handle}`,
          label: `@${mentionable.handle}`,
          detail: mentionable.name ?? undefined,
          picture: (
            <img
              src={mentionable.avatarUrl}
              alt=""
              width={AVATAR_PX}
              height={AVATAR_PX}
              className="shrink-0 rounded-full"
            />
          ),
        })),
    }),
    [mentionables, scope],
  )
}
