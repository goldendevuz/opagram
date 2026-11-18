const KEY = 'opagram.notify'

export const notifySupported = () => typeof Notification !== 'undefined'

export function notifyEnabled(): boolean {
  try {
    return notifySupported() && Notification.permission === 'granted' && localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Returns true when notifications ended up enabled. */
export async function setNotify(on: boolean): Promise<boolean> {
  if (!notifySupported()) return false
  try {
    if (on && Notification.permission !== 'granted') await Notification.requestPermission()
    const enabled = on && Notification.permission === 'granted'
    localStorage.setItem(KEY, enabled ? '1' : '0')
    return enabled
  } catch {
    return false
  }
}

export function notify(title: string, body: string, onClick: () => void) {
  if (!notifyEnabled()) return
  try {
    const n = new Notification(title, { body, icon: '/icon.svg', tag: title })
    n.onclick = () => {
      window.focus()
      onClick()
      n.close()
    }
  } catch {
    /* some webviews do not allow it */
  }
}
