import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type Lang = 'uz' | 'ru' | 'en'
export const LANGS: Lang[] = ['uz', 'ru', 'en']

const uz = {
  tagline: 'Sodda. Tinch. Faqat yozishmalar.',
  'keys.title': 'Kalitlaringizni kiriting',
  'keys.help': 'my.telegram.org saytiga kiring va “API development tools” boʻlimidan oling. Bu bir martalik ish.',
  'keys.safe': 'Kalitlar faqat shu qurilmada, shifrlangan holda saqlanadi. Hech qayerga yuborilmaydi.',
  'keys.open': 'my.telegram.org ni ochish',
  'keys.next': 'Davom etish',
  'keys.bad': 'Kalitlar notoʻgʻri koʻrinadi. api_id — raqam, api_hash — 32 ta belgi.',
  'phone.title': 'Telefon raqamingiz',
  'phone.send': 'Kod yuborish',
  'code.title': 'Kodni kiriting',
  'code.hint': 'Kod Telegramga keldi',
  'code.verify': 'Kirish',
  'pw.title': 'Ikki bosqichli parol',
  'pw.hint': 'Telegramda oʻrnatgan parolingiz',
  back: 'Orqaga',
  chats: 'Chatlar',
  search: 'Chatlarni qidirish',
  all: 'Hammasi',
  unread: 'Oʻqilmagan',
  'empty.chats': 'Hali chat yoʻq',
  'empty.search': 'Hech narsa topilmadi',
  pick: 'Chatni tanlang',
  pickSub: 'Yozishmalar shu yerda chiqadi',
  write: 'Xabar yozing…',
  readonly: 'Bu yerda faqat oʻqish mumkin',
  settings: 'Sozlamalar',
  language: 'Til',
  theme: 'Mavzu',
  'theme.light': 'Kunduz',
  'theme.dark': 'Tun',
  'theme.auto': 'Avto',
  logout: 'Chiqish',
  'logout.ask': 'Chiqsangiz, kalitlar ham shu qurilmadan oʻchadi.',
  cancel: 'Bekor qilish',
  'kind.user': 'Shaxsiy chat',
  'kind.group': 'Guruh',
  'kind.channel': 'Kanal',
  'media.photo': 'Rasm',
  'media.voice': 'Ovozli xabar',
  'media.video': 'Video',
  'media.sticker': 'Stiker',
  'media.file': 'Fayl',
  'media.other': 'Xabar',
  'media.hint': 'Buni asosiy Telegramda oching',
  today: 'Bugun',
  yesterday: 'Kecha',
  connecting: 'Ulanmoqda…',
  retry: 'Qayta urinish',
  earlier: 'Oldingi xabarlar',
  you: 'Siz',
  'err.PHONE_NUMBER_INVALID': 'Raqam notoʻgʻri',
  'err.PHONE_CODE_INVALID': 'Kod notoʻgʻri',
  'err.PHONE_CODE_EXPIRED': 'Kod eskirgan, qaytadan yuboring',
  'err.PASSWORD_HASH_INVALID': 'Parol notoʻgʻri',
  'err.API_ID_INVALID': 'Kalitlar notoʻgʻri. Ularni qaytadan kiriting',
  'err.FLOOD': 'Juda koʻp urinish. Birozdan soʻng urining',
  'err.signup': 'Bu raqam Telegramda roʻyxatdan oʻtmagan',
  'err.generic': 'Xatolik yuz berdi',
  'err.network': 'Internetga ulanib boʻlmadi',
  'reply': 'Javob berish',
  'copy': 'Nusxalash',
  'edit': 'Tahrirlash',
  'delete': 'Oʻchirish',
  'delete.ask': 'Xabar hamma uchun oʻchiriladi. Davom etasizmi?',
  'editing': 'Tahrirlash',
  'replying': 'Javob',
  'attach': 'Fayl biriktirish',
  'emoji': 'Emoji',
  'send': 'Yuborish',
  'edited': 'tahrirlangan',
  'online': 'onlayn',
  'seen.recently': 'yaqinda onlayn edi',
  'seen.week': 'bir hafta ichida onlayn edi',
  'seen.month': 'bir oy ichida onlayn edi',
  'seen.at': 'oxirgi marta {x}',
  'typing': 'yozmoqda…',
  'newMessages': 'Yangi xabarlar',
  'find': 'Topish: @{x}',
  'copied': 'Nusxalandi',
  'download': 'Yuklab olish',
  'loading': 'Yuklanmoqda…',
  'notify': 'Bildirishnomalar',
  'notify.on': 'Yoqilgan',
  'notify.off': 'Oʻchiq',
  'notify.denied': 'Brauzer ruxsat bermadi',
  'bot': 'bot',
  'deleted': 'Xabar oʻchirilgan',
}

