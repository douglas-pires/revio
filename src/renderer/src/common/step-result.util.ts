/** The result after (or before) `active`, wrapping around. */
export function stepResult(active: number, step: 1 | -1, count: number): number {
  if (count === 0) {
    return 0
  }
  return (active + step + count) % count
}
