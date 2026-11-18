import { TelegramClient, Api } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { NewMessage, type NewMessageEvent } from 'telegram/events'
import type { Backend, Chat, Keys, MediaKind, Msg } from '../types'

const PAGE = 40

function mediaKind(m: Api.Message): MediaKind | undefined {
  if (m.photo) return 'photo'
  const media = m.media
  if (!media) return undefined
  if (media instanceof Api.MessageMediaDocument && media.document instanceof Api.Document) {
    for (const a of media.document.attributes) {
      if (a instanceof Api.DocumentAttributeSticker) return 'sticker'
      if (a instanceof Api.DocumentAttributeAudio && a.voice) return 'voice'
      if (a instanceof Api.DocumentAttributeVideo) return 'video'
    }
    return 'file'
  }
  return 'other'
}

function blobUrl(buf: unknown, type = 'image/jpeg'): string | undefined {
  if (!buf || typeof buf === 'string') return undefined
  return URL.createObjectURL(new Blob([buf as BlobPart], { type }))
}

export class TelegramBackend implements Backend {
  private client: TelegramClient
  private keys: Keys
  private entities = new Map<string, Api.TypeEntityLike>()
  private messages = new Map<string, Api.Message>()
  private codeHash = ''
  private phone = ''
  private listeners = new Set<(m: Msg, chat?: Chat) => void>()
  private started = false

  constructor(keys: Keys, session = '') {
    this.keys = keys
    this.client = new TelegramClient(new StringSession(session), keys.apiId, keys.apiHash, {
      connectionRetries: 5,
      useWSS: true,
      appVersion: 'OpaGram 0.1',
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

  private chatOf(d: any): Chat {
    const e = d.entity as any
    const id = d.id.toString()
    this.entities.set(id, d.inputEntity ?? d.entity)
    const broadcast = !!e?.broadcast
    const last = d.message as Api.Message | undefined
    return {
      id,
      title: d.title || d.name || '…',
      unread: d.unreadCount ?? 0,
      previewText: last?.message ?? '',
      previewMedia: last ? mediaKind(last) : undefined,
      date: last?.date ?? 0,
      kind: d.isUser ? 'user' : broadcast ? 'channel' : 'group',
      canWrite: !broadcast || !!e?.creator || !!e?.adminRights,
      pinned: !!d.pinned,
    }
  }

  async dialogs(): Promise<Chat[]> {
    const list = await this.client.getDialogs({ limit: 80 })
    return list.map((d) => this.chatOf(d))
  }

  private msgOf(chatId: string, m: Api.Message): Msg {
    this.messages.set(`${chatId}:${m.id}`, m)
    const s = m.sender as any
    return {
      id: m.id,
      chatId,
      out: !!m.out,
      text: m.message ?? '',
      date: m.date,
      media: mediaKind(m),
      sender: s?.firstName ?? s?.title,
    }
  }

  async history(chatId: string, beforeId?: number): Promise<Msg[]> {
    const entity = this.entities.get(chatId)
    if (!entity) return []
    const list = await this.client.getMessages(entity, { limit: PAGE, offsetId: beforeId ?? 0 })
    return [...list].reverse().map((m) => this.msgOf(chatId, m as Api.Message))
  }

  async send(chatId: string, text: string): Promise<Msg> {
    const entity = this.entities.get(chatId)
    if (!entity) throw new Error('no chat')
    const m = await this.client.sendMessage(entity, { message: text })
    return this.msgOf(chatId, m)
  }

  async markRead(chatId: string): Promise<void> {
    const entity = this.entities.get(chatId)
    if (entity) await this.client.markAsRead(entity)
  }

  async photo(chatId: string, msgId: number): Promise<string | undefined> {
    const m = this.messages.get(`${chatId}:${msgId}`)
    if (!m) return undefined
    try {
      return blobUrl(await this.client.downloadMedia(m, { thumb: 2 }))
    } catch {
      try {
        return blobUrl(await this.client.downloadMedia(m, {}))
      } catch {
        return undefined
      }
    }
  }

  async avatar(chatId: string): Promise<string | undefined> {
    const entity = this.entities.get(chatId)
    if (!entity) return undefined
    try {
      return blobUrl(await this.client.downloadProfilePhoto(entity, { isBig: false }))
    } catch {
      return undefined
    }
  }

  onMessage(cb: (m: Msg, chat?: Chat) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private listen() {
    if (this.started) return
    this.started = true
    this.client.addEventHandler(async (ev: NewMessageEvent) => {
      const id = ev.chatId?.toString()
      if (!id) return
      if (!this.entities.has(id)) {
        // A chat we have not seen yet: refresh so it gets an entity.
        const chats = await this.dialogs()
        const chat = chats.find((c) => c.id === id)
        const msg = this.msgOf(id, ev.message)
        this.listeners.forEach((l) => l(msg, chat))
        return
      }
      const msg = this.msgOf(id, ev.message)
      this.listeners.forEach((l) => l(msg))
    }, new NewMessage({}))
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
