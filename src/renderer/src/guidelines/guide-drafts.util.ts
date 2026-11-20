import type { Guideline } from '@shared/guideline.types.ts'
import { type Draft, TEMPLATE } from './guidelines.util.ts'

const STORAGE_KEY = 'revio.guideDrafts'
/** The key of the one new guide being written before it has an id. */
const NEW_GUIDE = 'new'

const isText = (v: unknown) => typeof v === 'string'

function isDraft(v: unknown): v is Draft {
  if (typeof v !== 'object' || v === null) {
    return false
  }
  const d = v as Record<string, unknown>
  return isText(d.repo) && isText(d.path) && isText(d.title) && isText(d.body) && typeof d.enabled === 'boolean'
}

/** Unsaved edits by guide: its id, or `new` for a guide not saved yet. */
export type GuideDrafts = Readonly<Partial<Record<string, Draft>>>

export function draftKeyOf(d: Draft): string {
  return d.id ?? NEW_GUIDE
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
    return Object.fromEntries(Object.entries(parsed).filter(([, d]) => isDraft(d)))
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
export function hasUnsavedChanges(d: Draft, saved: Guideline | undefined): boolean {
  if (!saved) {
    return d.title.trim() !== '' || (d.body.trim() !== '' && d.body !== TEMPLATE)
  }
  return (
    d.repo !== saved.repo ||
    d.path !== saved.path ||
    d.title !== saved.title ||
    d.body !== saved.body ||
    d.enabled !== saved.enabled
  )
}

/** The drafts after `d` changed: kept while it differs from what is saved, dropped once it matches again. */
export function withDraft(drafts: GuideDrafts, d: Draft, saved: Guideline | undefined): GuideDrafts {
  const key = draftKeyOf(d)
  const rest = Object.fromEntries(Object.entries(drafts).filter(([k]) => k !== key))
  if (hasUnsavedChanges(d, saved)) {
    return { ...rest, [key]: d }
  }
  return rest
}

export function withoutDraft(drafts: GuideDrafts, key: string): GuideDrafts {
  return Object.fromEntries(Object.entries(drafts).filter(([k]) => k !== key))
}
