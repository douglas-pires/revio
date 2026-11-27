/**
 * What went wrong, from a failed `claude -p --output-format json` run: the CLI prints its whole JSON result, whose
 * `result` holds the message ("Credit balance is too low"). Anything else is kept as it is.
 */
export function readCliFailure(output: string): string {
  try {
    const parsed: unknown = JSON.parse(output)
    if (typeof parsed === 'object' && parsed !== null && 'result' in parsed && typeof parsed.result === 'string') {
      return parsed.result || output
    }
  } catch {
    // Not JSON: the message as printed.
  }
  return output
}
