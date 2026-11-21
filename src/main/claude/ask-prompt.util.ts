import type { AskContext, AskMessage } from '@shared/claude.types.ts'

const SIDE_LABELS: Record<AskContext['side'], string> = {
  LEFT: 'removed/old side (base line numbers)',
  RIGHT: 'new side (head line numbers)',
}

/** A selection of the diff as Claude reads it: path, lines, side and the lines themselves. */
export function buildSelectionBlock(selection: AskContext, tag = 'selection') {
  let lines = `${selection.startLine}-${selection.endLine}`
  if (selection.startLine === selection.endLine) {
    lines = `${selection.startLine}`
  }
  return `<${tag} path="${selection.path}" lines="${lines}" side="${SIDE_LABELS[selection.side]}">\n${selection.snippet}\n</${tag}>`
}

/** A question as sent: the lines added for it first, then the question. */
export function buildQuestionText(message: AskMessage) {
  const added = (message.context ?? []).map((selection) => buildSelectionBlock(selection, 'added_selection'))
  return [...added, message.content].join('\n\n')
}

/** A message as sent: questions with their added lines, answers as they were. */
export function buildMessageText(message: AskMessage) {
  if (message.role === 'user') {
    return buildQuestionText(message)
  }
  return message.content
}
