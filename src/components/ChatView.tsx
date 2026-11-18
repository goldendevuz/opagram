import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Backend, Chat, Msg, Presence } from '../types'
import { useI18n, type Key } from '../i18n'
import { Avatar } from './Avatar'
import { Bubble } from './Bubble'

interface Props {
  backend: Backend
  chat: Chat
  typing: boolean
  onBack: () => void
  /** Called when incoming messages up to maxId were actually seen. */
  onRead: (chatId: string, maxId: number, count: number) => void
}

const EMOJIS = '😀 😂 🥹 😍 😘 😎 🤔 😢 😭 😡 👍 👎 👏 🙏 💪 🔥 ❤️ 💔 🎉 ✨ 🌹 ☕ 🍕 🎂 😴 🤝 👀 😅 🙌 🤗 😉 🥳 😇 🙈 💯 ✅ ❌ ⭐ 🌙 ☀️'.split(' ')

export function presenceText(t: (k: Key, v?: Record<string, string | number>) => string, p: Presence | undefined, locale: string) {
  if (!p) return ''
  if (p.state === 'online') return t('online')
  if (p.state === 'recently') return t('seen.recently')
  if (p.state === 'week') return t('seen.week')
  if (p.state === 'month') return t('seen.month')
  if (p.state === 'offline' && p.ts) {
    const d = new Date(p.ts * 1000)
    const clock = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    const same = d.toDateString() === new Date().toDateString()
    const yest = d.toDateString() === new Date(Date.now() - 864e5).toDateString()
    return t('seen.at', { x: same ? clock : yest ? `${t('yesterday').toLowerCase()} ${clock}` : `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')} ${clock}` })
  }
  return ''
}

