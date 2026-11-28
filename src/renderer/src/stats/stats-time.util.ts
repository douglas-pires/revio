import { MS_PER_DAY } from '@shared/time.util.ts'

const DAYS_PER_WEEK = 7

/** The middle value; null for none. */
export function median(values: number[]) {
  return percentile(values, 0.5)
}

/** The value `share` of the way through the sorted values (0.9 for the slowest tenth); null for none. */
export function percentile(values: number[], share: number) {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const position = (sorted.length - 1) * share
  const below = Math.floor(position)
  const above = Math.ceil(position)
  return sorted[below]! + (sorted[above]! - sorted[below]!) * (position - below)
}

/** The Monday (UTC) starting the week of a date, as yyyy-mm-dd. */
export function readWeekStart(time: string | number) {
  const date = new Date(time)
  const daysSinceMonday = (date.getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK
  const monday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - daysSinceMonday * MS_PER_DAY
  return new Date(monday).toISOString().slice(0, 'yyyy-mm-dd'.length)
}

/** Every week from the one holding `since` to the one holding `now`, oldest first. */
export function listWeeks(since: number, now: number) {
  const weeks: string[] = []
  for (let week = readWeekStart(since); week <= readWeekStart(now); ) {
    weeks.push(week)
    week = new Date(Date.parse(week) + DAYS_PER_WEEK * MS_PER_DAY).toISOString().slice(0, 'yyyy-mm-dd'.length)
  }
  return weeks
}

/** Milliseconds from one date to another, never below zero. */
export function measureGap(from: string, to: string) {
  return Math.max(0, Date.parse(to) - Date.parse(from))
}
