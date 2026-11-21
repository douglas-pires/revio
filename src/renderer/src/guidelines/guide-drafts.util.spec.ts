import type { Guideline } from '@shared/guideline.types.ts'
import { describe, expect, it } from 'vitest'
import { hasUnsavedChanges, parseGuideDrafts, withDraft, withoutDraft } from '@/guidelines/guide-drafts.util.ts'
import { newDraft, TEMPLATE } from '@/guidelines/guidelines.util.ts'

const saved: Guideline = {
  id: 'g1',
  repo: 'acme/payments',
  path: '',
  title: 'Payments',
  body: 'Watch money rounding.',
  enabled: true,
  updatedAt: '',
}

describe('guide drafts', () => {
  it('counts a change to any field of a saved guide as unsaved', () => {
    expect(hasUnsavedChanges({ ...saved }, saved)).toBe(false)
    expect(hasUnsavedChanges({ ...saved, body: 'Watch money rounding and retries.' }, saved)).toBe(true)
    expect(hasUnsavedChanges({ ...saved, enabled: false }, saved)).toBe(true)
  })

  it('counts a new guide as unsaved once something is written', () => {
    expect(hasUnsavedChanges(newDraft('acme/payments'), undefined)).toBe(false)
    expect(hasUnsavedChanges({ ...newDraft('acme/payments'), body: `${TEMPLATE}- retries` }, undefined)).toBe(true)
    expect(hasUnsavedChanges({ ...newDraft('acme/payments'), title: 'Retries' }, undefined)).toBe(true)
  })

  it('keeps a draft while it differs and drops it once it matches the saved guide again', () => {
    const edited = withDraft({}, { ...saved, title: 'Payments service' }, saved)
    expect(edited.g1?.title).toBe('Payments service')
    expect(withDraft(edited, { ...saved }, saved)).toEqual({})
    expect(withoutDraft(edited, 'g1')).toEqual({})
  })

  it('keys a guide not saved yet as new', () => {
    const draft = { ...newDraft('acme/payments'), title: 'Retries' }
    expect(Object.keys(withDraft({}, draft, undefined))).toEqual(['new'])
  })

  it('reads stored drafts, skipping anything malformed', () => {
    expect(parseGuideDrafts(null)).toEqual({})
    expect(parseGuideDrafts('not json')).toEqual({})
    const raw = JSON.stringify({ g1: { ...saved, title: 'x' }, bad: { title: 1 } })
    expect(Object.keys(parseGuideDrafts(raw))).toEqual(['g1'])
  })
})
