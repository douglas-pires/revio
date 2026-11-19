/** The process environment, read in this one place so the rest of the main process never reaches for globals. */
export const env: Readonly<Record<string, string | undefined>> = process.env
