import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Backend, Chat, MediaKind, Msg } from '../types'
import { useI18n, type Key } from '../i18n'
import { Avatar } from '../components/Avatar'
import { Wordmark } from '../components/Wordmark'
import { Settings } from '../components/Settings'

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
  const activeRef = useRef<string | null>(null)
  activeRef.current = activeId

  useEffect(() => {
    backend.dialogs().then((d) => {
      setChats(d)
      setLoaded(true)
    })
  }, [backend])

  useEffect(
    () =>
      backend.onMessage((m, chat) => {
        setChats((prev) => {
          const i = prev.findIndex((c) => c.id === m.chatId)
          if (i === -1) return chat ? [chat, ...prev] : prev
          const c = prev[i]
          const next = [...prev]
          next[i] = {
            ...c,
            previewText: m.text,
            previewMedia: m.media,
            date: m.date,
            unread: m.out || m.chatId === activeRef.current ? c.unread : c.unread + 1,
          }
          return next
        })
      }),
    [backend],
  )

  const open = useCallback(
    (id: string) => {
      setActiveId(id)
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)))
      backend.markRead(id).catch(() => undefined)
    },
    [backend],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sortChats(chats).filter((c) => (!q || c.title.toLowerCase().includes(q)) && (!onlyUnread || c.unread > 0))
  }, [chats, query, onlyUnread])

  const active = chats.find((c) => c.id === activeId) ?? null
  const totalUnread = chats.reduce((n, c) => n + c.unread, 0)

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
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} />
          </label>
          <div className="chips">
            <button className={!onlyUnread ? 'chip on' : 'chip'} onClick={() => setOnlyUnread(false)}>
              {t('all')}
            </button>
            <button className={onlyUnread ? 'chip on' : 'chip'} onClick={() => setOnlyUnread(true)}>
              {t('unread')}
              {totalUnread > 0 && <b>{totalUnread > 99 ? '99+' : totalUnread}</b>}
            </button>
          </div>
        </header>

        <div className="scroll">
          {!loaded && [0, 1, 2, 3, 4].map((i) => <div className="skeleton" key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}
          {loaded && visible.length === 0 && <p className="muted center">{query || onlyUnread ? t('empty.search') : t('empty.chats')}</p>}
          <AnimatePresence initial={false}>
            {visible.map((c) => (
              <ChatRow key={c.id} backend={backend} chat={c} active={c.id === activeId} onOpen={open} />
            ))}
          </AnimatePresence>
        </div>
      </aside>

      <section className="panel chat">
        <AnimatePresence mode="wait">
          {active ? (
            <ChatView key={active.id} backend={backend} chat={active} onBack={() => setActiveId(null)} />
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
    </motion.div>
  )
}

function mediaLabel(t: (k: Key) => string, kind?: MediaKind) {
  return kind ? t(`media.${kind}` as Key) : ''
}

function ChatRow({ backend, chat, active, onOpen }: { backend: Backend; chat: Chat; active: boolean; onOpen: (id: string) => void }) {
  const { t, locale } = useI18n()
  const label = mediaLabel(t, chat.previewMedia)
  const preview = chat.previewText || label
  const time = chat.date ? formatListTime(chat.date, locale, t) : ''
  return (
    <motion.button
      layout="position"
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      className={`row-chat ${active ? 'active' : ''}`}
      onClick={() => onOpen(chat.id)}
      whileTap={{ scale: 0.97 }}
    >
      <Avatar backend={backend} id={chat.id} title={chat.title} />
      <span className="mid">
        <span className="name">
          {chat.pinned && <em className="pin">●</em>}
          {chat.title}
        </span>
        <span className="prev">
          {chat.previewText && chat.previewMedia && <b>{label}</b>}
          {preview}
        </span>
      </span>
      <span className="end">
        <span className="time">{time}</span>
        {chat.unread > 0 && (
          <motion.span className="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }} key={chat.unread}>
            {chat.unread > 99 ? '99+' : chat.unread}
          </motion.span>
        )}
      </span>
    </motion.button>
  )
}

function ChatView({ backend, chat, onBack }: { backend: Backend; chat: Chat; onBack: () => void }) {
  const { t, locale } = useI18n()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [ready, setReady] = useState(false)
  const [fresh, setFresh] = useState<Set<number>>(new Set())
  const [more, setMore] = useState(true)
  const [text, setText] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  const add = useCallback((m: Msg) => {
    setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    setFresh((f) => new Set(f).add(m.id))
  }, [])

  useEffect(() => {
    let alive = true
    backend.history(chat.id).then((h) => {
      if (!alive) return
      setMsgs(h)
      setMore(h.length >= 30)
      setReady(true)
    })
    const off = backend.onMessage((m) => {
      if (m.chatId !== chat.id) return
      add(m)
      backend.markRead(chat.id).catch(() => undefined)
    })
    return () => {
      alive = false
      off()
    }
  }, [backend, chat.id, add])

  useEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: ready && fresh.size ? 'smooth' : 'auto' })
  }, [msgs, ready, fresh])

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

  const send = async () => {
    const body = text.trim()
    if (!body) return
    setText('')
    stick.current = true
    const m = await backend.send(chat.id, body)
    add(m)
  }

  let lastDay = ''
  return (
    <motion.div className="chat-in" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <header className="chat-head">
        <button className="icon-btn back" onClick={onBack} aria-label={t('back')}>
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path fill="currentColor" d="m14 6-6 6 6 6 1.4-1.4L10.8 12l4.6-4.6L14 6Z" />
          </svg>
        </button>
        <Avatar backend={backend} id={chat.id} title={chat.title} size={44} />
        <div className="who">
          <strong>{chat.title}</strong>
          <span>{t(`kind.${chat.kind}` as Key)}</span>
        </div>
      </header>

      <div
        className="msgs"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
        }}
      >
        {more && ready && (
          <button className="btn ghost small" onClick={loadEarlier}>
            {t('earlier')}
          </button>
        )}
        {msgs.map((m, i) => {
          const day = dayKey(m.date)
          const showDay = day !== lastDay
          lastDay = day
          const prev = msgs[i - 1]
          const joined = !showDay && prev && prev.out === m.out && prev.sender === m.sender && m.date - prev.date < 300
          return (
            <div key={m.id} className="fragment">
              {showDay && <div className="day">{formatDay(m.date, locale, t)}</div>}
              <Bubble backend={backend} m={m} joined={!!joined} animate={fresh.has(m.id)} showName={chat.kind !== 'user' && !m.out && !joined} />
            </div>
          )
        })}
      </div>

      {chat.canWrite ? (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <textarea
            rows={1}
            value={text}
            placeholder={t('write')}
            onChange={(e) => {
              setText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
            }}
            onKeyDown={(e) => {
              const touch = matchMedia('(pointer: coarse)').matches
              if (e.key === 'Enter' && !e.shiftKey && !touch) {
                e.preventDefault()
                send()
              }
            }}
          />
          <motion.button className="send" disabled={!text.trim()} whileTap={{ scale: 0.8, rotate: 18 }} aria-label="send">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2 0 6.4Z" />
            </svg>
          </motion.button>
        </form>
      ) : (
        <div className="composer ro">{t('readonly')}</div>
      )}
    </motion.div>
  )
}

