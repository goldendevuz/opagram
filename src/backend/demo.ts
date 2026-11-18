import type { Backend, Chat, Msg, Presence, Update } from '../types'

// Offline sample data so the interface can be tried without a Telegram account
// (open the app with ?demo).

const now = Math.floor(Date.now() / 1000)
const min = 60
const hour = 3600

interface P {
  id: string
  title: string
  kind: Chat['kind']
  unread: number
  pinned?: boolean
  muted?: boolean
  canWrite?: boolean
  presence?: Presence
  username?: string
}

const people: P[] = [
  { id: '1', title: 'Dilnoza', kind: 'user', unread: 2, pinned: true, presence: { state: 'online' }, username: 'dilnoza' },
  { id: '2', title: 'Oila 🏡', kind: 'group', unread: 0, pinned: true },
  { id: '3', title: 'Jasur aka', kind: 'user', unread: 0, presence: { state: 'offline', ts: now - 2 * hour } },
  { id: '4', title: 'Лейла', kind: 'user', unread: 5, presence: { state: 'recently' } },
  { id: '5', title: 'Dars guruhi', kind: 'group', unread: 14, muted: true },
  { id: '6', title: 'Kun yangiliklari', kind: 'channel', unread: 3, canWrite: false },
  { id: '7', title: 'Sardor', kind: 'user', unread: 0, presence: { state: 'week' } },
  { id: '8', title: 'Nigora opa', kind: 'user', unread: 0, presence: { state: 'month' } },
]

type Seed = Partial<Msg> & { out: boolean; text: string; ago: number }

const seed: Record<string, Seed[]> = {
  '1': [
    { out: false, text: 'Assalomu alaykum! Ertaga uchrashamizmi?', ago: 3 * hour },
    { out: true, text: 'Va alaykum assalom. Ha, soat 10 da qulaymi?', ago: 3 * hour - 5 * min },
    { out: false, text: 'Mayli, qahvaxona oldida kutaman ☕', ago: 2 * hour },
    { out: false, text: 'Mana joyi', ago: 55 * min, media: 'photo' },
    { out: true, text: 'Zoʻr, rahmat! Hujjatni ham olib kelaman', ago: 50 * min, edited: true, replyTo: { id: 4, text: 'Mana joyi', sender: 'Dilnoza', media: 'photo' } },
    { out: false, text: 'Kechikmang, iltimos 🙂', ago: 12 * min },
    { out: false, text: 'Hujjat', ago: 10 * min, media: 'file', file: { name: 'shartnoma.pdf', size: 482113, mime: 'application/pdf' } },
  ],
  '2': [
    { out: false, text: 'Bugun kechqurun hammamiz yigʻilamiz', ago: 8 * hour, sender: 'Ona' },
    { out: true, text: 'Men olib boraman shirinlikni', ago: 7 * hour },
    { out: false, text: 'Rahmat, oʻgʻlim 🤍', ago: 6 * hour, sender: 'Ona' },
  ],
  '3': [
    { out: true, text: 'Aka, hujjatlar tayyor boʻldi', ago: 26 * hour },
    { out: false, text: 'Zoʻr, ertaga olib kelaman', ago: 25 * hour },
  ],
  '4': [
    { out: false, text: 'Привет! Ты видел новую версию?', ago: 40 * min },
    { out: false, text: 'Мне кажется, стало намного проще: https://opagram.univel.uz', ago: 38 * min },
    { out: false, text: '', ago: 20 * min, media: 'voice', file: { name: 'voice.ogg', size: 20000, mime: 'audio/ogg', duration: 14 } },
  ],
  '5': [
    { out: false, text: 'Ertangi dars 9:00 da boshlanadi', ago: 5 * hour, sender: 'Madina' },
    { out: false, text: 'Uy vazifasini yubordim', ago: 4 * hour, sender: 'Sherzod' },
  ],
  '6': [{ out: false, text: 'Bugungi asosiy yangiliklar: yangi yoʻl qurilishi boshlandi', ago: 2 * hour }],
  '7': [{ out: true, text: 'Rahmat, ertaga gaplashamiz', ago: 50 * hour }],
  '8': [{ out: true, text: 'Salom, yaxshimisiz?', ago: 75 * hour }],
}

