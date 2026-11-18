// Keys and the Telegram session live only on this device, encrypted with
// AES-GCM. The CryptoKey is created non-extractable, so its raw bytes can never
// be read back by page scripts: copying the IndexedDB data elsewhere is useless.

export interface Secrets {
  apiId: number
  apiHash: string
  session: string
}

const DB = 'opagram'
const STORE = 'kv'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key)
    r.onsuccess = () => resolve(r.result as T | undefined)
    r.onerror = () => reject(r.error)
  })
}

async function set(key: string, value: unknown): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function cryptoKey(): Promise<CryptoKey> {
  let key = await get<CryptoKey>('key')
  if (!key) {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    await set('key', key)
  }
  return key
}

export async function saveSecrets(s: Secrets): Promise<void> {
  const key = await cryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(s)))
  await set('secrets', { iv, data })
}

export async function loadSecrets(): Promise<Secrets | null> {
  try {
    const box = await get<{ iv: Uint8Array<ArrayBuffer>; data: ArrayBuffer }>('secrets')
    if (!box) return null
    const key = await cryptoKey()
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: box.iv }, key, box.data)
    return JSON.parse(new TextDecoder().decode(plain)) as Secrets
  } catch {
    return null
  }
}

export async function wipeSecrets(): Promise<void> {
  const db = await open()
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}
