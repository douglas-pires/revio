import type { UpdateStatus } from '@shared/update.types.ts'
import { dialog, shell } from 'electron'

/** Release notes are cut to this many lines in the dialog; the release page has the rest. */
const MAX_NOTE_LINES = 12

/** The answer to "Check for Updates…" from the menu, as a native dialog. */
export async function showUpdateResult(status: UpdateStatus) {
  if (status.error) {
    await dialog.showMessageBox({ type: 'warning', message: 'Could not check for updates', detail: status.error })
    return
  }
  if (!status.available) {
    await dialog.showMessageBox({
      type: 'info',
      message: 'Revio is up to date',
      detail: `You have version ${status.current}, the latest release.`,
    })
    return
  }
  const notes = status.notes.trim().split('\n').slice(0, MAX_NOTE_LINES).join('\n')
  let notesText = ''
  if (notes) {
    notesText = `\n\n${notes}`
  }
  const { response } = await dialog.showMessageBox({
    type: 'info',
    message: `Revio ${status.latest} is available`,
    detail: `You have ${status.current}.${notesText}\n\nDownload it, open the dmg and drag Revio to Applications to replace this one.`,
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1,
  })
  const url = status.downloadUrl ?? status.releaseUrl
  if (response === 0 && url) {
    await shell.openExternal(url)
  }
}