type Dict = typeof uz

const ru: Dict = {
  tagline: 'Просто. Спокойно. Только переписка.',
  'keys.title': 'Введите свои ключи',
  'keys.help': 'Зайдите на my.telegram.org и возьмите их в разделе «API development tools». Это делается один раз.',
  'keys.safe': 'Ключи хранятся только на этом устройстве в зашифрованном виде и никуда не отправляются.',
  'keys.open': 'Открыть my.telegram.org',
  'keys.next': 'Продолжить',
  'keys.bad': 'Ключи выглядят неверно. api_id — число, api_hash — 32 символа.',
  'phone.title': 'Ваш номер телефона',
  'phone.send': 'Отправить код',
  'code.title': 'Введите код',
  'code.hint': 'Код пришёл в Telegram',
  'code.verify': 'Войти',
  'pw.title': 'Облачный пароль',
  'pw.hint': 'Пароль, который вы задали в Telegram',
  back: 'Назад',
  chats: 'Чаты',
  search: 'Поиск по чатам',
  all: 'Все',
  unread: 'Непрочитанные',
  'empty.chats': 'Чатов пока нет',
  'empty.search': 'Ничего не найдено',
  pick: 'Выберите чат',
  pickSub: 'Переписка появится здесь',
  write: 'Напишите сообщение…',
  readonly: 'Здесь можно только читать',
  settings: 'Настройки',
  language: 'Язык',
  theme: 'Тема',
  'theme.light': 'День',
  'theme.dark': 'Ночь',
  'theme.auto': 'Авто',
  logout: 'Выйти',
  'logout.ask': 'После выхода ключи тоже удалятся с этого устройства.',
  cancel: 'Отмена',
  'kind.user': 'Личный чат',
  'kind.group': 'Группа',
  'kind.channel': 'Канал',
  'media.photo': 'Фото',
  'media.voice': 'Голосовое',
  'media.video': 'Видео',
  'media.sticker': 'Стикер',
  'media.file': 'Файл',
  'media.other': 'Сообщение',
  'media.hint': 'Откройте это в основном Telegram',
  today: 'Сегодня',
  yesterday: 'Вчера',
  connecting: 'Подключение…',
  retry: 'Повторить',
  earlier: 'Более ранние',
  you: 'Вы',
  'err.PHONE_NUMBER_INVALID': 'Неверный номер',
  'err.PHONE_CODE_INVALID': 'Неверный код',
  'err.PHONE_CODE_EXPIRED': 'Код устарел, отправьте заново',
  'err.PASSWORD_HASH_INVALID': 'Неверный пароль',
  'err.API_ID_INVALID': 'Неверные ключи. Введите их заново',
  'err.FLOOD': 'Слишком много попыток. Попробуйте позже',
  'err.signup': 'Этот номер не зарегистрирован в Telegram',
  'err.generic': 'Произошла ошибка',
  'err.network': 'Не удалось подключиться к интернету',
  'reply': 'Ответить',
  'copy': 'Копировать',
  'edit': 'Изменить',
  'delete': 'Удалить',
  'delete.ask': 'Сообщение удалится у всех. Продолжить?',
  'editing': 'Изменение',
  'replying': 'Ответ',
  'attach': 'Прикрепить файл',
  'emoji': 'Эмодзи',
  'send': 'Отправить',
  'edited': 'изменено',
  'online': 'в сети',
  'seen.recently': 'был(а) недавно',
  'seen.week': 'был(а) на этой неделе',
  'seen.month': 'был(а) в этом месяце',
  'seen.at': 'был(а) {x}',
  'typing': 'печатает…',
  'newMessages': 'Новые сообщения',
  'find': 'Найти: @{x}',
  'copied': 'Скопировано',
  'download': 'Скачать',
  'loading': 'Загрузка…',
  'notify': 'Уведомления',
  'notify.on': 'Включены',
  'notify.off': 'Выключены',
  'notify.denied': 'Браузер не разрешил',
  'bot': 'бот',
  'deleted': 'Сообщение удалено',
}

