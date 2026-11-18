import { useEffect, useState } from 'react'
import type { Backend } from '../types'

const cache = new Map<string, string | null>()

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  return h >>> 0
}

export function Avatar({ backend, id, title, size = 50 }: { backend: Backend; id: string; title: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(cache.get(id) ?? null)

  useEffect(() => {
    if (cache.has(id)) return setUrl(cache.get(id) ?? null)
    let alive = true
    backend.avatar(id).then((u) => {
      cache.set(id, u ?? null)
      if (alive) setUrl(u ?? null)
    })
    return () => {
      alive = false
    }
  }, [backend, id])

  const h = hash(id + title)
  const a = h % 360
  const b = (a + 50 + (h % 70)) % 360
  const letter = Array.from(title.replace(/^[^\p{L}\p{N}]+/u, ''))[0]?.toUpperCase() ?? '?'
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        animationDelay: `${-(h % 9)}s`,
        background: url
          ? `center / cover url(${url})`
          : `linear-gradient(135deg, hsl(${a} 90% 62%), hsl(${b} 85% 55%))`,
      }}
    >
      {!url && letter}
    </span>
  )
}
