import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { StatsData, StatsPeriod, StatsScope } from '@shared/stats.types.ts'
import { InFlight } from '../common/in-flight.util.ts'

/** Half an hour: these stats move slowly, and a large team's take a while to fetch. */
const MAX_AGE_MS = 1_800_000

type FetchStats = (scope: StatsScope, days: StatsPeriod) => Promise<StatsData>

/**
 * Stats per scope and period. The latest of each is kept in memory and on disk, so it shows at once (also after a
 * restart) while a fresh copy loads; a copy younger than half an hour is used as is. Requests during a fetch share it.
 */
export class StatsCache {
  private readonly latest = new Map<string, StatsData>()
  private readonly inFlight = new InFlight<StatsData>()

  constructor(
    private readonly fetch: FetchStats,
    private readonly folder: string,
  ) {}

  /** The stats, from a copy younger than half an hour unless `fresh`, else from GitHub. */
  async get(scope: StatsScope, days: StatsPeriod, fresh: boolean): Promise<StatsData> {
    const key = buildKey(scope, days)
    const saved = await this.readByKey(key)
    if (!fresh && saved && Date.now() - Date.parse(saved.fetchedAt) <= MAX_AGE_MS) {
      return saved
    }
    return this.inFlight.run(key, async () => {
      const data = await this.fetch(scope, days)
      this.latest.set(key, data)
      await this.save(key, data)
      return data
    })
  }

  /** The last stats fetched for a scope and period, however old; null when there are none. */
  readSaved(scope: StatsScope, days: StatsPeriod) {
    return this.readByKey(buildKey(scope, days))
  }

  private async readByKey(key: string): Promise<StatsData | null> {
    const inMemory = this.latest.get(key)
    if (inMemory) {
      return inMemory
    }
    try {
      const data = JSON.parse(await readFile(this.fileOf(key), 'utf8')) as StatsData
      this.latest.set(key, data)
      return data
    } catch {
      return null
    }
  }

  private async save(key: string, data: StatsData) {
    try {
      await mkdir(this.folder, { recursive: true })
      await writeFile(this.fileOf(key), JSON.stringify(data))
    } catch (failure) {
      console.error('[revio] could not keep the stats:', failure)
    }
  }

  private fileOf(key: string) {
    return join(this.folder, `${createHash('sha1').update(key).digest('hex')}.json`)
  }
}

/** One key per scope and period; the same teams picked in another order are the same scope. */
function buildKey(scope: StatsScope, days: StatsPeriod) {
  if (scope.kind === 'team') {
    const teams = scope.teams.map((team) => `${team.org}/${team.slug}`).sort()
    return JSON.stringify([{ kind: 'team', teams }, days])
  }
  return JSON.stringify([scope, days])
}
