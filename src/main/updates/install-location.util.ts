const APP_BUNDLE = /^(?<bundle>.*?\.app)\//u
/** macOS runs an app from a hidden read-only copy until it is moved out of where it was downloaded. */
const TRANSLOCATED = '/AppTranslocation/'
const MOUNTED_VOLUME = '/Volumes/'

/** The folder the app bundle of `executablePath` is in, when an update can replace it there; null when it cannot. */
export function findReplaceableFolder(executablePath: string): string | null {
  const bundle = APP_BUNDLE.exec(executablePath)?.groups?.bundle
  if (!bundle || bundle.startsWith(MOUNTED_VOLUME) || bundle.includes(TRANSLOCATED)) {
    return null
  }
  return bundle.slice(0, bundle.lastIndexOf('/')) || '/'
}
