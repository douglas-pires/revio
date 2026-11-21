import type { AskContext, AskMessage } from '@shared/claude.types.ts'

const SIDE_LABELS: Record<AskContext['side'], string> = {
  LEFT: 'removed/old side (base line numbers)',
  RIGHT: 'new side (head line numbers)',
}

/** A selection of the diff as Claude reads it: path, lines, side and the lines themselves. */
export function selectionBlock(sel: AskContext, tag = 'selection') {
  let lines = `${sel.startLine}-${sel.endLine}`
  if (sel.startLine === sel.endLine) {
    lines = `${sel.startLine}`
  }
  return `<${tag} path="${sel.path}" lines="${lines}" side="${SIDE_LABELS[sel.side]}">\n${sel.snippet}\n</${tag}>`
}

/** A question as sent: the lines added for it first, then the question. */
export function questionText(message: AskMessage) {
  const added = (message.context ?? []).map((selection) => selectionBlock(selection, 'added_selection'))
  return [...added, message.content].join('\n\n')
}

/** A message as sent: questions with their added lines, answers as they were. */
export function messageText(message: AskMessage) {
  if (message.role === 'user') {
    return questionText(message)
  }
  return message.content
}
