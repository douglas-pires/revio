import { accessSync, constants } from 'node:fs'
import { app } from 'electron'
import { findReplaceableFolder } from './install-location.util.ts'

/** Whether this copy of Revio can replace itself: an installed build, in a folder it may write to. */
export function canReplaceItself(): boolean {
  const folder = findReplaceableFolder(app.getPath('exe'))
  if (!(app.isPackaged && folder)) {
    return false
  }
  try {
    accessSync(folder, constants.W_OK)
    return true
  } catch {
    return false
  }
}
