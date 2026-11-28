import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@shared/time.util.ts'

/** Below this many days, durations show in hours. */
const HOURS_UP_TO_DAYS = 2

/** A duration for the stats: "45m", "6h", "3.5d"; an en dash for none. */
export function formatSpan(ms: number | null) {
  if (ms === null) {
    return '–'
  }
  if (ms < MS_PER_HOUR) {
    return `${Math.max(1, Math.round(ms / MS_PER_MINUTE))}m`
  }
  if (ms < HOURS_UP_TO_DAYS * MS_PER_DAY) {
    return `${Math.round(ms / MS_PER_HOUR)}h`
  }
  return `${Math.round((ms / MS_PER_DAY) * 10) / 10}d`
}

/** A week's Monday as "Nov 2". */
export function formatWeek(week: string) {
  return new Date(`${week}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
