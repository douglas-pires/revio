import type { StatsData, StatsPeriod, StatsScope } from '@shared/stats.types.ts'
import { InFlight } from '../common/in-flight.util.ts'

/** Half an hour: these stats move slowly, and a large team's take a while to fetch. */
const MAX_AGE_MS = 1_800_000

type FetchStats = (scope: StatsScope, days: StatsPeriod) => Promise<StatsData>

/** Stats per scope and period, fetched at most every half hour unless asked fresh; requests during a fetch share it. */
export class StatsCache {
  private readonly latest = new Map<string, { at: number; data: StatsData }>()
  private readonly inFlight = new InFlight<StatsData>()

  constructor(private readonly fetch: FetchStats) {}

  get(scope: StatsScope, days: StatsPeriod, fresh: boolean): Promise<StatsData> {
    const key = JSON.stringify([scope, days])
    const cached = this.latest.get(key)
    if (!fresh && cached && Date.now() - cached.at <= MAX_AGE_MS) {
      return Promise.resolve(cached.data)
    }
    return this.inFlight.run(key, async () => {
      const data = await this.fetch(scope, days)
      this.latest.set(key, { at: Date.now(), data })
      return data
    })
  }
}
