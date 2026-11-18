import { fileURLToPath } from 'node:url'

/** Where the renderer is served from: the dev server in development, the built index.html otherwise. */
export interface AppPage {
  devUrl?: string
  indexFile: string
}

/**
 * Whether `url` is the app's own page. Only that page may navigate the window or call the IPC API:
 * any other page (a link that slipped through, say) would otherwise get `window.revio` and the user's token.
 */
export function isAppPage(url: string | undefined, page: AppPage): boolean {
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (page.devUrl) return parsed.origin === new URL(page.devUrl).origin
  return parsed.protocol === 'file:' && fileURLToPath(parsed) === page.indexFile
}
