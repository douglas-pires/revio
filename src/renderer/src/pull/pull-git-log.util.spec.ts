import type { Branch } from '@shared/git-log.types.ts'
import { describe, expect, it } from 'vitest'
import { clampPanelHeight, MIN_PANEL_HEIGHT_PX, pickPullBranch } from './pull-git-log.util.ts'

const branch = (name: string, kind: Branch['kind']): Branch => ({ name, kind, current: false, ahead: 0, behind: 0 })

describe('pickPullBranch', () => {
  it('prefers the PR branch as fetched from origin', () => {
    const branches = [branch('feat/x', 'local'), branch('origin/feat/x', 'remote')]
    expect(pickPullBranch(branches, 'feat/x')).toBe('origin/feat/x')
  })

  it('falls back to a local branch of the same name', () => {
    expect(pickPullBranch([branch('feat/x', 'local'), branch('origin/main', 'remote')], 'feat/x')).toBe('feat/x')
  })

  it('shows every branch when the clone has not got the PR branch', () => {
    expect(pickPullBranch([branch('main', 'local'), branch('origin/main', 'remote')], 'feat/x')).toBe('')
  })
})

describe('clampPanelHeight', () => {
  it('keeps the height between the minimum and three quarters of the window', () => {
    expect(clampPanelHeight(400, 1000)).toBe(400)
    expect(clampPanelHeight(20, 1000)).toBe(MIN_PANEL_HEIGHT_PX)
    expect(clampPanelHeight(900, 1000)).toBe(750)
  })

  it('never goes under the minimum, even in a short window', () => {
    expect(clampPanelHeight(400, 100)).toBe(MIN_PANEL_HEIGHT_PX)
  })
})
