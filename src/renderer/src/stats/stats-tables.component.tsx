import { readFinishedBlocks } from '../focus/review-block-history.util.ts'
import { formatSpan } from './stats-format.util.ts'
import type { ComputedStats } from './stats-summary.util.ts'

/** Who sent the reviews, busiest first. */
export function ReviewersTable({ reviewers }: { reviewers: ComputedStats['reviewers'] }) {
  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-line px-4 py-2.5 font-medium">Who reviews</h2>
      <table className="w-full text-[12.5px]">
        <thead className="text-muted">
          <tr className="text-left">
            <th className="px-4 py-1.5 font-normal">Reviewer</th>
            <th className="px-2 py-1.5 text-right font-normal">Reviews</th>
            <th className="px-2 py-1.5 text-right font-normal">Approved</th>
            <th className="px-2 py-1.5 text-right font-normal">Changes asked</th>
            <th className="px-2 py-1.5 text-right font-normal">Comments</th>
            <th className="px-4 py-1.5 text-right font-normal">Median time to review</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {reviewers.map((row) => (
            <tr key={row.reviewer}>
              <td className="px-4 py-1.5">{row.reviewer}</td>
              <td className="px-2 py-1.5 text-right font-mono">{row.reviews}</td>
              <td className="px-2 py-1.5 text-right font-mono">{row.approvals}</td>
              <td className="px-2 py-1.5 text-right font-mono">{row.changesRequested}</td>
              <td className="px-2 py-1.5 text-right font-mono">{row.comments}</td>
              <td className="px-4 py-1.5 text-right font-mono">{formatSpan(row.medianWaitMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {reviewers.length === 0 && <p className="px-4 py-3 text-muted">No reviews in this period.</p>}
    </section>
  )
}

/** How PR size relates to waiting and cycle time. */
export function SizeTable({ sizes }: { sizes: ComputedStats['sizes'] }) {
  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-line px-4 py-2.5 font-medium">PR size</h2>
      <table className="w-full text-[12.5px]">
        <thead className="text-muted">
          <tr className="text-left">
            <th className="px-4 py-1.5 font-normal">Lines changed</th>
            <th className="px-2 py-1.5 text-right font-normal">PRs</th>
            <th className="px-2 py-1.5 text-right font-normal">Wait for first review</th>
            <th className="px-4 py-1.5 text-right font-normal">Cycle time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sizes.map((size) => (
            <tr key={size.label}>
              <td className="px-4 py-1.5">{SIZE_RANGES[size.label]}</td>
              <td className="px-2 py-1.5 text-right font-mono">{size.pulls}</td>
              <td className="px-2 py-1.5 text-right font-mono">{formatSpan(size.medianWaitMs)}</td>
              <td className="px-4 py-1.5 text-right font-mono">{formatSpan(size.medianCycleMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

const SIZE_RANGES: Record<ComputedStats['sizes'][number]['label'], string> = {
  XS: 'XS · under 10',
  S: 'S · 10–99',
  M: 'M · 100–399',
  L: 'L · 400–999',
  XL: 'XL · 1,000 or more',
}

/** Your review blocks in the period, from focus mode on this Mac. */
export function ReviewBlocksCard({ since }: { since: number }) {
  const blocks = readFinishedBlocks().filter((block) => Date.parse(block.endedAt) >= since)
  const minutes = blocks.reduce((sum, block) => sum + block.minutes, 0)
  const reviews = blocks.reduce((sum, block) => sum + block.reviews, 0)
  return (
    <section className="card p-4">
      <h2 className="font-medium">Review blocks</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        {blocks.length === 0 && 'No review blocks finished in this period. Start one with Focus in the rail.'}
        {blocks.length > 0 &&
          `${blocks.length} blocks, ${formatSpan(minutes * 60_000)} set aside, ${reviews} reviews sent in them. Counted on this Mac.`}
      </p>
    </section>
  )
}
