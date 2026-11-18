import { TelegramClient, Api, utils } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { NewMessage, Raw, type NewMessageEvent } from 'telegram/events'
import { EditedMessage } from 'telegram/events/EditedMessage'
import { DeletedMessage } from 'telegram/events/DeletedMessage'
import { CustomFile } from 'telegram/client/uploads'
import type { Backend, Chat, Ent, FileInfo, Keys, MediaKind, Msg, Presence, Update } from '../types'

const PAGE = 40

function docOf(m: Api.Message): Api.Document | undefined {
  const media = m.media
  if (media instanceof Api.MessageMediaDocument && media.document instanceof Api.Document) return media.document
  return undefined
}

function mediaKind(m: Api.Message): MediaKind | undefined {
  if (m.photo) return 'photo'
  if (!m.media) return undefined
  const d = docOf(m)
  if (d) {
    for (const a of d.attributes) {
      if (a instanceof Api.DocumentAttributeSticker) return 'sticker'
      if (a instanceof Api.DocumentAttributeAudio && a.voice) return 'voice'
      if (a instanceof Api.DocumentAttributeVideo) return 'video'
    }
    return 'file'
  }
  return 'other'
}

function fileInfo(m: Api.Message): FileInfo | undefined {
  const d = docOf(m)
  if (!d) return undefined
  const info: FileInfo = { name: 'file', size: Number(d.size), mime: d.mimeType }
  for (const a of d.attributes) {
    if (a instanceof Api.DocumentAttributeFilename) info.name = a.fileName
    if (a instanceof Api.DocumentAttributeAudio || a instanceof Api.DocumentAttributeVideo) info.duration = Math.round(Number(a.duration))
    if (a instanceof Api.DocumentAttributeSticker) info.emoji = a.alt
  }
  return info
}

function entitiesOf(m: Api.Message): Ent[] | undefined {
  if (!m.entities?.length) return undefined
  const out: Ent[] = []
  for (const e of m.entities) {
    const base = { offset: e.offset, length: e.length }
    if (e instanceof Api.MessageEntityBold) out.push({ ...base, type: 'bold' })
    else if (e instanceof Api.MessageEntityItalic) out.push({ ...base, type: 'italic' })
    else if (e instanceof Api.MessageEntityCode) out.push({ ...base, type: 'code' })
    else if (e instanceof Api.MessageEntityPre) out.push({ ...base, type: 'pre' })
    else if (e instanceof Api.MessageEntityStrike) out.push({ ...base, type: 'strike' })
    else if (e instanceof Api.MessageEntityUnderline) out.push({ ...base, type: 'underline' })
    else if (e instanceof Api.MessageEntitySpoiler) out.push({ ...base, type: 'spoiler' })
    else if (e instanceof Api.MessageEntityTextUrl) out.push({ ...base, type: 'link', url: e.url })
    else if (e instanceof Api.MessageEntityMention || e instanceof Api.MessageEntityMentionName) out.push({ ...base, type: 'mention' })
  }
  return out.length ? out : undefined
}

function presenceOf(e: any): Presence | undefined {
  const s = e?.status
  if (!s) return undefined
  switch (s.className) {
    case 'UserStatusOnline':
      return { state: 'online' }
    case 'UserStatusOffline':
      return { state: 'offline', ts: s.wasOnline }
    case 'UserStatusRecently':
      return { state: 'recently' }
    case 'UserStatusLastWeek':
      return { state: 'week' }
    case 'UserStatusLastMonth':
      return { state: 'month' }
    default:
      return { state: 'unknown' }
  }
}

function senderName(m: Api.Message): string | undefined {
  const s = m.sender as any
  return s?.firstName ?? s?.title
}

function blobUrl(buf: unknown, type = 'image/jpeg'): string | undefined {
  if (!buf || typeof buf === 'string') return undefined
  return URL.createObjectURL(new Blob([buf as BlobPart], { type }))
}

export class TelegramBackend implements Backend {
  private client: TelegramClient
  private keys: Keys
  private entities = new Map<string, any>()
  private messages = new Map<string, Api.Message>()
  private codeHash = ''
  private phone = ''
  private listeners = new Set<(m: Msg, chat?: Chat) => void>()
  private updaters = new Set<(u: Update) => void>()
  private started = false
  private lastTyping = 0
  private active = 0
  private waiters: (() => void)[] = []
  private cache = new Map<string, string>()

  constructor(keys: Keys, session = '') {
    this.keys = keys
    this.client = new TelegramClient(new StringSession(session), keys.apiId, keys.apiHash, {
      connectionRetries: 5,
      useWSS: true,
      appVersion: 'OpaGram 0.2',
    })
    this.client.setLogLevel('none' as never)
  }

