export type Kind = 'user' | 'group' | 'channel'
export type MediaKind = 'photo' | 'voice' | 'video' | 'sticker' | 'file' | 'other'

export interface Ent {
  type: 'bold' | 'italic' | 'code' | 'pre' | 'strike' | 'underline' | 'spoiler' | 'link' | 'mention'
  offset: number
  length: number
  url?: string
}

export interface Presence {
  state: 'online' | 'offline' | 'recently' | 'week' | 'month' | 'unknown'
  ts?: number
}

export interface Chat {
  id: string
  title: string
  unread: number
  previewText: string
  previewMedia?: MediaKind
  previewOut: boolean
  previewId: number
  date: number
  kind: Kind
  canWrite: boolean
  pinned: boolean
  muted: boolean
  readInboxMaxId: number
  readOutboxMaxId: number
  username?: string
  presence?: Presence
  bot?: boolean
  /** Telegram's profile colour index (0-6), used when there is no photo. */
  colorId?: number
}

export interface Reply {
  id: number
  text: string
  sender?: string
  media?: MediaKind
}

export interface FileInfo {
  name: string
  size: number
  mime: string
  duration?: number
  emoji?: string
}

export interface Msg {
  id: number
  chatId: string
  out: boolean
  text: string
  date: number
  media?: MediaKind
  file?: FileInfo
  sender?: string
  replyTo?: Reply
  edited?: boolean
  entities?: Ent[]
  pending?: boolean
}

export type Update =
  | { type: 'read-out'; chatId: string; maxId: number }
  | { type: 'edit'; msg: Msg }
  | { type: 'delete'; chatId?: string; ids: number[] }
  | { type: 'typing'; chatId: string; who?: string }
  | { type: 'presence'; chatId: string; presence: Presence }

export interface Backend {
  sendCode(phone: string): Promise<void>
  signIn(code: string): Promise<'ok' | 'password'>
  checkPassword(password: string): Promise<void>
  dialogs(): Promise<Chat[]>
  /** Oldest first. Pass beforeId to get the page before that message. */
  history(chatId: string, beforeId?: number): Promise<Msg[]>
  /** Messages around the first unread one, oldest first (used when many are unread). */
  around(chatId: string, readMaxId: number): Promise<Msg[]>
  /** The page after afterId, oldest first. */
  newer(chatId: string, afterId: number): Promise<Msg[]>
  send(chatId: string, text: string, replyTo?: number): Promise<Msg>
  sendFile(chatId: string, file: File, caption: string, replyTo?: number): Promise<Msg>
  edit(chatId: string, id: number, text: string): Promise<Msg>
  remove(chatId: string, ids: number[]): Promise<void>
  readUpTo(chatId: string, maxId: number): Promise<void>
  setTyping(chatId: string): Promise<void>
  resolve(username: string): Promise<Chat | undefined>
  /** Everything beyond the first page of chats (can be large). */
  moreDialogs(): Promise<Chat[]>
  /** People, groups and channels found on Telegram by name or @username. */
  search(query: string): Promise<Chat[]>
  photo(chatId: string, msgId: number): Promise<string | undefined>
  media(chatId: string, msgId: number): Promise<{ url: string; mime: string } | undefined>
  avatar(chatId: string): Promise<string | undefined>
  /** Why the last download failed, for showing next to the retry button. */
  lastError(): string
  onMessage(cb: (m: Msg, chat?: Chat) => void): () => void
  onUpdate(cb: (u: Update) => void): () => void
  session(): string
  logout(): Promise<void>
}

export interface Keys {
  apiId: number
  apiHash: string
}
