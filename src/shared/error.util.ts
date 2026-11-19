/** A thrown value as text: an Error's message, anything else converted to a string. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  return String(err)
}
