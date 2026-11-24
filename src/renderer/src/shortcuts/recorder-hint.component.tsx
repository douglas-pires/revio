/** What a recorder says by its keys: the clash in red, else how to use it. */
export function RecorderHint({ conflict }: { conflict: string | null }) {
  if (conflict) {
    return (
      <p role="alert" className="text-[11.5px] text-danger">
        Already used for {conflict}.
      </p>
    )
  }
  return <p className="text-[11.5px] text-muted">Press the keys. Enter saves, Esc cancels, ⌫ turns it off.</p>
}
