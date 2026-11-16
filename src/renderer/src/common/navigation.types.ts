import type { PullRef } from '@shared/pull.types'
import type { ScrollTarget } from '../pull/use-scroll-to-target.hook'

/** Opens a PR, optionally at a file and line. */
export type OpenPull = (pull: PullRef, target?: ScrollTarget) => void
