const KEY = 'opagram.notify'

export const notifySupported = () => typeof Notification !== 'undefined'

/** On by default: it only stays off if the user switched it off or the browser refused. */
export function notifyEnabled(): boolean {
  try {
    return notifySupported() && Notification.permission === 'granted' && localStorage.getItem(KEY) !== '0'
  } catch {
    return false
  }
}

/** Asks for permission once, from a click, unless the user already turned notifications off. */
export function askNotifyOnce() {
  try {
    if (notifySupported() && Notification.permission === 'default' && localStorage.getItem(KEY) !== '0') void Notification.requestPermission()
  } catch {
    /* ignore */
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
