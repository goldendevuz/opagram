import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Backend, Chat, MediaKind } from '../types'
import { useI18n, type Key } from '../i18n'
import { Avatar } from '../components/Avatar'
import { Wordmark } from '../components/Wordmark'
import { Settings } from '../components/Settings'
import { ChatView, dateLabel } from '../components/ChatView'
import { Ticks } from '../components/Bubble'
import { askNotifyOnce, notify } from '../lib/notify'
import { playInChat, playIncoming, unlockAudio } from '../lib/sound'
import { searchKey } from '../lib/translit'

interface Props {
  backend: Backend
  onLogout: () => void
}

const sortChats = (list: Chat[]) =>
  [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date - a.date)

export function Messenger({ backend, onLogout }: Props) {
  const { t } = useI18n()
  const [chats, setChats] = useState<Chat[]>([])
  const [loaded, setLoaded] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [settings, setSettings] = useState(false)
  const [typing, setTyping] = useState<Record<string, number>>({})
  const [found, setFound] = useState<Chat[]>([])
  const [menu, setMenu] = useState<{ chat: Chat; x: number; y: number } | null>(null)
  const activeRef = useRef<string | null>(null)
  const chatsRef = useRef<Chat[]>([])
  activeRef.current = activeId
  chatsRef.current = chats

  useEffect(() => {
    backend.dialogs().then((d) => {
      setChats(d)
      setLoaded(true)
      // the first page shows up fast; the rest of the chats arrive in the background
      backend
        .moreDialogs()
        .then((all) =>
          setChats((cur) => {
            const have = new Set(cur.map((c) => c.id))
            return [...cur, ...all.filter((c) => !have.has(c.id))]
          }),
        )
        .catch(() => undefined)
    })
  }, [backend])

  // sound and notification permission both need a user gesture first
  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      askNotifyOnce()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // new messages: preview, unread counter, sound, desktop notification
  useEffect(
    () =>
      backend.onMessage((m, chat) => {
        const known = chatsRef.current.find((c) => c.id === m.chatId) ?? chat
        if (!m.out) setTyping((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== m.chatId)))
        if (!m.out && known && !known.muted) {
          if (document.hidden || m.chatId !== activeRef.current) playIncoming()
          else playInChat()
        }
        if (!m.out && known && !known.muted && (document.hidden || m.chatId !== activeRef.current)) {
          notify(known.title, m.text || t(`media.${m.media ?? 'other'}` as Key), () => setActiveId(m.chatId))
        }
        setChats((prev) => {
          const i = prev.findIndex((c) => c.id === m.chatId)
          if (i === -1) return chat ? [{ ...chat, unread: m.out ? 0 : 1 }, ...prev] : prev
          const c = prev[i]
          const next = [...prev]
          next[i] = {
            ...c,
            previewText: m.text,
            previewMedia: m.media,
            previewOut: m.out,
            previewId: m.id,
            date: m.date,
            unread: m.out ? c.unread : c.unread + 1,
          }
          return next
        })
      }),
    [backend, t],
  )

  // read receipts, typing, online status
  useEffect(
    () =>
      backend.onUpdate((u) => {
        if (u.type === 'read-out') setChats((p) => p.map((c) => (c.id === u.chatId ? { ...c, readOutboxMaxId: Math.max(c.readOutboxMaxId, u.maxId) } : c)))
        if (u.type === 'presence') setChats((p) => p.map((c) => (c.id === u.chatId ? { ...c, presence: u.presence } : c)))
        if (u.type === 'typing') {
          const until = Date.now() + 5500
          setTyping((p) => ({ ...p, [u.chatId]: until }))
          window.setTimeout(() => setTyping((p) => (p[u.chatId] && p[u.chatId] <= Date.now() ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== u.chatId)) : p)), 5600)
        }
        if (u.type === 'edit') setChats((p) => p.map((c) => (c.id === u.msg.chatId && c.previewOut === u.msg.out && c.date === u.msg.date ? { ...c, previewText: u.msg.text } : c)))
      }),
    [backend],
  )

  const open = useCallback((id: string) => {
    setActiveId(id)
    setFound([])
  }, [])

  const markRead = useCallback(
    async (c: Chat) => {
      if (c.previewId > 0) await backend.readUpTo(c.id, c.previewId).catch(() => undefined)
      setChats((p) => p.map((x) => (x.id === c.id ? { ...x, unread: 0, readInboxMaxId: Math.max(x.readInboxMaxId, x.previewId) } : x)))
    },
    [backend],
  )

  const markAllRead = async () => {
    for (const c of chatsRef.current.filter((x) => x.unread > 0)) {
      await markRead(c)
      await new Promise((r) => setTimeout(r, 120))
    }
  }

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [menu])

  const onRead = useCallback((chatId: string, maxId: number, count: number) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, readInboxMaxId: Math.max(c.readInboxMaxId, maxId), unread: Math.max(0, c.unread - count) } : c)),
    )
  }, [])

  const key = useMemo(() => searchKey(query), [query])
  const visible = useMemo(
    () =>
      sortChats(chats).filter(
        (c) => (!key || searchKey(c.title).includes(key) || searchKey(c.username ?? '').includes(key.replace(/^@/, ''))) && (!onlyUnread || c.unread > 0),
      ),
    [chats, key, onlyUnread],
  )

  // names and @usernames that are not among our chats are looked up on Telegram
  useEffect(() => {
    setFound([])
    const q = query.trim()
    if (q.replace(/^@/, '').length < 2 || onlyUnread) return
    let alive = true
    const timer = window.setTimeout(async () => {
      const [byName, exact] = await Promise.all([backend.search(q), /^@?[a-zA-Z][\w]{3,31}$/.test(q) ? backend.resolve(q) : Promise.resolve(undefined)])
      if (!alive) return
      const have = new Set(chatsRef.current.map((c) => c.id))
      const list = [...(exact ? [exact] : []), ...byName].filter((c, i, a) => !have.has(c.id) && a.findIndex((x) => x.id === c.id) === i)
      setFound(list)
    }, 400)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [query, backend, onlyUnread])

  const startFound = (c: Chat) => {
    setChats((p) => (p.some((x) => x.id === c.id) ? p : [c, ...p]))
    setQuery('')
    open(c.id)
  }

  const active = chats.find((c) => c.id === activeId) ?? null
  const totalUnread = chats.reduce((n, c) => n + (c.muted ? 0 : c.unread), 0)
  const allUnread = chats.reduce((n, c) => n + c.unread, 0)

  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread > 99 ? '99+' : totalUnread}) OpaGram` : 'OpaGram'
  }, [totalUnread])

  return (
    <motion.div className={`app ${active ? 'has-chat' : ''}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <aside className="panel list">
        <header className="list-head">
          <div className="row">
            <Wordmark />
            <div className="grow" />
            <button className="icon-btn" onClick={() => setSettings((s) => !s)} aria-label={t('settings')}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1L14.9 3h-4l-.4 2.9c-.6.2-1.2.6-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.8 1.7 1l.4 2.9h4l.4-2.9c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6ZM12.9 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
              </svg>
            </button>
            <AnimatePresence>{settings && <Settings onClose={() => setSettings(false)} onLogout={onLogout} />}</AnimatePresence>
          </div>
          <label className="search">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path fill="currentColor" d="M10 4a6 6 0 1 0 3.5 10.9l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
            </svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} autoComplete="off" spellCheck={false} />
          </label>
          <div className="chips">
            <button className={!onlyUnread ? 'chip on' : 'chip'} onClick={() => setOnlyUnread(false)}>
              {t('all')}
            </button>
            <button className={onlyUnread ? 'chip on' : 'chip'} onClick={() => setOnlyUnread(true)}>
              {t('unread')}
              {allUnread > 0 && <b>{allUnread > 99 ? '99+' : allUnread}</b>}
            </button>
            {allUnread > 0 && (
              <button className="icon-btn read-all" onClick={markAllRead} title={t('markAllRead')} aria-label={t('markAllRead')}>
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path fill="currentColor" d="m2 12.5 1.4-1.4 3.6 3.6L16.6 5.1 18 6.5 7 17.5Zm7.4 0 1.4-1.4 2.2 2.2L22.6 3.7 24 5.1 13 16.1Z" />
                </svg>
              </button>
            )}
          </div>
        </header>

        <div className="scroll">
          {!loaded && [0, 1, 2, 3, 4].map((i) => <div className="skeleton" key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}
          {loaded && visible.length === 0 && found.length === 0 && <p className="muted center">{query || onlyUnread ? t('empty.search') : t('empty.chats')}</p>}
          <AnimatePresence initial={false}>
            {visible.map((c) => (
              <ChatRow key={c.id} backend={backend} chat={c} active={c.id === activeId} typing={(typing[c.id] ?? 0) > Date.now()} onOpen={open} onMenu={(chat, x, y) => setMenu({ chat, x, y })} />
            ))}
          </AnimatePresence>
          {found.length > 0 && (
            <>
              <p className="section">{t('global')}</p>
              {found.map((c) => (
                <button key={c.id} className="row-chat" onClick={() => startFound(c)}>
                  <Avatar backend={backend} id={c.id} title={c.title} colorId={c.colorId} />
                  <span className="mid">
                    <span className="name">
                      <span className="title">{c.title}</span>
                    </span>
                    <span className="prev">{c.username ? `@${c.username}` : t(`kind.${c.kind}` as Key)}</span>
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </aside>

      <section className="panel chat">
        <AnimatePresence mode="wait">
          {active ? (
            <ChatView key={active.id} backend={backend} chat={active} typing={(typing[active.id] ?? 0) > Date.now()} onBack={() => setActiveId(null)} onRead={onRead} />
          ) : (
            <motion.div key="empty" className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bubbles" aria-hidden>
                <i className="eb e1" />
                <i className="eb e2" />
                <i className="eb e3" />
              </div>
              <h2>{t('pick')}</h2>
              <p className="muted">{t('pickSub')}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {menu && (
          <motion.div
            className="ctx"
            style={{ left: Math.min(menu.x, window.innerWidth - 230), top: Math.min(menu.y, window.innerHeight - 70) }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 520, damping: 30 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                markRead(menu.chat)
                setMenu(null)
              }}
            >
              {t('markRead')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const label = (t: (k: Key) => string, kind?: MediaKind) => (kind ? t(`media.${kind}` as Key) : '')

function ChatRow({ backend, chat, active, typing, onOpen, onMenu }: { backend: Backend; chat: Chat; active: boolean; typing: boolean; onOpen: (id: string) => void; onMenu: (c: Chat, x: number, y: number) => void }) {
  const { t, locale } = useI18n()
  const press = useRef(0)
  const media = label(t, chat.previewMedia)
  const time = chat.date ? listTime(chat.date, locale, t) : ''
  return (
    <motion.button
      layout="position"
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      className={`row-chat ${active ? 'active' : ''} ${chat.unread > 0 ? 'has-unread' : ''}`}
      onClick={() => onOpen(chat.id)}
      whileTap={{ scale: 0.97 }}
      onContextMenu={(e) => {
        e.preventDefault()
        onMenu(chat, e.clientX, e.clientY)
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return
        const { clientX: x, clientY: y } = e
        press.current = window.setTimeout(() => onMenu(chat, x, y), 450)
      }}
      onPointerUp={() => window.clearTimeout(press.current)}
      onPointerLeave={() => window.clearTimeout(press.current)}
      onPointerCancel={() => window.clearTimeout(press.current)}
    >
      <Avatar backend={backend} id={chat.id} title={chat.title} colorId={chat.colorId} />
      <span className="mid">
        <span className="name">
          <span className="title">{chat.title}</span>
          {chat.presence?.state === 'online' && <i className="dot-online" />}
          {chat.muted && (
            <svg className="mute" viewBox="0 0 24 24" width="14" height="14" aria-label="muted">
              <path fill="currentColor" d="M12 3a1 1 0 0 0-.7.3L7.6 7H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3.6l3.7 3.7A1 1 0 0 0 13 20V4a1 1 0 0 0-1-1Zm5.3 5.3-1.4 1.4 2.3 2.3-2.3 2.3 1.4 1.4 2.3-2.3 2.3 2.3 1.4-1.4-2.3-2.3 2.3-2.3-1.4-1.4-2.3 2.3Z" />
            </svg>
          )}
        </span>
        <span className="prev">
          {typing ? (
            <span className="typing-prev">{t('typing')}</span>
          ) : (
            <>
              {chat.previewOut && <Ticks state={chat.readOutboxMaxId >= chat.previewId ? 'read' : 'sent'} />}
              {chat.previewText && chat.previewMedia && <b>{media}</b>}
              {chat.previewText || media}
            </>
          )}
        </span>
      </span>
      <span className="end">
        <span className="time">{time}</span>
        {chat.unread > 0 ? (
          <motion.span className={`badge ${chat.muted ? 'quiet' : ''}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }} key={chat.unread}>
            {chat.unread > 99 ? '99+' : chat.unread}
          </motion.span>
        ) : (
          chat.pinned && (
            <svg className="pin" viewBox="0 0 24 24" width="16" height="16" aria-label="pinned">
              <path fill="currentColor" d="M14 3.2 20.8 10l-1.4 1.4-1-1-3.2 3.2.5 3.4-1.4 1.4-3-3-4.9 4.9-1.4-1.4 4.9-4.9-3-3L8.3 9l3.4.5 3.2-3.2-1-1Z" />
            </svg>
          )
        )}
      </span>
    </motion.button>
  )
}

function listTime(ts: number, locale: string, t: (k: Key) => string) {
  const d = new Date(ts * 1000)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return t('yesterday')
  return dateLabel(d, locale, false, true)
}
