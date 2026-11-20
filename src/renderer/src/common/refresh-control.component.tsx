import { describeFreshness } from './format.util.ts'

/** How old the data is and the button that fetches it again, on the right of a screen header. */
export function RefreshControl(props: { fetchedAt: string | undefined; busy: boolean; onRefresh: () => void }) {
  return (
    <>
      <span className="whitespace-nowrap text-muted">{describeFreshness(props.fetchedAt)}</span>
      <button type="button" className="btn" onClick={props.onRefresh} disabled={props.busy}>
        {Boolean(props.busy) && 'Refreshing…'}
        {!props.busy && 'Refresh'}
      </button>
    </>
  )
}