  /** Connects; resolves true when the saved session is still signed in. */
  async connect(): Promise<boolean> {
    await this.client.connect()
    const ok = await this.client.checkAuthorization()
    if (ok) this.listen()
    return ok
  }

  session(): string {
    return this.client.session.save() as unknown as string
  }

  async sendCode(phone: string): Promise<void> {
    this.phone = phone
    const r = await this.client.sendCode({ apiId: this.keys.apiId, apiHash: this.keys.apiHash }, phone)
    this.codeHash = r.phoneCodeHash
  }

  async signIn(code: string): Promise<'ok' | 'password'> {
    try {
      const r = await this.client.invoke(
        new Api.auth.SignIn({ phoneNumber: this.phone, phoneCodeHash: this.codeHash, phoneCode: code }),
      )
      if (r instanceof Api.auth.AuthorizationSignUpRequired) throw { errorMessage: 'SIGNUP' }
      this.listen()
      return 'ok'
    } catch (e) {
      if ((e as { errorMessage?: string }).errorMessage === 'SESSION_PASSWORD_NEEDED') return 'password'
      throw e
    }
  }

  async checkPassword(password: string): Promise<void> {
    let last: unknown
    try {
      await this.client.signInWithPassword(
        { apiId: this.keys.apiId, apiHash: this.keys.apiHash },
        {
          password: async () => password,
          onError: async (e: Error) => {
            last = e
            return true
          },
        },
      )
    } catch (e) {
      throw last ?? e
    }
    this.listen()
  }

  // ───────── chats ─────────

  private chatOf(d: any): Chat {
    const e = d.entity as any
    const id = d.id.toString()
    this.entities.set(id, d.inputEntity ?? d.entity)
    const broadcast = !!e?.broadcast
    const last = d.message as Api.Message | undefined
    const raw = d.dialog as Api.Dialog | undefined
    const muteUntil = (raw?.notifySettings as any)?.muteUntil ?? 0
    return {
      id,
      title: d.title || d.name || '…',
      unread: d.unreadCount ?? 0,
      previewText: last?.message ?? '',
      previewMedia: last ? mediaKind(last) : undefined,
      previewOut: !!last?.out,
      previewId: last?.id ?? 0,
      date: last?.date ?? 0,
      kind: d.isUser ? 'user' : broadcast ? 'channel' : 'group',
      canWrite: !broadcast || !!e?.creator || !!e?.adminRights,
      pinned: !!d.pinned,
      muted: muteUntil > Math.floor(Date.now() / 1000),
      readInboxMaxId: raw?.readInboxMaxId ?? 0,
      readOutboxMaxId: raw?.readOutboxMaxId ?? 0,
      username: e?.username,
      presence: d.isUser ? presenceOf(e) : undefined,
      bot: !!e?.bot,
    }
  }

  async dialogs(): Promise<Chat[]> {
    const list = await this.client.getDialogs({ limit: 100 })
    return list.map((d) => this.chatOf(d))
  }

  private fromEntity(e: any): Chat | undefined {
    if (!(e instanceof Api.User || e instanceof Api.Chat || e instanceof Api.Channel)) return undefined
    const id = utils.getPeerId(e).toString()
    this.entities.set(id, e)
    const isUser = e instanceof Api.User
    const broadcast = !isUser && !!(e as Api.Channel).broadcast
    return {
      id,
      title: isUser ? [e.firstName, e.lastName].filter(Boolean).join(' ') || e.username || '…' : (e as any).title,
      unread: 0,
      previewText: '',
      previewOut: false,
      previewId: 0,
      date: 0,
      kind: isUser ? 'user' : broadcast ? 'channel' : 'group',
      canWrite: !broadcast,
      pinned: false,
      muted: false,
      readInboxMaxId: 0,
      readOutboxMaxId: 0,
      username: (e as any).username,
      presence: isUser ? presenceOf(e) : undefined,
      bot: isUser && !!e.bot,
    }
  }

  async resolve(username: string): Promise<Chat | undefined> {
    const name = username.replace(/^@/, '').trim()
    if (!/^[a-zA-Z][\w]{3,31}$/.test(name)) return undefined
    try {
      return this.fromEntity(await this.client.getEntity(name))
    } catch {
      return undefined
    }
  }

  async search(query: string): Promise<Chat[]> {
    const q = query.replace(/^@/, '').trim()
    if (q.length < 2) return []
    try {
      const r = await this.client.invoke(new Api.contacts.Search({ q, limit: 25 }))
      return [...r.users, ...r.chats].map((e) => this.fromEntity(e)).filter((c): c is Chat => !!c)
    } catch {
      return []
    }
  }