const en: Dict = {
  tagline: 'Simple. Calm. Just conversations.',
  'keys.title': 'Enter your keys',
  'keys.help': 'Go to my.telegram.org and get them from “API development tools”. You only do this once.',
  'keys.safe': 'Keys are stored only on this device, encrypted. They are never sent anywhere.',
  'keys.open': 'Open my.telegram.org',
  'keys.next': 'Continue',
  'keys.bad': 'The keys look wrong. api_id is a number, api_hash is 32 characters.',
  'phone.title': 'Your phone number',
  'phone.send': 'Send code',
  'code.title': 'Enter the code',
  'code.hint': 'The code arrived in Telegram',
  'code.verify': 'Sign in',
  'pw.title': 'Two-step password',
  'pw.hint': 'The password you set in Telegram',
  back: 'Back',
  chats: 'Chats',
  search: 'Search chats',
  all: 'All',
  unread: 'Unread',
  'empty.chats': 'No chats yet',
  'empty.search': 'Nothing found',
  pick: 'Pick a chat',
  pickSub: 'Your conversation shows up here',
  write: 'Write a message…',
  readonly: 'Read only here',
  settings: 'Settings',
  language: 'Language',
  theme: 'Theme',
  'theme.light': 'Day',
  'theme.dark': 'Night',
  'theme.auto': 'Auto',
  logout: 'Log out',
  'logout.ask': 'Logging out also removes the keys from this device.',
  cancel: 'Cancel',
  'kind.user': 'Private chat',
  'kind.group': 'Group',
  'kind.channel': 'Channel',
  'media.photo': 'Photo',
  'media.voice': 'Voice message',
  'media.video': 'Video',
  'media.sticker': 'Sticker',
  'media.file': 'File',
  'media.other': 'Message',
  'media.hint': 'Open this in the main Telegram',
  today: 'Today',
  yesterday: 'Yesterday',
  connecting: 'Connecting…',
  retry: 'Try again',
  earlier: 'Earlier messages',
  you: 'You',
  'err.PHONE_NUMBER_INVALID': 'The number is not valid',
  'err.PHONE_CODE_INVALID': 'The code is wrong',
  'err.PHONE_CODE_EXPIRED': 'The code expired, send it again',
  'err.PASSWORD_HASH_INVALID': 'The password is wrong',
  'err.API_ID_INVALID': 'The keys are wrong. Enter them again',
  'err.FLOOD': 'Too many attempts. Try again in a while',
  'err.signup': 'This number is not registered in Telegram',
  'err.generic': 'Something went wrong',
  'err.network': 'Could not reach the internet',
  'reply': 'Reply',
  'copy': 'Copy',
  'edit': 'Edit',
  'delete': 'Delete',
  'delete.ask': 'The message will be deleted for everyone. Continue?',
  'editing': 'Editing',
  'replying': 'Reply',
  'attach': 'Attach a file',
  'emoji': 'Emoji',
  'send': 'Send',
  'edited': 'edited',
  'online': 'online',
  'seen.recently': 'last seen recently',
  'seen.week': 'last seen within a week',
  'seen.month': 'last seen within a month',
  'seen.at': 'last seen {x}',
  'typing': 'typing…',
  'newMessages': 'New messages',
  'find': 'Find: @{x}',
  'copied': 'Copied',
  'download': 'Download',
  'loading': 'Loading…',
  'notify': 'Notifications',
  'notify.on': 'On',
  'notify.off': 'Off',
  'notify.denied': 'The browser did not allow it',
  'bot': 'bot',
  'deleted': 'Message deleted',
}

const DICTS: Record<Lang, Dict> = { uz, ru, en }
export type Key = keyof Dict

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (k: Key, vars?: Record<string, string | number>) => string
  locale: string
  err: (e: unknown) => string
}

const I18n = createContext<Ctx>(null as unknown as Ctx)

function initial(): Lang {
  try {
    const saved = localStorage.getItem('opagram.lang') as Lang | null
    if (saved && LANGS.includes(saved)) return saved
  } catch {
    /* ignore */
  }
  return 'uz'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, set] = useState<Lang>(initial)
  const setLang = useCallback((l: Lang) => {
    set(l)
    try {
      localStorage.setItem('opagram.lang', l)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l
  }, [])
  const t = useCallback(
    (k: Key, vars?: Record<string, string | number>) => {
      let text: string = DICTS[lang][k] ?? uz[k]
      if (vars) for (const [name, v] of Object.entries(vars)) text = text.replace(`{${name}}`, String(v))
      return text
    },
    [lang],
  )
  const err = useCallback(
    (e: unknown) => {
      const msg = String((e as { errorMessage?: string; message?: string })?.errorMessage ?? (e as Error)?.message ?? '')
      if (msg.startsWith('FLOOD')) return t('err.FLOOD')
      if (msg === 'SIGNUP') return t('err.signup')
      if (msg === 'keys.bad') return t('keys.bad')
      if (/network|timeout|connection/i.test(msg)) return t('err.network')
      const k = `err.${msg}` as Key
      return DICTS[lang][k] ?? `${t('err.generic')}${msg ? ` (${msg.slice(0, 80)})` : ''}`
    },
    [t, lang],
  )
  return (
    <I18n.Provider value={{ lang, setLang, t, locale: lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-GB', err }}>
      {children}
    </I18n.Provider>
  )
}

export const useI18n = () => useContext(I18n)
