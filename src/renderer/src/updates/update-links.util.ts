import type { UpdateStatus } from '@shared/update.types.ts'

/** Where Download goes: the installer for this Mac when the release has one, else the release page. */
export function downloadLinkOf(status: UpdateStatus): string | null {
  return status.downloadUrl ?? status.releaseUrl
}

/** Opens a link from the update status in the browser; does nothing without one. */
export function openLink(url: string | null) {
  if (url) {
    globalThis.revio.openExternal(url)
  }
}
