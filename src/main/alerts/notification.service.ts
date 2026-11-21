import { Notification } from 'electron'

/**
 * Notifications still on screen. Electron removes a notification from Notification Center once its object is
 * garbage-collected, often before you see it, so each is held until it is clicked or closed.
 */
const notificationsOnScreen = new Set<Notification>()
/**
 * Unread notifications pile up in Notification Center without ever closing; past this many, the oldest are let go
 * (and leave Notification Center) so the set cannot grow without end.
 */
const MAX_HELD_NOTIFICATIONS = 100

/** Lets go of the oldest held notifications once there are more than `MAX_HELD_NOTIFICATIONS`. */
function releaseOldestNotifications() {
  for (const oldest of notificationsOnScreen) {
    if (notificationsOnScreen.size <= MAX_HELD_NOTIFICATIONS) {
      return
    }
    notificationsOnScreen.delete(oldest)
  }
}

/** Keeps the notification alive until it is clicked or closed, then lets it go. */
function holdUntilDismissed(notification: Notification, onClick: () => void) {
  notificationsOnScreen.add(notification)
  releaseOldestNotifications()
  const forgetNotification = () => notificationsOnScreen.delete(notification)
  notification.on('click', () => {
    forgetNotification()
    onClick()
  })
  notification.on('close', forgetNotification)
}

/** Logs a notification macOS refused (notifications turned off for Revio, say) and tells the caller. */
function reportRefusal(notification: Notification, onRefused: (() => void) | undefined) {
  notification.on('failed', (_event, error) => {
    notificationsOnScreen.delete(notification)
    console.error('[revio] notification failed:', error)
    onRefused?.()
  })
}

/** What to do when a notification is clicked, and, optionally, once macOS shows or refuses it. */
export interface NotificationHandlers {
  onClick: () => void
  onShown?: () => void
  onRefused?: () => void
}

/** Shows a macOS notification. Where notifications are unsupported it shows nothing and counts as refused. */
export function showNotification(title: string, body: string, handlers: NotificationHandlers) {
  if (!Notification.isSupported()) {
    console.error('[revio] notifications are not supported here')
    handlers.onRefused?.()
    return
  }
  const notification = new Notification({ title, body, silent: false })
  holdUntilDismissed(notification, handlers.onClick)
  reportRefusal(notification, handlers.onRefused)
  if (handlers.onShown) {
    notification.on('show', handlers.onShown)
  }
  notification.show()
}

/** Shows a sample notification and resolves whether macOS showed it, for the Settings button that checks this. */
export function sendTestNotification(onClick: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    showNotification('Revio notifications work', 'Review requests and mentions will show up like this.', {
      onClick,
      onShown: () => resolve(true),
      onRefused: () => resolve(false),
    })
  })
}
