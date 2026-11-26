import { DEFAULT_LOOKBACK_DAYS } from '@shared/lookback.util.ts'
import type { Segment } from '../common/segmented-control.component.tsx'

/** How far back Learn reads your reviews, as days. Longer spans take longer to load. */
export const LEARN_PERIODS: readonly Segment<'30' | '90' | '182' | '365'>[] = [
  { value: '30', label: '30 days' },
  { value: '90', label: '3 months' },
  { value: '182', label: '6 months' },
  { value: '365', label: 'Year', title: 'Reads a year of reviews: slower, and up to GitHub’s 1,000 PRs' },
]

export const LEARN_PERIOD_VALUES = LEARN_PERIODS.map((period) => period.value)

export const DEFAULT_LEARN_PERIOD = String(DEFAULT_LOOKBACK_DAYS) as (typeof LEARN_PERIOD_VALUES)[number]
