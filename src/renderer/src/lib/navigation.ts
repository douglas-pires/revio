import type { PullRef } from '@shared/types'
import type { ScrollTarget } from '../hooks/useScrollToTarget'

/** Opens a PR, optionally at a file and line. */
export type OpenPull = (pull: PullRef, target?: ScrollTarget) => void
