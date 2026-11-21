import type { PullLogQuery } from '@shared/git-log.types.ts'

/** The filters above the log, as typed. Empty strings mean no filter. `text` is a message search or a hash. */
export type LogFilters = Pick<PullLogQuery, 'author' | 'sinceDays' | 'path'> & { text: string }

export const NO_FILTERS: LogFilters = { text: '', author: '', sinceDays: 0, path: '' }
