import type { UpdateStatus } from './update.types'
import type { Inbox } from './inbox.types'
import type { MentionsInbox } from './mention.types'
import type { PullRef } from './pull.types'

export type MainEvent =
  | { type: 'mentions'; mentions: MentionsInbox }
  | { type: 'inbox'; inbox: Inbox }
  | { type: 'open-pull'; ref: PullRef }
  /** Back/forward from the Go menu or a trackpad swipe. */
  | { type: 'navigate'; direction: 'back' | 'forward' }
  | { type: 'update'; status: UpdateStatus }
  | { type: 'briefing-progress'; key: string; message: string }
  | { type: 'ask-delta'; threadId: string; text: string }
