import type { AskActivity } from '@shared/claude.types.ts'

/** Where the answer and what Claude is doing while it writes it go. */
export interface AskStream {
  onText: (delta: string) => void
  onActivity: (activity: AskActivity) => void
}

/** Claude's answer as it streams: reasoning first (when shown), then the text. */
export interface AnswerStream {
  text: (delta: string) => void
  thinking: (delta: string) => void
}

/**
 * Turns the model's stream into what the chat shows: a "Thinking" step when its reasoning starts, the reasoning itself,
 * and a "Writing the answer" step when the first words of the answer arrive.
 */
export function answerStream(stream: AskStream): AnswerStream {
  let phase: 'waiting' | 'thinking' | 'writing' = 'waiting'
  return {
    text: (delta) => {
      if (phase !== 'writing') {
        phase = 'writing'
        stream.onActivity({ kind: 'step', label: 'Writing the answer' })
      }
      stream.onText(delta)
    },
    thinking: (delta) => {
      if (phase === 'writing') {
        return
      }
      if (phase === 'waiting') {
        phase = 'thinking'
        stream.onActivity({ kind: 'step', label: 'Thinking' })
      }
      stream.onActivity({ kind: 'thinking', text: delta })
    },
  }
}
