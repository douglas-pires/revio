import { Notification } from 'electron'

/** Shows a macOS notification; clicking it runs `onClick`. Does nothing where notifications are unsupported. */
export function showNotification(title: string, body: string, onClick: () => void) {
  if (!Notification.isSupported()) {
    return
  }
  const n = new Notification({ title, body, silent: false })
  n.on('click', onClick)
  n.show()
}
