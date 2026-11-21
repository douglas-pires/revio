import type { Guideline } from '@shared/guideline.types.ts'
import { type Draft, TEMPLATE } from './guidelines.util.ts'

const STORAGE_KEY = 'revio.guideDrafts'
/** The key of the one new guide being written before it has an id. */
const NEW_GUIDE = 'new'

const isText = (value: unknown) => typeof value === 'string'

function isDraft(value: unknown): value is Draft {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const fields = value as Record<string, unknown>
  return (
    isText(fields.repo) &&
    isText(fields.path) &&
    isText(fields.title) &&
    isText(fields.body) &&
    typeof fields.enabled === 'boolean'
  )
}

/** Unsaved edits by guide: its id, or `new` for a guide not saved yet. */
export type GuideDrafts = Readonly<Partial<Record<string, Draft>>>

export function draftKeyOf(draft: Draft): string {
  return draft.id ?? NEW_GUIDE
}

/** What `GuideDrafts` stores, keeping only well-formed drafts; anything unreadable reads as none. */
export function parseGuideDrafts(raw: string | null): GuideDrafts {
  if (raw === null) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return {}
    }
    return Object.fromEntries(Object.entries(parsed).filter(([, entry]) => isDraft(entry)))
  } catch {
    return {}
  }
}

/** Unsaved edits kept in this browser's storage, so leaving the page or quitting does not lose them. */
export function readGuideDrafts(): GuideDrafts {
  try {
    return parseGuideDrafts(localStorage.getItem(STORAGE_KEY))
  } catch {
    return {}
  }
}

export function storeGuideDrafts(drafts: GuideDrafts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
  } catch {
    // Storage can be unavailable; the drafts then last until the page closes.
  }
}

/** Whether `d` holds changes worth keeping: different from the saved guide, or a new guide with something written. */
export function hasUnsavedChanges(draft: Draft, saved: Guideline | undefined): boolean {
  if (!saved) {
    return draft.title.trim() !== '' || (draft.body.trim() !== '' && draft.body !== TEMPLATE)
  }
  return (
    draft.repo !== saved.repo ||
    draft.path !== saved.path ||
    draft.title !== saved.title ||
    draft.body !== saved.body ||
    draft.enabled !== saved.enabled
  )
}

/** The drafts after `d` changed: kept while it differs from what is saved, dropped once it matches again. */
export function withDraft(drafts: GuideDrafts, draft: Draft, saved: Guideline | undefined): GuideDrafts {
  const key = draftKeyOf(draft)
  const rest = Object.fromEntries(Object.entries(drafts).filter(([entry]) => entry !== key))
  if (hasUnsavedChanges(draft, saved)) {
    return { ...rest, [key]: draft }
  }
  return rest
}

export function withoutDraft(drafts: GuideDrafts, key: string): GuideDrafts {
  return Object.fromEntries(Object.entries(drafts).filter(([entry]) => entry !== key))
}
