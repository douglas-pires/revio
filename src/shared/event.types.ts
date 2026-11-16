import type { Inbox } from './inbox.types'
import type { MentionsInbox } from './mention.types'
import type { PullRef } from './pull.types'

export type MainEvent =
  | { type: 'mentions'; mentions: MentionsInbox }
  | { type: 'inbox'; inbox: Inbox }
  | { type: 'open-pull'; ref: PullRef }
  | { type: 'briefing-progress'; key: string; message: string }
  | { type: 'ask-delta'; threadId: string; text: string }
