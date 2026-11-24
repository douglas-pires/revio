import { showNotice } from './notice.service.ts'

/** Copies `text` to the clipboard and says so, or that it could not. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    showNotice(`Copied ${text}`)
  } catch {
    showNotice('Could not copy')
  }
}
