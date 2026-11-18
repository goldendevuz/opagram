import type { Backend, Chat, Msg } from '../types'

// Offline sample data so the interface can be tried without a Telegram account
// (open the app with ?demo).

const now = Math.floor(Date.now() / 1000)
const min = 60
const hour = 3600

const people: { id: string; title: string; kind: Chat['kind']; unread: number; pinned?: boolean; canWrite?: boolean }[] = [
  { id: '1', title: 'Dilnoza', kind: 'user', unread: 2, pinned: true },
  { id: '2', title: 'Oila 🏡', kind: 'group', unread: 0, pinned: true },
  { id: '3', title: 'Jasur aka', kind: 'user', unread: 0 },
  { id: '4', title: 'Лейла', kind: 'user', unread: 5 },
  { id: '5', title: 'Dars guruhi', kind: 'group', unread: 14 },
  { id: '6', title: 'Kun yangiliklari', kind: 'channel', unread: 3, canWrite: false },
  { id: '7', title: 'Sardor', kind: 'user', unread: 0 },
  { id: '8', title: 'Nigora opa', kind: 'user', unread: 0 },
]

const seed: Record<string, [boolean, string, number, Msg['media']?, string?][]> = {
  '1': [
    [false, 'Assalomu alaykum! Ertaga uchrashamizmi?', 3 * hour],
    [true, 'Va alaykum assalom. Ha, soat 10 da qulaymi?', 3 * hour - 5 * min],
    [false, 'Mayli, qahvaxona oldida kutaman ☕', 2 * hour],
    [false, 'Mana joyi', 55 * min, 'photo'],
    [false, 'Kechikmang, iltimos 🙂', 52 * min],
  ],
  '2': [
    [false, 'Bugun kechqurun hammamiz yigʻilamiz', 8 * hour, undefined, 'Ona'],
    [true, 'Men olib boraman shirinlikni', 7 * hour],
    [false, 'Rahmat, oʻgʻlim 🤍', 6 * hour, undefined, 'Ona'],
  ],
  '3': [[true, 'Aka, hujjatlar tayyor boʻldi', 26 * hour], [false, 'Zoʻr, ertaga olib kelaman', 25 * hour]],
  '4': [
    [false, 'Привет! Ты видел новую версию?', 40 * min],
    [false, 'Мне кажется, стало намного проще', 38 * min],
    [false, 'Голосовое', 20 * min, 'voice'],
  ],
  '5': [
    [false, 'Ertangi dars 9:00 da boshlanadi', 5 * hour, undefined, 'Madina'],
    [false, 'Uy vazifasini yubordim', 4 * hour, undefined, 'Sherzod'],
  ],
  '6': [[false, 'Bugungi asosiy yangiliklar: yangi yoʻl qurilishi boshlandi', 2 * hour]],
  '7': [[true, 'Rahmat, ertaga gaplashamiz', 50 * hour]],
  '8': [[false, 'Salom, yaxshimisiz?', 75 * hour]],
}

const svgPhoto = (a: string, b: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="480" height="320" fill="url(#g)"/><circle cx="360" cy="90" r="46" fill="#fff" opacity=".55"/><path d="M0 320 L150 170 L250 260 L330 200 L480 320Z" fill="#000" opacity=".28"/></svg>`,
  )

export class DemoBackend implements Backend {
  private msgs = new Map<string, Msg[]>()
  private listeners = new Set<(m: Msg, chat?: Chat) => void>()
  private nextId = 1000

  constructor() {
    let id = 1
    for (const [chatId, list] of Object.entries(seed)) {
      this.msgs.set(
        chatId,
        list.map(([out, text, ago, media, sender]) => ({ id: id++, chatId, out, text, date: now - ago, media, sender })),
      )
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

  async dialogs(): Promise<Chat[]> {
    return people.map((p) => {
      const last = this.msgs.get(p.id)!.at(-1)!
      return {
        id: p.id,
        title: p.title,
        unread: p.unread,
        previewText: last.text,
        previewMedia: last.media,
        date: last.date,
        kind: p.kind,
        canWrite: p.canWrite ?? true,
        pinned: !!p.pinned,
      }
    })
  }

  async history(chatId: string): Promise<Msg[]> {
    return [...(this.msgs.get(chatId) ?? [])]
  }

  async send(chatId: string, text: string): Promise<Msg> {
    const m: Msg = { id: this.nextId++, chatId, out: true, text, date: Math.floor(Date.now() / 1000) }
    this.msgs.get(chatId)!.push(m)
    const person = people.find((p) => p.id === chatId)
    if (person?.kind === 'user') {
      setTimeout(() => {
        const reply: Msg = {
          id: this.nextId++,
          chatId,
          out: false,
          text: 'Mayli, tushundim 👍',
          date: Math.floor(Date.now() / 1000),
        }
        this.msgs.get(chatId)!.push(reply)
        this.listeners.forEach((l) => l(reply))
      }, 1600)
    }
    return m
  }

  async markRead(chatId: string) {
    const p = people.find((x) => x.id === chatId)
    if (p) p.unread = 0
  }

  async photo(): Promise<string> {
    return svgPhoto('#FF8A3D', '#6C3DFF')
  }

  async avatar(): Promise<undefined> {
    return undefined
  }

  onMessage(cb: (m: Msg, chat?: Chat) => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  async logout() {}
}
