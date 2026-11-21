/** A thrown value as text: an Error's message, anything else converted to a string. */
export function readErrorMessage(failure: unknown): string {
  if (failure instanceof Error) {
    return failure.message
  }
  return String(failure)
}
