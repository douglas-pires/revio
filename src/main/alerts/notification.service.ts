import { Notification } from 'electron'

/**
 * Notifications still on screen. macOS drops the click handler of a notification that was garbage-collected,
 * so each is held until it is clicked or closed.
 */
const live = new Set<Notification>()

/**
 * Shows a macOS notification; clicking it runs `onClick`. Does nothing where notifications are unsupported.
 * Resolves false when the system refused to show it (notifications turned off for Revio, say).
 */
export function showNotification(title: string, body: string, onClick: () => void): Promise<boolean> {
  if (!Notification.isSupported()) {
    console.error('[revio] notifications are not supported here')
    return Promise.resolve(false)
  }
  const n = new Notification({ title, body, silent: false })
  live.add(n)
  const release = () => live.delete(n)
  n.on('click', () => {
    release()
    onClick()
  })
  n.on('close', release)
  return new Promise((resolve) => {
    n.on('show', () => resolve(true))
    n.on('failed', (_e, error) => {
      release()
      console.error('[revio] notification failed:', error)
      resolve(false)
    })
    n.show()
  })
}
