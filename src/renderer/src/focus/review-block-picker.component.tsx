import { useState } from 'react'
import { PickerDialog } from '../common/picker-dialog.component.tsx'
import { BLOCK_MINUTES, type BlockMinutes } from './review-block.util.ts'

/** What a length is for, to help pick one. */
const HINTS: Record<BlockMinutes, string> = {
  25: 'one small PR',
  45: 'a couple of PRs',
  60: 'the longest a careful review holds up',
  90: 'a big PR, with a break halfway',
}

/** The lengths, the one you used last (45 the first time) first, so Enter picks it. */
function orderLengths(last: BlockMinutes) {
  return [last, ...BLOCK_MINUTES.filter((minutes) => minutes !== last)]
}

/** Picks how long to set aside for reviewing. */
export function ReviewBlockPicker(props: {
  last: BlockMinutes
  onPick: (minutes: BlockMinutes) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const results = orderLengths(props.last).filter((minutes) => `${minutes} minutes ${HINTS[minutes]}`.includes(query))
  return (
    <PickerDialog
      label="Start a review block"
      placeholder="How long do you want to review for?"
      emptyText="Pick one of 25, 45, 60 or 90 minutes"
      query={query}
      onQuery={setQuery}
      results={results}
      readKey={String}
      readTitle={(minutes) => `${minutes} minutes`}
      renderRow={(minutes) => (
        <>
          <span className="font-medium text-fg">{minutes} min</span>
          <span className="text-muted">{HINTS[minutes]}</span>
          {minutes === props.last && <span className="ml-auto text-[11px] text-muted">↵ to start</span>}
        </>
      )}
      onPick={props.onPick}
      onClose={props.onClose}
    />
  )
}
