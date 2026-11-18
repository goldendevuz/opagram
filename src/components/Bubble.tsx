import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { Backend, Msg } from '../types'
import { useI18n, type Key } from '../i18n'
import { RichText } from './RichText'

interface Props {
  backend: Backend
  m: Msg
  joined: boolean
  animate: boolean
  showName: boolean
  /** Outgoing message already read by the other side. */
  read: boolean
  /** Incoming and not yet read: the chat view watches these to mark them read. */
  watch: boolean
  onMenu: (m: Msg, x: number, y: number) => void
  onJump: (id: number) => void
}

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const fmtDur = (s = 0) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function Bubble({ backend, m, joined, animate, showName, read, watch, onMenu, onJump }: Props) {
  const { t, locale } = useI18n()
  const press = useRef<number>(0)
  const time = new Date(m.date * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  const startPress = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    const { clientX: x, clientY: y } = e
    press.current = window.setTimeout(() => onMenu(m, x, y), 450)
  }
  const stopPress = () => window.clearTimeout(press.current)

  return (
    <motion.div
      className={`msg ${m.out ? 'out' : 'in'} ${joined ? 'joined' : ''} ${m.media === 'sticker' ? 'sticker' : ''}`}
      data-mid={m.id}
      data-watch={watch ? '1' : undefined}
      initial={animate ? { opacity: 0, y: 18, scale: 0.9 } : false}
      animate={{ opacity: m.pending ? 0.65 : 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      style={{ transformOrigin: m.out ? 'bottom right' : 'bottom left' }}
      onContextMenu={(e) => {
        e.preventDefault()
        onMenu(m, e.clientX, e.clientY)
      }}
      onPointerDown={startPress}
      onPointerUp={stopPress}
      onPointerLeave={stopPress}
      onPointerCancel={stopPress}
    >
      {showName && m.sender && <span className="sender">{m.sender}</span>}

      {m.replyTo && (
        <button type="button" className="quote" onClick={() => onJump(m.replyTo!.id)}>
          <b>{m.replyTo.sender ?? t('you')}</b>
          <span>{m.replyTo.text || (m.replyTo.media ? t(`media.${m.replyTo.media}` as Key) : t('deleted'))}</span>
        </button>
      )}

      {m.media === 'photo' && <Photo backend={backend} m={m} />}
      {m.media === 'sticker' && <Sticker backend={backend} m={m} />}
      {m.media === 'voice' && <Voice backend={backend} m={m} />}
      {m.media === 'video' && <Video backend={backend} m={m} />}
      {(m.media === 'file' || m.media === 'other') && <FileChip backend={backend} m={m} />}

      {m.text && (
        <span className="text">
          <RichText text={m.text} entities={m.entities} />
        </span>
      )}

      <span className="meta">
        {m.edited && <i>{t('edited')}</i>}
        <time>{time}</time>
        {m.out && <Ticks state={m.pending ? 'pending' : read ? 'read' : 'sent'} />}
      </span>
    </motion.div>
  )
}

export function Ticks({ state }: { state: 'pending' | 'sent' | 'read' }) {
  if (state === 'pending')
    return (
      <svg className="tick" viewBox="0 0 16 16" width="15" height="15" aria-hidden>
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 5v3.2l2 1.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  return (
    <svg className={`tick ${state}`} viewBox="0 0 20 16" width="19" height="15" aria-hidden>
      <path d="m1.5 8.5 3.6 3.6L12 4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {state === 'read' && <path d="m8.2 11.9 1 .9 8.3-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

function useLoader(load: () => Promise<string | undefined>, _deps?: unknown[]) {
  const [url, setUrl] = useState<string>()
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const run = () => {
    setState('loading')
    load().then((u) => {
      setUrl(u)
      setState(u ? 'idle' : 'failed')
    })
  }
  return { url, state, run }
}

function Photo({ backend, m }: { backend: Backend; m: Msg }) {
  const { url, state, run } = useLoader(() => backend.photo(m.chatId, m.id), [m.id])
  useEffect(run, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button type="button" className={`photo ${url ? 'ready' : ''} ${state}`} onClick={() => !url && run()}>
      {url && <img src={url} alt="" draggable={false} />}
      {state === 'failed' && <span>↻</span>}
    </button>
  )
}

function Sticker({ backend, m }: { backend: Backend; m: Msg }) {
  const mime = m.file?.mime ?? ''
  const animated = mime === 'application/x-tgsticker'
  const { url, run } = useLoader(async () => (await backend.media(m.chatId, m.id))?.url, [m.id])
  useEffect(() => {
    if (!animated) run()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (animated || (!url && !mime.startsWith('image') && !mime.startsWith('video'))) return <span className="emoji-sticker">{m.file?.emoji ?? '🙂'}</span>
  if (!url) return <span className="photo sticker-ph" />
  return mime.startsWith('video') ? <video className="sticker-img" src={url} autoPlay loop muted playsInline /> : <img className="sticker-img" src={url} alt={m.file?.emoji ?? ''} draggable={false} />
}

function Voice({ backend, m }: { backend: Backend; m: Msg }) {
  const { t } = useI18n()
  const { url, state, run } = useLoader(async () => (await backend.media(m.chatId, m.id))?.url, [m.id])
  return (
    <span className="voice">
      {url ? (
        <audio src={url} controls autoPlay />
      ) : (
        <>
          <button type="button" className="play" onClick={run} aria-label="play">
            {state === 'loading' ? <i className="spin sm" /> : <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>}
          </button>
          <span className="wave" aria-hidden>
            {Array.from({ length: 22 }, (_, i) => (
              <i key={i} style={{ height: 6 + ((i * 37) % 17) }} />
            ))}
          </span>
          <small>{state === 'failed' ? '↻' : fmtDur(m.file?.duration)}</small>
        </>
      )}
      {!url && state === 'loading' && <span className="sr">{t('loading')}</span>}
    </span>
  )
}

function Video({ backend, m }: { backend: Backend; m: Msg }) {
  const { url, state, run } = useLoader(async () => (await backend.media(m.chatId, m.id))?.url, [m.id])
  if (url) return <video className="video" src={url} controls autoPlay playsInline />
  return (
    <button type="button" className="video ph" onClick={run}>
      {state === 'loading' ? <i className="spin" /> : <svg viewBox="0 0 24 24" width="30" height="30"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>}
      <small>{fmtDur(m.file?.duration)}{m.file ? ` · ${fmtSize(m.file.size)}` : ''}</small>
    </button>
  )
}

function FileChip({ backend, m }: { backend: Backend; m: Msg }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const download = async () => {
    setBusy(true)
    const r = await backend.media(m.chatId, m.id)
    setBusy(false)
    if (!r) return
    const a = document.createElement('a')
    a.href = r.url
    a.download = m.file?.name ?? 'file'
    a.click()
  }
  return (
    <button type="button" className="media-chip" onClick={m.file ? download : undefined}>
      <i>{busy ? <span className="spin sm" /> : <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 3v11.2l4.3-4.3 1.4 1.4L12 17l-5.7-5.7 1.4-1.4 4.3 4.3V3Zm-7 16h14v2H5z" /></svg>}</i>
      <span>
        <b>{m.file?.name ?? t('media.other')}</b>
        <small>{m.file ? `${fmtSize(m.file.size)} · ${t('download')}` : t('media.hint')}</small>
      </span>
    </button>
  )
}