  async moreDialogs(): Promise<Chat[]> {
    const list = await this.client.getDialogs({ limit: 1000 })
    return list.map((d) => this.chatOf(d))
  }

  // ───────── messages ─────────

  private msgOf(chatId: string, m: Api.Message): Msg {
    this.messages.set(`${chatId}:${m.id}`, m)
    return {
      id: m.id,
      chatId,
      out: !!m.out,
      text: m.message ?? '',
      date: m.date,
      media: mediaKind(m),
      file: fileInfo(m),
      sender: senderName(m),
      edited: !!m.editDate,
      entities: entitiesOf(m),
    }
  }

  /** Builds messages and attaches a short preview of the message each one replies to. */
  private async build(chatId: string, list: Api.Message[]): Promise<Msg[]> {
    const known = new Map<number, Api.Message>(list.map((m) => [m.id, m]))
    const wanted = new Set<number>()
    for (const m of list) {
      const rid = (m.replyTo as any)?.replyToMsgId as number | undefined
      if (rid && !known.has(rid)) wanted.add(rid)
    }
    const entity = this.entities.get(chatId)
    if (wanted.size && entity) {
      try {
        const got = await this.client.getMessages(entity, { ids: [...wanted] })
        for (const g of got) if (g) known.set(g.id, g as Api.Message)
      } catch {
        /* previews are optional */
      }
    }
    return list.map((m) => {
      const msg = this.msgOf(chatId, m)
      const rid = (m.replyTo as any)?.replyToMsgId as number | undefined
      if (rid) {
        const r = known.get(rid)
        msg.replyTo = r ? { id: rid, text: r.message ?? '', sender: senderName(r), media: mediaKind(r) } : { id: rid, text: '' }
      }
      return msg
    })
  }

  async history(chatId: string, beforeId?: number): Promise<Msg[]> {
    const entity = this.entities.get(chatId)
    if (!entity) return []
    const list = await this.client.getMessages(entity, { limit: PAGE, offsetId: beforeId ?? 0 })
    return this.build(chatId, [...list].reverse() as Api.Message[])
  }

  async around(chatId: string, readMaxId: number): Promise<Msg[]> {
    const entity = this.entities.get(chatId)
    if (!entity) return []
    const list = await this.client.getMessages(entity, { limit: PAGE, offsetId: readMaxId, addOffset: -Math.floor(PAGE / 2) })
    return this.build(chatId, [...list].reverse() as Api.Message[])
  }

  async newer(chatId: string, afterId: number): Promise<Msg[]> {
    const entity = this.entities.get(chatId)
    if (!entity) return []
    const list = await this.client.getMessages(entity, { limit: PAGE, offsetId: afterId, reverse: true })
    return this.build(chatId, list as Api.Message[])
  }

  async send(chatId: string, text: string, replyTo?: number): Promise<Msg> {
    const entity = this.entities.get(chatId)
    if (!entity) throw new Error('no chat')
    const m = await this.client.sendMessage(entity, { message: text, replyTo })
    return (await this.build(chatId, [m]))[0]
  }

  async sendFile(chatId: string, file: File, caption: string, replyTo?: number): Promise<Msg> {
    const entity = this.entities.get(chatId)
    if (!entity) throw new Error('no chat')
    const buf = Buffer.from(await file.arrayBuffer())
    const m = await this.client.sendFile(entity, {
      file: new CustomFile(file.name, file.size, '', buf),
      caption,
      replyTo,
      forceDocument: !file.type.startsWith('image/'),
    })
    return (await this.build(chatId, [m]))[0]
  }

  async edit(chatId: string, id: number, text: string): Promise<Msg> {
    const entity = this.entities.get(chatId)
    if (!entity) throw new Error('no chat')
    const m = await this.client.editMessage(entity, { message: id, text })
    return (await this.build(chatId, [m]))[0]
  }

  async remove(chatId: string, ids: number[]): Promise<void> {
    const entity = this.entities.get(chatId)
    if (entity) await this.client.deleteMessages(entity, ids, { revoke: true })
  }

  async readUpTo(chatId: string, maxId: number): Promise<void> {
    const entity = this.entities.get(chatId)
    if (entity) await this.client.markAsRead(entity, undefined, { maxId })
  }

  async setTyping(chatId: string): Promise<void> {
    const entity = this.entities.get(chatId)
    if (!entity || Date.now() - this.lastTyping < 4000) return
    this.lastTyping = Date.now()
    try {
      await this.client.invoke(new Api.messages.SetTyping({ peer: entity, action: new Api.SendMessageTypingAction() }))
    } catch {
      /* typing hints are best effort */
    }
  }

  // ───────── media ─────────

