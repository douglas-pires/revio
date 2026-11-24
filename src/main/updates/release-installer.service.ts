// biome-ignore lint/correctness/noUnresolvedImports: a CommonJS module, whose exports Node gives ES modules as the default.
import electronUpdater from 'electron-updater'
import type { ReleaseInstaller } from './update.installer.ts'

/**
 * electron-updater on Revio's GitHub releases. It checks the download against the release's checksum, then macOS
 * checks that it is signed as the running Revio is before replacing it. Pre-releases are never installed.
 */
export function createReleaseInstaller(): ReleaseInstaller {
  const { autoUpdater } = electronUpdater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  // On by default in a pre-release build, which would move it to the next pre-release instead of the release.
  autoUpdater.allowPrerelease = false
  return {
    download: async (onPercent) => {
      const reportProgress = ({ percent }: { percent: number }) => onPercent(Math.round(percent))
      autoUpdater.on('download-progress', reportProgress)
      try {
        const found = await autoUpdater.checkForUpdates()
        if (!found?.isUpdateAvailable) {
          return null
        }
        await autoUpdater.downloadUpdate()
        return found.updateInfo.version
      } finally {
        autoUpdater.off('download-progress', reportProgress)
      }
    },
    restart: () => autoUpdater.quitAndInstall(),
    onRefused: (listener) => autoUpdater.on('error', (failure) => listener(failure.message)),
  }
}
