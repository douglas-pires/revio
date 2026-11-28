import type { StatsData, StatsScope } from '@shared/stats.types.ts'
import { MS_PER_DAY } from '@shared/time.util.ts'
import { useMemo } from 'react'
import { describeFreshness } from '../common/format.util.ts'
import { MascotLoading } from '../common/mascot-loading.component.tsx'
import { Screen, ScreenBody, ScreenHeader } from '../common/screen.component.tsx'
import { SegmentedControl } from '../common/segmented-control.component.tsx'
import { CycleBar } from './cycle-bar.component.tsx'
import { formatSpan } from './stats-format.util.ts'
import { StatsScopePicker } from './stats-scope-picker.component.tsx'
import { type ComputedStats, computeStats } from './stats-summary.util.ts'
import { ReviewBlocksCard, ReviewersTable, SizeTable } from './stats-tables.component.tsx'
import { type StatsState, useStats } from './use-stats.hook.ts'
import { WeekBars } from './week-bars.component.tsx'

const PERIODS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
] as const

/** Who the stats are about, for the subtitle. */
function describeScope(scope: StatsScope, data: StatsData | null) {
  if (scope.kind === 'me') {
    return 'Your reviews and PRs'
  }
  if (scope.kind === 'team') {
    const members = data?.people?.length
    const names = scope.teams.map((team) => team.name).join(', ')
    return `${names}${members ? ` · ${members} people` : ''}`
  }
  return `Everyone in ${scope.repo}`
}

/** One headline number. */
function Tile(props: { label: string; value: string; detail: string }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="text-[12px] text-muted">{props.label}</span>
      <span className="font-mono text-[22px] leading-7 font-semibold">{props.value}</span>
      <span className="text-[12px] text-muted">{props.detail}</span>
    </div>
  )
}

function Tiles({ stats }: { stats: ComputedStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Time to first review"
        value={formatSpan(stats.waits.medianMs)}
        detail={`median of ${stats.waits.answered} · slowest tenth ${formatSpan(stats.waits.slowMs)}`}
      />
      <Tile label="Still waiting" value={`${stats.waits.stillWaiting}`} detail="reviews asked, not yet given" />
      <Tile
        label="Cycle time"
        value={formatSpan(stats.cycle.totalMs)}
        detail={`median of ${stats.merged} merged PRs`}
      />
      <Tile label="Reviews sent" value={`${stats.reviewsSent}`} detail="on others' PRs" />
    </div>
  )
}

/** The charts and tables for loaded stats. */
function StatsBody({ data }: { data: StatsData }) {
  const now = Date.parse(data.fetchedAt)
  const stats = useMemo(() => computeStats(data, now), [data, now])
  const weekly = (pick: (week: ComputedStats['weeks'][number]) => number | null) =>
    stats.weeks.map((week) => ({ week: week.week, value: pick(week) }))
  const count = (value: number | null) => `${value ?? 0}`
  return (
    <div className="flex flex-col gap-3">
      {data.truncated && (
        <p className="card px-4 py-2.5 text-[12.5px] text-warn">
          GitHub stops a search at 1,000 PRs, so some are left out. A shorter period gives complete numbers.
        </p>
      )}
      <Tiles stats={stats} />
      <CycleBar cycle={stats.cycle} merged={stats.merged} />
      <div className="grid gap-3 lg:grid-cols-2">
        <WeekBars
          title="Time to first review, median"
          weeks={weekly((week) => week.medianWaitMs)}
          format={formatSpan}
        />
        <WeekBars title="Cycle time, median" weeks={weekly((week) => week.medianCycleMs)} format={formatSpan} />
        <WeekBars title="Reviews asked" weeks={weekly((week) => week.requestsIn)} format={count} />
        <WeekBars title="Reviews sent" weeks={weekly((week) => week.reviewsOut)} format={count} />
        <WeekBars title="PRs merged" weeks={weekly((week) => week.merged)} format={count} />
        <SizeTable sizes={stats.sizes} />
      </div>
      {data.scope.kind !== 'me' && <ReviewersTable reviewers={stats.reviewers} />}
      {data.scope.kind === 'me' && <ReviewBlocksCard since={now - data.days * MS_PER_DAY} />}
    </div>
  )
}

function StatsContent({ state }: { state: StatsState }) {
  if (state.error) {
    return <p className="card px-4 py-3 text-danger">{state.error}</p>
  }
  const shown = state.data && JSON.stringify([state.data.scope, `${state.data.days}`])
  if (!state.data || shown !== JSON.stringify([state.scope, state.period])) {
    return <MascotLoading label="Reading PRs from GitHub… a large team can take a couple of minutes" />
  }
  return <StatsBody data={state.data} />
}

/** Review and delivery stats, Swarmia-style, for you, a team or a repository. */
export function Stats() {
  const state = useStats()
  return (
    <Screen
      header={
        <ScreenHeader
          title="Stats"
          subtitle={describeScope(state.scope, state.data)}
          actions={
            <>
              <span className="text-[12px] text-muted">{state.data && describeFreshness(state.data.fetchedAt)}</span>
              <button type="button" className="btn" disabled={state.loading} onClick={state.refresh}>
                {state.loading ? 'Loading…' : 'Refresh'}
              </button>
            </>
          }
        >
          <StatsScopePicker scope={state.scope} onChange={state.setScope} />
          <SegmentedControl segments={PERIODS} value={state.period} onChange={state.setPeriod} />
        </ScreenHeader>
      }
    >
      <ScreenBody>
        <StatsContent state={state} />
      </ScreenBody>
    </Screen>
  )
}