const svgPhoto = (a: string, b: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="480" height="320" fill="url(#g)"/><circle cx="360" cy="90" r="46" fill="#fff" opacity=".55"/><path d="M0 320 L150 170 L250 260 L330 200 L480 320Z" fill="#000" opacity=".28"/></svg>`,
  )

export class DemoBackend implements Backend {
  private msgs = new Map<string, Msg[]>()
  private listeners = new Set<(m: Msg, chat?: Chat) => void>()
  private updaters = new Set<(u: Update) => void>()
  private nextId = 1000
  private readIn = new Map<string, number>()
  private readOut = new Map<string, number>()

  constructor() {
    let id = 1
    for (const [chatId, list] of Object.entries(seed)) {
      const msgs = list.map((s) => ({ id: id++, chatId, date: now - s.ago, ...s }) as Msg)
      this.msgs.set(chatId, msgs)
      const p = people.find((x) => x.id === chatId)!
      const incoming = msgs.filter((m) => !m.out)
      const firstUnread = p.unread > 0 ? incoming[Math.max(0, incoming.length - p.unread)]?.id ?? 0 : Infinity
      this.readIn.set(chatId, firstUnread === Infinity ? msgs.at(-1)!.id : firstUnread - 1)
      // the other person has read everything we sent, except the very last message of Dilnoza's chat
      const outs = msgs.filter((m) => m.out)
      this.readOut.set(chatId, chatId === '3' ? 0 : (outs.at(-1)?.id ?? 0))
    }
  }

  async sendCode() {}
  async signIn(): Promise<'ok'> {
    return 'ok'
  }
  async checkPassword() {}
  session() {
    return ''
  }

  private chat(p: P): Chat {
    const last = this.msgs.get(p.id)!.at(-1)!
    return {
      id: p.id,
      title: p.title,
      unread: p.unread,
      previewText: last.text,
      previewMedia: last.media,
      previewOut: last.out,
      previewId: last.id,
      date: last.date,
      kind: p.kind,
      canWrite: p.canWrite ?? true,
      pinned: !!p.pinned,
      muted: !!p.muted,
      readInboxMaxId: this.readIn.get(p.id) ?? 0,
      readOutboxMaxId: this.readOut.get(p.id) ?? 0,
      presence: p.presence,
      username: p.username,
    }
  }

  async dialogs(): Promise<Chat[]> {
    return people.map((p) => this.chat(p))
  }

  async resolve(username: string): Promise<Chat | undefined> {
    const p = people.find((x) => x.username === username.replace(/^@/, ''))
    return p ? this.chat(p) : undefined
  }

  async moreDialogs(): Promise<Chat[]> {
    return []
  }

  async search(): Promise<Chat[]> {
    return []
  }

  async history(chatId: string): Promise<Msg[]> {
    return [...(this.msgs.get(chatId) ?? [])]
  }

  private emit(u: Update) {
    this.updaters.forEach((l) => l(u))
  }

  async send(chatId: string, text: string, replyTo?: number): Promise<Msg> {
    const list = this.msgs.get(chatId)!
    const r = replyTo ? list.find((m) => m.id === replyTo) : undefined
    const m: Msg = {
      id: this.nextId++,
      chatId,
      out: true,
      text,
      date: Math.floor(Date.now() / 1000),
      replyTo: r ? { id: r.id, text: r.text, media: r.media, sender: r.out ? undefined : 'Dilnoza' } : undefined,
    }
    list.push(m)
    const person = people.find((p) => p.id === chatId)
    if (person?.kind === 'user') {
      setTimeout(() => this.emit({ type: 'typing', chatId }), 700)
      setTimeout(() => {
        this.readOut.set(chatId, m.id)
        this.emit({ type: 'read-out', chatId, maxId: m.id })
      }, 1200)
      setTimeout(() => {
        const reply: Msg = { id: this.nextId++, chatId, out: false, text: 'Mayli, tushundim 👍', date: Math.floor(Date.now() / 1000) }
        list.push(reply)
        this.listeners.forEach((l) => l(reply))
      }, 2600)
    }
    return m
  }

  async sendFile(chatId: string, file: File, caption: string): Promise<Msg> {
    const isImg = file.type.startsWith('image/')
    const m: Msg = {
      id: this.nextId++,
      chatId,
      out: true,
      text: caption,
      date: Math.floor(Date.now() / 1000),
      media: isImg ? 'photo' : 'file',
      file: { name: file.name, size: file.size, mime: file.type },
    }
    this.msgs.get(chatId)!.push(m)
    return m
  }

  async edit(chatId: string, id: number, text: string): Promise<Msg> {
    const m = this.msgs.get(chatId)!.find((x) => x.id === id)!
    m.text = text
    m.edited = true
    return { ...m }
  }

  async remove(chatId: string, ids: number[]) {
    this.msgs.set(
      chatId,
      this.msgs.get(chatId)!.filter((m) => !ids.includes(m.id)),
    )
  }

  async readUpTo(chatId: string, maxId: number) {
    this.readIn.set(chatId, Math.max(this.readIn.get(chatId) ?? 0, maxId))
    const p = people.find((x) => x.id === chatId)
    if (p) p.unread = this.msgs.get(chatId)!.filter((m) => !m.out && m.id > maxId).length
  }

  async setTyping() {}

  async photo(): Promise<string> {
    return svgPhoto('#FF8A3D', '#6C3DFF')
  }

  async media(): Promise<undefined> {
    return undefined
  }

  async avatar(): Promise<undefined> {
    return undefined
  }

  onMessage(cb: (m: Msg, chat?: Chat) => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  onUpdate(cb: (u: Update) => void) {
    this.updaters.add(cb)
    return () => this.updaters.delete(cb)
  }

  async logout() {}
}
