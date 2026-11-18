export type Kind = 'user' | 'group' | 'channel'
export type MediaKind = 'photo' | 'voice' | 'video' | 'sticker' | 'file' | 'other'

export interface Chat {
  id: string
  title: string
  unread: number
  previewText: string
  previewMedia?: MediaKind
  date: number
  kind: Kind
  canWrite: boolean
  pinned: boolean
}

export interface Msg {
  id: number
  chatId: string
  out: boolean
  text: string
  date: number
  media?: MediaKind
  sender?: string
}

export interface Backend {
  sendCode(phone: string): Promise<void>
  signIn(code: string): Promise<'ok' | 'password'>
  checkPassword(password: string): Promise<void>
  dialogs(): Promise<Chat[]>
  /** Oldest first. Pass beforeId to get the page before that message. */
  history(chatId: string, beforeId?: number): Promise<Msg[]>
  send(chatId: string, text: string): Promise<Msg>
  markRead(chatId: string): Promise<void>
  photo(chatId: string, msgId: number): Promise<string | undefined>
  avatar(chatId: string): Promise<string | undefined>
  onMessage(cb: (m: Msg, chat?: Chat) => void): () => void
  session(): string
  logout(): Promise<void>
}

export interface Keys {
  apiId: number
  apiHash: string
}
