import { errorMessage as sharedErrorMessage } from '@shared/error.util.ts'
import { MS_PER_HOUR } from '@shared/time.util.ts'

const IPC_ERROR_PREFIX = /^Error invoking remote method '[^']+': (?:Error: )?/u

const GENERATED = [
  /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|go\.sum|composer\.lock)$/u,
  /\.snap$/u,
  /(?:^|\/)(?:dist|build|generated|__generated__)\//u,
  /\.min\.(?:js|css)$/u,
]
/** Waits shorter than this read in hours ("30h"); longer ones in days ("3d"). */
const MAX_HOURS_SHOWN = 48

export function ago(iso: string | null | undefined) {
  if (!iso) {
    return ''
  }
  const h = (Date.now() - new Date(iso).getTime()) / MS_PER_HOUR
  return duration(h)
}

/** "just updated", "updated 5m ago", or "loading…" before the first fetch. */
export function describeFreshness(fetchedAt: string | undefined) {
  if (!fetchedAt) {
    return 'loading…'
  }
  const age = ago(fetchedAt)
  if (age === 'now') {
    return 'just updated'
  }
  return `updated ${age} ago`
}

export function duration(h: number) {
  if (h < 1 / 60) {
    return 'now'
  }
  if (h < 1) {
    return `${Math.round(h * 60)}m`
  }
  if (h < MAX_HOURS_SHOWN) {
    return `${Math.round(h)}h`
  }
  return `${Math.round(h / 24)}d`
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** A thrown value as text, without the prefix Electron adds to errors that crossed IPC. */
export const errorMessage = (e: unknown) => sharedErrorMessage(e).replace(IPC_ERROR_PREFIX, '')

export const isGenerated = (path: string) => GENERATED.some((r) => r.test(path))

/** "1 reply", "3 replies": the count with the word that fits it. */
export function countOf(count: number, one: string, many: string) {
  if (count === 1) {
    return `1 ${one}`
  }
  return `${count} ${many}`
}
