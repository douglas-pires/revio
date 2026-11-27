import { findShortcutConflict } from './shortcut.util.ts'

/** Everything a shortcut can do: the keys until you change them, by where it works. */
const ACTIONS = {
  'show-shortcuts': { label: 'Show the shortcuts', group: 'Anywhere', defaultShortcut: 'Cmd+Shift+S' },
  palette: { label: 'Show the actions for this screen', group: 'Anywhere', defaultShortcut: 'Cmd+K' },
  settings: { label: 'Open or leave the settings', group: 'Anywhere', defaultShortcut: 'Cmd+.' },
  search: { label: 'Search', group: 'Anywhere', defaultShortcut: '/' },
  'review-block': {
    label: 'Start a review block, or pause and resume it',
    group: 'Anywhere',
    defaultShortcut: 'Cmd+Shift+F',
  },
  'save-guide': { label: 'Save the review guide', group: 'Anywhere', defaultShortcut: 'Cmd+S' },
  'git-log': { label: 'Show or hide the git log', group: 'Pull request', defaultShortcut: 'Ctrl+G' },
  'quick-open': { label: 'Go to a changed file', group: 'Pull request', defaultShortcut: 'Cmd+P' },
  'copy-branch': { label: 'Copy the branch name', group: 'Pull request', defaultShortcut: 'Cmd+Shift+B' },
  'since-review': {
    label: 'Show only the changes since your review, or the whole PR',
    group: 'Pull request',
    defaultShortcut: 'S',
  },
  send: { label: 'Send a comment or review', group: 'Pull request', defaultShortcut: 'Cmd+Enter' },
  find: { label: 'Find in the changed files', group: 'Files changed', defaultShortcut: 'Cmd+F' },
  'find-next': { label: 'Next find match', group: 'Files changed', defaultShortcut: 'Cmd+G' },
  'find-previous': { label: 'Previous find match', group: 'Files changed', defaultShortcut: 'Cmd+Shift+G' },
  'next-file': { label: 'Next file', group: 'Files changed', defaultShortcut: 'J' },
  'previous-file': { label: 'Previous file', group: 'Files changed', defaultShortcut: 'K' },
  'toggle-viewed': { label: 'Mark the file viewed, or not', group: 'Files changed', defaultShortcut: 'V' },
  unview: { label: 'Unview the file and select it', group: 'Files changed', defaultShortcut: 'Cmd+Shift+V' },
  'copy-file': { label: 'Copy the selected file’s path', group: 'Files changed', defaultShortcut: 'Cmd+Shift+C' },
  'open-in-editor': { label: 'Open in editor', group: 'Files changed', defaultShortcut: 'Cmd+O' },
  'next-commit': { label: 'Show the next commit on its own', group: 'Files changed', defaultShortcut: ']' },
  'previous-commit': { label: 'Show the previous commit on its own', group: 'Files changed', defaultShortcut: '[' },
  'find-usages': {
    label: 'Find where the selected name is defined and used (or ⌘-click it)',
    group: 'Files changed',
    defaultShortcut: 'Cmd+Shift+U',
  },
} as const satisfies Record<string, Omit<ShortcutAction, 'id'>>

/** The two shortcuts that had a setting of their own before all of them could be changed. */
const FORMER_SETTINGS = { openInEditorShortcut: 'open-in-editor', gitLogShortcut: 'git-log' } as const

const actionIds = Object.keys(ACTIONS) as ShortcutActionId[]

export type ShortcutActionId = keyof typeof ACTIONS

/** Something a shortcut does. */
export interface ShortcutAction {
  id: ShortcutActionId
  label: string
  /** Where it works, to list it under. */
  group: string
  /** Its keys until you change them. */
  defaultShortcut: string
}

/** The keys you chose, by action; an action left out keeps its default and '' turns it off. */
export type ShortcutOverrides = Partial<Record<ShortcutActionId, string>>

export type Shortcuts = Record<ShortcutActionId, string>

/** Every action, in the order they are listed. */
export const SHORTCUT_ACTIONS: readonly ShortcutAction[] = actionIds.map((id) => ({ id, ...ACTIONS[id] }))

export function findShortcutAction(id: ShortcutActionId): ShortcutAction {
  return { id, ...ACTIONS[id] }
}

/** The keys of every action: yours where you chose some, else the default. */
export function resolveShortcuts(overrides: ShortcutOverrides): Shortcuts {
  const entries = SHORTCUT_ACTIONS.map(({ id, defaultShortcut }) => [id, overrides[id] ?? defaultShortcut])
  return Object.fromEntries(entries) as Shortcuts
}

/** `overrides` with the action on `shortcut`; its default is not stored, so a later default still reaches you. */
export function overrideShortcut(
  overrides: ShortcutOverrides,
  id: ShortcutActionId,
  shortcut: string,
): ShortcutOverrides {
  const { [id]: _replaced, ...others } = overrides
  if (shortcut === findShortcutAction(id).defaultShortcut) {
    return others
  }
  return { ...others, [id]: shortcut }
}

/** What giving `shortcut` to the action would clash with: another action or macOS. Null when it is free. */
export function findActionConflict(id: ShortcutActionId, shortcut: string, shortcuts: Shortcuts): string | null {
  const others = SHORTCUT_ACTIONS.filter((action) => action.id !== id)
  return findShortcutConflict(
    shortcut,
    others.map((action) => ({ shortcut: shortcuts[action.id], action: action.label })),
  )
}

/** Stored settings with the two shortcuts that had their own setting moved in with the rest. */
export function moveFormerShortcuts(settings: Record<string, unknown>): Record<string, unknown> {
  const { openInEditorShortcut, gitLogShortcut, ...rest } = settings
  let overrides = { ...(settings.shortcuts as ShortcutOverrides | undefined) }
  for (const [name, shortcut] of Object.entries({ openInEditorShortcut, gitLogShortcut })) {
    const id = FORMER_SETTINGS[name as keyof typeof FORMER_SETTINGS]
    if (typeof shortcut === 'string' && overrides[id] === undefined) {
      overrides = overrideShortcut(overrides, id, shortcut)
    }
  }
  return { ...rest, shortcuts: overrides }
}