  /** Downloads go through a small queue so a long chat does not open dozens at once. */
  private async slot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= 4) await new Promise<void>((r) => this.waiters.push(r))
    this.active++
    try {
      return await fn()
    } finally {
      this.active--
      this.waiters.shift()?.()
    }
  }

  async photo(chatId: string, msgId: number): Promise<string | undefined> {
    const key = `p:${chatId}:${msgId}`
    const hit = this.cache.get(key)
    if (hit) return hit
    const m = this.messages.get(`${chatId}:${msgId}`)
    if (!m) return undefined
    const url = await this.slot(async () => {
      for (const opts of [{ thumb: 2 }, {}] as const) {
        try {
          const u = blobUrl(await this.client.downloadMedia(m, opts as never))
          if (u) return u
        } catch {
          /* try the next size */
        }
      }
      return undefined
    })
    if (url) this.cache.set(key, url)
    return url
  }

  async media(chatId: string, msgId: number): Promise<{ url: string; mime: string } | undefined> {
    const m = this.messages.get(`${chatId}:${msgId}`)
    if (!m) return undefined
    const mime = docOf(m)?.mimeType ?? 'application/octet-stream'
    const key = `m:${chatId}:${msgId}`
    const hit = this.cache.get(key)
    if (hit) return { url: hit, mime }
    const url = await this.slot(async () => {
      try {
        return blobUrl(await this.client.downloadMedia(m, {}), mime)
      } catch {
        return undefined
      }
    })
    if (!url) return undefined
    this.cache.set(key, url)
    return { url, mime }
  }

  async avatar(chatId: string): Promise<string | undefined> {
    const entity = this.entities.get(chatId)
    if (!entity) return undefined
    return this.slot(async () => {
      try {
        return blobUrl(await this.client.downloadProfilePhoto(entity, { isBig: false }))
      } catch {
        return undefined
      }
    })
  }

  // ───────── live updates ─────────

  onMessage(cb: (m: Msg, chat?: Chat) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  onUpdate(cb: (u: Update) => void): () => void {
    this.updaters.add(cb)
    return () => this.updaters.delete(cb)
  }

  private emit(u: Update) {
    this.updaters.forEach((l) => l(u))
  }

  private listen() {
    if (this.started) return
    this.started = true

    this.client.addEventHandler(async (ev: NewMessageEvent) => {
      const id = ev.chatId?.toString()
      if (!id) return
      let chat: Chat | undefined
      if (!this.entities.has(id)) chat = (await this.dialogs()).find((c) => c.id === id)
      const [msg] = await this.build(id, [ev.message])
      this.listeners.forEach((l) => l(msg, chat))
    }, new NewMessage({}))

    this.client.addEventHandler(async (ev: any) => {
      const id = ev.chatId?.toString()
      if (!id || !ev.message) return
      const [msg] = await this.build(id, [ev.message])
      this.emit({ type: 'edit', msg })
    }, new EditedMessage({}))

    this.client.addEventHandler((ev: any) => {
      this.emit({ type: 'delete', chatId: ev.chatId?.toString(), ids: ev.deletedIds ?? [] })
    }, new DeletedMessage({}))

    this.client.addEventHandler((u: any) => {
      const peerId = (p: Api.TypePeer) => utils.getPeerId(p).toString()
      if (u instanceof Api.UpdateReadHistoryOutbox) {
        this.emit({ type: 'read-out', chatId: peerId(u.peer), maxId: u.maxId })
      } else if (u instanceof Api.UpdateUserTyping && u.action instanceof Api.SendMessageTypingAction) {
        this.emit({ type: 'typing', chatId: peerId(new Api.PeerUser({ userId: u.userId })) })
      } else if (u instanceof Api.UpdateChatUserTyping && u.action instanceof Api.SendMessageTypingAction) {
        this.emit({ type: 'typing', chatId: peerId(new Api.PeerChat({ chatId: u.chatId })) })
      } else if (u instanceof Api.UpdateChannelUserTyping && u.action instanceof Api.SendMessageTypingAction) {
        this.emit({ type: 'typing', chatId: peerId(new Api.PeerChannel({ channelId: u.channelId })) })
      } else if (u instanceof Api.UpdateUserStatus) {
        const presence = presenceOf({ status: u.status })
        if (presence) this.emit({ type: 'presence', chatId: peerId(new Api.PeerUser({ userId: u.userId })), presence })
      }
    }, new Raw({}))
  }

  async logout(): Promise<void> {
    try {
      await this.client.invoke(new Api.auth.LogOut())
    } catch {
      /* the local wipe still happens */
    }
    try {
      await this.client.disconnect()
    } catch {
      /* ignore */
    }
  }
}
