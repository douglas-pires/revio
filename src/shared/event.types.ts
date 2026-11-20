import type { AskActivity } from './claude.types.ts'
import type { Inbox } from './inbox.types.ts'
import type { MentionsInbox } from './mention.types.ts'
import type { PullRef } from './pull.types.ts'
import type { UpdateStatus } from './update.types.ts'

export type MainEvent =
  | { type: 'mentions'; mentions: MentionsInbox }
  | { type: 'inbox'; inbox: Inbox }
  | { type: 'open-pull'; ref: PullRef }
  /** Back/forward from the Go menu or a trackpad swipe. */
  | { type: 'navigate'; direction: 'back' | 'forward' }
  | { type: 'update'; status: UpdateStatus }
  | { type: 'briefing-progress'; key: string; message: string }
  | { type: 'ask-delta'; threadId: string; text: string }
  /** What Claude is doing on a question, before and while the answer streams. */
  | { type: 'ask-activity'; threadId: string; activity: AskActivity }
