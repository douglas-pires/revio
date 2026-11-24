import type { PullDetail } from '@shared/pull.types.ts'
import { copyText } from '../common/copy-text.service.ts'
import { useShortcut } from '../shortcuts/use-shortcut.hook.ts'

/** A shortcut (⌘⇧B unless changed) copies the PR's branch name. */
export function useCopyShortcuts(pr: PullDetail | null) {
  useShortcut('copy-branch', () => {
    if (pr) {
      copyText(pr.headRef)
    }
  })
}