export function ChatView({ backend, chat, typing, onBack, onRead }: Props) {
  const { t, locale } = useI18n()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [ready, setReady] = useState(false)
  const [fresh, setFresh] = useState<Set<number>>(new Set())
  const [more, setMore] = useState(true)
  const [text, setText] = useState('')
  const [reply, setReply] = useState<Msg | null>(null)
  const [editing, setEditing] = useState<Msg | null>(null)
  const [menu, setMenu] = useState<{ m: Msg; x: number; y: number; ask?: boolean } | null>(null)
  const [emoji, setEmoji] = useState(false)
  const [away, setAway] = useState(0)
  const [atBottom, setAtBottom] = useState(true)
  const [dividerId, setDividerId] = useState<number | null>(null)
  const [drag, setDrag] = useState(false)
  const [toast, setToast] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const stick = useRef(true)
  const readMax = useRef(chat.readInboxMaxId)
  const seenMax = useRef(0)
  const msgsRef = useRef<Msg[]>([])
  msgsRef.current = msgs
  const readTimer = useRef<number>(0)

  const add = useCallback((m: Msg) => {
    setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    setFresh((f) => new Set(f).add(m.id))
  }, [])

  // ── load history, then jump to the first unread message (or the bottom)
  useEffect(() => {
    let alive = true
    backend.history(chat.id).then((h) => {
      if (!alive) return
      setMsgs(h)
      setMore(h.length >= 30)
      const first = h.find((m) => !m.out && m.id > chat.readInboxMaxId)
      setDividerId(first && h.some((m) => m.id < first.id) ? first.id : null)
      stick.current = !first
      setReady(true)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, chat.id])

  // ── live updates for this chat
  useEffect(() => {
    const offMsg = backend.onMessage((m) => {
      if (m.chatId !== chat.id) return
      add(m)
      if (!m.out && !stick.current) setAway((n) => n + 1)
    })
    const offUp = backend.onUpdate((u) => {
      if (u.type === 'edit' && u.msg.chatId === chat.id) setMsgs((p) => p.map((x) => (x.id === u.msg.id ? { ...x, ...u.msg } : x)))
      if (u.type === 'delete' && (!u.chatId || u.chatId === chat.id)) setMsgs((p) => p.filter((x) => !u.ids.includes(x.id)))
    })
    return () => {
      offMsg()
      offUp()
    }
  }, [backend, chat.id, add])

  // ── first scroll position
  useLayoutEffect(() => {
    if (!ready) return
    const el = scroller.current
    if (!el) return
    if (dividerId) el.querySelector(`[data-divider]`)?.scrollIntoView({ block: 'start' })
    else el.scrollTop = el.scrollHeight
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── keep the bottom in view for new messages
  useEffect(() => {
    const el = scroller.current
    if (el && ready && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: fresh.size ? 'smooth' : 'auto' })
  }, [msgs, ready, fresh])

  // ── mark messages as read once they are really on screen
  const flush = useCallback(() => {
    window.clearTimeout(readTimer.current)
    readTimer.current = window.setTimeout(() => {
      if (document.hidden || seenMax.current <= readMax.current) return
      const upTo = seenMax.current
      const count = msgsRef.current.filter((m) => !m.out && m.id > readMax.current && m.id <= upTo).length
      readMax.current = upTo
      backend.readUpTo(chat.id, upTo).catch(() => undefined)
      onRead(chat.id, upTo, count)
    }, 280)
  }, [backend, chat.id, onRead])

  useEffect(() => {
    const root = scroller.current
    if (!root || !ready) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const id = Number((e.target as HTMLElement).dataset.mid)
          if (id > seenMax.current) seenMax.current = id
        }
        flush()
      },
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('[data-watch="1"]').forEach((n) => io.observe(n))
    const vis = () => !document.hidden && flush()
    document.addEventListener('visibilitychange', vis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', vis)
    }
  }, [msgs, ready, flush])

  useEffect(() => () => window.clearTimeout(readTimer.current), [])

  const loadEarlier = async () => {
    const el = scroller.current
    if (!el || !msgs.length) return
    const before = el.scrollHeight
    const h = await backend.history(chat.id, msgs[0].id)
    setMore(h.length >= 30)
    stick.current = false
    setMsgs((prev) => [...h, ...prev])
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - before
    })
  }

  const toBottom = () => {
    const el = scroller.current
    stick.current = true
    setAway(0)
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  const jump = (id: number) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-mid="${id}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el.classList.add('flash')
    window.setTimeout(() => el.classList.remove('flash'), 1400)
  }

  const flash = (s: string) => {
    setToast(s)
    window.setTimeout(() => setToast(''), 1600)
  }

  // ── sending
  const send = async () => {
    const body = text.trim()
    if (!body) return
    if (editing) {
      const target = editing
      setEditing(null)
      setText('')
      if (body !== target.text) {
        const m = await backend.edit(chat.id, target.id, body)
        setMsgs((p) => p.map((x) => (x.id === m.id ? { ...x, ...m } : x)))
      }
      return
    }
    const replyId = reply?.id
    const quote = reply ? { id: reply.id, text: reply.text, media: reply.media, sender: reply.out ? undefined : reply.sender ?? chat.title } : undefined
    setText('')
    setReply(null)
    resize(true)
    stick.current = true
    const temp: Msg = { id: -Date.now(), chatId: chat.id, out: true, text: body, date: Math.floor(Date.now() / 1000), pending: true, replyTo: quote }
    add(temp)
    try {
      const m = await backend.send(chat.id, body, replyId)
      setMsgs((p) => {
        const without = p.filter((x) => x.id !== temp.id)
        return without.some((x) => x.id === m.id) ? without : [...without, m]
      })
    } catch {
      setMsgs((p) => p.filter((x) => x.id !== temp.id))
      setText(body)
    }
  }

  const sendFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      stick.current = true
      const temp: Msg = { id: -Date.now(), chatId: chat.id, out: true, text: '', date: Math.floor(Date.now() / 1000), pending: true, media: f.type.startsWith('image/') ? 'photo' : 'file', file: { name: f.name, size: f.size, mime: f.type } }
      add(temp)
      try {
        const m = await backend.sendFile(chat.id, f, '', reply?.id)
        setReply(null)
        setMsgs((p) => [...p.filter((x) => x.id !== temp.id && x.id !== m.id), m])
      } catch {
        setMsgs((p) => p.filter((x) => x.id !== temp.id))
      }
    }
  }

  const resize = (reset = false) => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    if (!reset) el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  const openMenu = useCallback((m: Msg, x: number, y: number) => {
    if (m.pending) return
    setMenu({ m, x, y })
  }, [])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', key)
    }
  }, [menu])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !menu) {
        if (reply) setReply(null)
        else if (editing) {
          setEditing(null)
          setText('')
        }
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [reply, editing, menu])

  let lastDay = ''
  const status = typing ? null : chat.kind === 'user' ? (chat.bot ? t('bot') : presenceText(t, chat.presence, locale)) : t(`kind.${chat.kind}` as Key)

  return (
    <motion.div
      className="chat-in"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onDragOver={(e) => {
        if (chat.canWrite && e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDrag(true)
        }
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (chat.canWrite && e.dataTransfer.files.length) sendFiles(e.dataTransfer.files)
      }}
    >
      <header className="chat-head">
        <button className="icon-btn back" onClick={onBack} aria-label={t('back')}>
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path fill="currentColor" d="m14 6-6 6 6 6 1.4-1.4L10.8 12l4.6-4.6L14 6Z" />
          </svg>
        </button>
        <Avatar backend={backend} id={chat.id} title={chat.title} size={44} />
        <div className="who">
          <strong>{chat.title}</strong>
          {typing ? (
            <span className="typing">
              {t('typing')}
              <i />
              <i />
              <i />
            </span>
          ) : (
            <span className={chat.presence?.state === 'online' ? 'online' : ''}>{status}</span>
          )}
        </div>
      </header>

      <div
        className="msgs"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          const near = el.scrollHeight - el.scrollTop - el.clientHeight < 140
          stick.current = near
          setAtBottom(near)
          if (near) setAway(0)
        }}
      >
        {more && ready && (
          <button className="btn ghost small" onClick={loadEarlier}>
            {t('earlier')}
          </button>
        )}
        {msgs.map((m, i) => {
          const day = new Date(m.date * 1000).toDateString()
          const showDay = day !== lastDay
          lastDay = day
          const prev = msgs[i - 1]
          const joined = !showDay && prev && prev.out === m.out && prev.sender === m.sender && m.date - prev.date < 300 && m.id !== dividerId
          return (
            <div key={m.id} className="fragment">
              {showDay && <div className="day">{formatDay(m.date, locale, t)}</div>}
              {m.id === dividerId && (
                <div className="divider" data-divider>
                  <span>{t('newMessages')}</span>
                </div>
              )}
              <Bubble
                backend={backend}
                m={m}
                joined={!!joined}
                animate={fresh.has(m.id)}
                showName={chat.kind !== 'user' && !m.out && !joined}
                read={m.id > 0 && m.id <= chat.readOutboxMaxId}
                watch={!m.out && m.id > readMax.current}
                onMenu={openMenu}
                onJump={jump}
              />
            </div>
          )
        })}
      </div>

      <AnimatePresence>
        {(!atBottom || away > 0) && ready && (
          <motion.button
            className="to-bottom"
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 10 }}
            onClick={toBottom}
            aria-label="down"
          >
            {away > 0 && <b>{away}</b>}
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path fill="currentColor" d="m6 9 6 6 6-6-1.4-1.4L12 12.2 7.4 7.6Z" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {chat.canWrite ? (
        <div className="composer-wrap">
          <AnimatePresence>
            {(reply || editing) && (
              <motion.div className="bar" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <span className="bar-line" />
                <span className="bar-text">
                  <b>{editing ? t('editing') : `${t('replying')} · ${reply!.out ? t('you') : reply!.sender ?? chat.title}`}</b>
                  <span>{(editing ?? reply)!.text || t(`media.${(editing ?? reply)!.media ?? 'other'}` as Key)}</span>
                </span>
                <button
                  className="icon-btn"
                  onClick={() => {
                    setReply(null)
                    if (editing) {
                      setEditing(null)
                      setText('')
                    }
                  }}
                  aria-label={t('cancel')}
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <button type="button" className="icon-btn" onClick={() => fileInput.current?.click()} aria-label={t('attach')}>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path fill="currentColor" d="M16.5 6v9.5a4.5 4.5 0 0 1-9 0V5a3 3 0 0 1 6 0v9.5a1.5 1.5 0 0 1-3 0V6H9.5v8.5a3 3 0 0 0 6 0V5a4.5 4.5 0 0 0-9 0v10.5a6 6 0 0 0 12 0V6Z" />
              </svg>
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) sendFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <textarea
              ref={field}
              rows={1}
              value={text}
              placeholder={t('write')}
              onChange={(e) => {
                setText(e.target.value)
                resize()
                if (e.target.value) backend.setTyping(chat.id)
              }}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files)
                if (files.length) {
                  e.preventDefault()
                  sendFiles(files)
                }
              }}
              onKeyDown={(e) => {
                const touch = matchMedia('(pointer: coarse)').matches
                if (e.key === 'Enter' && !e.shiftKey && !touch) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <div className="emoji-wrap">
              <button type="button" className="icon-btn" onClick={() => setEmoji((v) => !v)} aria-label={t('emoji')}>
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-3.5-9a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm7 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6ZM12 17.5c2.2 0 3.9-1.2 4.5-3h-9c.6 1.8 2.300 3 4.500 3Z" />
                </svg>
              </button>
              <AnimatePresence>
                {emoji && (
                  <motion.div className="emoji-pop" initial={{ opacity: 0, y: 8, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.94 }} transition={{ type: 'spring', stiffness: 460, damping: 28 }}>
                    {EMOJIS.map((e) => (
                      <button
                        type="button"
                        key={e}
                        onClick={() => {
                          setText((v) => v + e)
                          field.current?.focus()
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <motion.button className="send" disabled={!text.trim()} whileTap={{ scale: 0.8, rotate: 18 }} aria-label={t('send')}>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2 0 6.4Z" />
              </svg>
            </motion.button>
          </form>
        </div>
      ) : (
        <div className="composer ro">{t('readonly')}</div>
      )}

      <AnimatePresence>
        {drag && (
          <motion.div className="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span>{t('attach')}</span>
          </motion.div>
        )}
        {toast && (
          <motion.div className="toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {menu && (
          <motion.div
            className="ctx"
            style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - (menu.ask ? 150 : 210)) }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 520, damping: 30 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {menu.ask ? (
              <div className="ctx-ask">
                <p>{t('delete.ask')}</p>
                <div className="row">
                  <button className="btn ghost small" onClick={() => setMenu(null)}>
                    {t('cancel')}
                  </button>
                  <button
                    className="btn danger small"
                    onClick={() => {
                      backend.remove(chat.id, [menu.m.id])
                      setMsgs((p) => p.filter((x) => x.id !== menu.m.id))
                      setMenu(null)
                    }}
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {chat.canWrite && (
                  <button
                    onClick={() => {
                      setReply(menu.m)
                      setEditing(null)
                      setMenu(null)
                      field.current?.focus()
                    }}
                  >
                    {t('reply')}
                  </button>
                )}
                {menu.m.text && (
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(menu.m.text).then(() => flash(t('copied')))
                      setMenu(null)
                    }}
                  >
                    {t('copy')}
                  </button>
                )}
                {menu.m.out && menu.m.text && !menu.m.media && (
                  <button
                    onClick={() => {
                      setEditing(menu.m)
                      setReply(null)
                      setText(menu.m.text)
                      setMenu(null)
                      requestAnimationFrame(() => {
                        field.current?.focus()
                        resize()
                      })
                    }}
                  >
                    {t('edit')}
                  </button>
                )}
                {menu.m.out && (
                  <button className="danger" onClick={() => setMenu({ ...menu, ask: true })}>
                    {t('delete')}
                  </button>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function formatDay(ts: number, locale: string, t: (k: Key) => string) {
  const d = new Date(ts * 1000)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return t('today')
  if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return t('yesterday')
  return dateLabel(d, locale, d.getFullYear() !== today.getFullYear(), false)
}

const MONTHS: Record<string, string[]> = {
  'uz-UZ': ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
}

export function dateLabel(d: Date, locale: string, withYear: boolean, short: boolean) {
  const names = MONTHS[locale]
  if (names) {
    const m = short ? names[d.getMonth()].slice(0, 3) : names[d.getMonth()]
    return `${d.getDate()}-${m}${withYear ? ` ${d.getFullYear()}` : ''}`
  }
  return d.toLocaleDateString(locale, { day: 'numeric', month: short ? 'short' : 'long', year: withYear ? 'numeric' : undefined })
}
