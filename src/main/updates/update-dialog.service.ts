import type { UpdateStatus } from '@shared/update.types.ts'
import { dialog, shell } from 'electron'
import type { UpdateInstaller } from './update.installer.ts'

/** Release notes are cut to this many lines in the dialog; the release page has the rest. */
const MAX_NOTE_LINES = 12

/** How the dialog offers the update: what it says, what the button does, and what it is called. */
interface UpdateOffer {
  text: string
  button: string
  accept: () => void
}

/** Installing it here when this copy can, else downloading the dmg. Progress and restarting are in the window. */
function buildOffer(status: UpdateStatus, installer: UpdateInstaller): UpdateOffer {
  if (status.install.phase === 'unsupported') {
    return {
      text: 'Download it, open the dmg and drag Revio to Applications to replace this one.',
      button: 'Download',
      accept: () => openDownload(status),
    }
  }
  return {
    text: 'Revio downloads it, then asks you to restart.',
    button: 'Update',
    accept: () => installer.download(),
  }
}

function openDownload(status: UpdateStatus) {
  const url = status.downloadUrl ?? status.releaseUrl
  if (url) {
    shell.openExternal(url)
  }
}

/** The release notes' first lines, set apart from what comes before. */
function readNotes(status: UpdateStatus) {
  const notes = status.notes.trim().split('\n').slice(0, MAX_NOTE_LINES).join('\n')
  if (!notes) {
    return ''
  }
  return `\n\n${notes}`
}

async function offerUpdate(status: UpdateStatus, installer: UpdateInstaller) {
  const offer = buildOffer(status, installer)
  const { response } = await dialog.showMessageBox({
    type: 'info',
    message: `Revio ${status.latest} is available`,
    detail: `You have ${status.current}.${readNotes(status)}\n\n${offer.text}`,
    buttons: [offer.button, 'Later'],
    defaultId: 0,
    cancelId: 1,
  })
  if (response === 0) {
    offer.accept()
  }
}

/** The answer to "Check for Updates…" from the menu, as a native dialog. */
export async function showUpdateResult(status: UpdateStatus, installer: UpdateInstaller) {
  const { phase } = status.install
  if (phase === 'ready') {
    await dialog.showMessageBox({
      type: 'info',
      message: 'The update is ready',
      detail: 'Use Restart to update in Revio, or quit: it is installed either way.',
    })
  } else if (phase === 'downloading') {
    await dialog.showMessageBox({ type: 'info', message: 'The update is downloading' })
  } else if (status.error) {
    await dialog.showMessageBox({ type: 'warning', message: 'Could not check for updates', detail: status.error })
  } else if (status.available) {
    await offerUpdate(status, installer)
  } else {
    await dialog.showMessageBox({
      type: 'info',
      message: 'Revio is up to date',
      detail: `You have version ${status.current}, the latest release.`,
    })
  }
}
