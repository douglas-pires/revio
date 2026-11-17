import { dialog, shell } from 'electron'
import type { UpdateStatus } from '@shared/update.types'

/** The answer to "Check for Updates…" from the menu, as a native dialog. */
export async function showUpdateResult(status: UpdateStatus) {
  if (status.error) {
    await dialog.showMessageBox({ type: 'warning', message: 'Could not check for updates', detail: status.error })
    return
  }
  if (!status.available) {
    await dialog.showMessageBox({ type: 'info', message: 'Revio is up to date', detail: `You have version ${status.current}, the latest release.` })
    return
  }
  const notes = status.notes.trim().split('\n').slice(0, 12).join('\n')
  const { response } = await dialog.showMessageBox({
    type: 'info',
    message: `Revio ${status.latest} is available`,
    detail: `You have ${status.current}.${notes ? `\n\n${notes}` : ''}\n\nDownload it, open the dmg and drag Revio to Applications to replace this one.`,
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1,
  })
  const url = status.downloadUrl ?? status.releaseUrl
  if (response === 0 && url) await shell.openExternal(url)
}
