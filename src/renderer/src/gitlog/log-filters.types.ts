import type { PullLogQuery } from '@shared/git-log.types.ts'

/** The filters above the log, as typed. Empty strings mean no filter. */
export type LogFilters = Pick<PullLogQuery, 'text' | 'author' | 'sinceDays' | 'path'>

export const NO_FILTERS: LogFilters = { text: '', author: '', sinceDays: 0, path: '' }
