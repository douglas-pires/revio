/** Names written out before the rest fold into "+N". */
const MAX_NAMES = 2

/** A verdict with who gave it: "approved by ana, bo +1"; just the verdict when GitHub names nobody. */
export function describeVerdict(verdict: string, logins: readonly string[]): string {
  if (logins.length === 0) {
    return verdict
  }
  const names = logins.slice(0, MAX_NAMES).join(', ')
  const hiddenCount = logins.length - MAX_NAMES
  if (hiddenCount > 0) {
    return `${verdict} by ${names} +${hiddenCount}`
  }
  return `${verdict} by ${names}`
}