function Bubble({ backend, m, joined, animate, showName }: { backend: Backend; m: Msg; joined: boolean; animate: boolean; showName: boolean }) {
  const { t, locale } = useI18n()
  const time = new Date(m.date * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return (
    <motion.div
      className={`msg ${m.out ? 'out' : 'in'} ${joined ? 'joined' : ''}`}
      initial={animate ? { opacity: 0, y: 18, scale: 0.9 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      style={{ transformOrigin: m.out ? 'bottom right' : 'bottom left' }}
    >
      {showName && m.sender && <span className="sender">{m.sender}</span>}
      {m.media === 'photo' && <Photo backend={backend} m={m} />}
      {m.media && m.media !== 'photo' && (
        <span className="media-chip">
          <i />
          <span>
            <b>{t(`media.${m.media}` as Key)}</b>
            <small>{t('media.hint')}</small>
          </span>
        </span>
      )}
      {m.text && <span className="text">{m.text}</span>}
      <time>{time}</time>
    </motion.div>
  )
}

function Photo({ backend, m }: { backend: Backend; m: Msg }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let alive = true
    backend.photo(m.chatId, m.id).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [backend, m.chatId, m.id])
  return <span className={`photo ${url ? 'ready' : ''}`}>{url && <img src={url} alt="" />}</span>
}

const dayKey = (ts: number) => new Date(ts * 1000).toDateString()

const MONTHS: Record<string, string[]> = {
  'uz-UZ': ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
}

function dateLabel(d: Date, locale: string, withYear: boolean, short: boolean) {
  const names = MONTHS[locale]
  if (names) {
    const m = short ? names[d.getMonth()].slice(0, 3) : names[d.getMonth()]
    return `${d.getDate()}-${m}${withYear ? ` ${d.getFullYear()}` : ''}`
  }
  return d.toLocaleDateString(locale, { day: 'numeric', month: short ? 'short' : 'long', year: withYear ? 'numeric' : undefined })
}

function formatDay(ts: number, locale: string, t: (k: Key) => string) {
  const d = new Date(ts * 1000)
  const today = new Date()
  const yest = new Date(Date.now() - 864e5)
  if (d.toDateString() === today.toDateString()) return t('today')
  if (d.toDateString() === yest.toDateString()) return t('yesterday')
  return dateLabel(d, locale, d.getFullYear() !== today.getFullYear(), false)
}

function formatListTime(ts: number, locale: string, t: (k: Key) => string) {
  const d = new Date(ts * 1000)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return t('yesterday')
  return dateLabel(d, locale, false, true)
}
