// Search that ignores the script: "leyla", "Лейла" and "Лэйла" all give the same key.
// Cyrillic is turned into Latin first, then spellings that differ between Uzbek and
// Russian conventions are folded together (kh/x/h, q/k, w/v, sh, ch, ya/yu/yo ...).

const CYR: Record<string, string> = {
  '\u0430': 'a',  // а
  '\u0431': 'b',  // б
  '\u0432': 'v',  // в
  '\u0433': 'g',  // г
  '\u0434': 'd',  // д
  '\u0435': 'e',  // е
  '\u0451': 'yo',  // ё
  '\u0436': 'j',  // ж
  '\u0437': 'z',  // з
  '\u0438': 'i',  // и
  '\u0439': 'y',  // й
  '\u043a': 'k',  // к
  '\u043b': 'l',  // л
  '\u043c': 'm',  // м
  '\u043d': 'n',  // н
  '\u043e': 'o',  // о
  '\u043f': 'p',  // п
  '\u0440': 'r',  // р
  '\u0441': 's',  // с
  '\u0442': 't',  // т
  '\u0443': 'u',  // у
  '\u0444': 'f',  // ф
  '\u0445': 'x',  // х
  '\u0446': 'ts',  // ц
  '\u0447': 'ch',  // ч
  '\u0448': 'sh',  // ш
  '\u0449': 'sh',  // щ
  '\u044a': '',  // ъ
  '\u044b': 'i',  // ы
  '\u044c': '',  // ь
  '\u044d': 'e',  // э
  '\u044e': 'yu',  // ю
  '\u044f': 'ya',  // я
  '\u045e': 'o',  // ў
  '\u049b': 'k',  // қ
  '\u0493': 'g',  // ғ
  '\u04b3': 'x',  // ҳ
  '\u04d9': 'a',  // ә
  '\u0456': 'i',  // і
  '\u0457': 'i',  // ї
  '\u0454': 'e',  // є
  '\u0491': 'g',  // ґ
}

const FOLD: [RegExp, string][] = [
  [/zh/g, 'j'],
  [/sh/g, '1'],
  [/ch/g, '2'],
  [/kh/g, 'x'],
  [/ts/g, 's'],
  [/yo/g, 'o'],
  [/yu/g, 'u'],
  [/ya/g, 'a'],
  [/ye/g, 'e'],
  [/ph/g, 'f'],
  [/ee/g, 'i'],
  [/oo/g, 'u'],
  [/w/g, 'v'],
  [/q/g, 'k'],
  [/h/g, 'x'],
  [/c/g, 'k'],
  [/y/g, 'i'],
]

export function searchKey(input: string): string {
  // Cyrillic first (while ў, й, ё are still single letters), then strip accents from Latin letters
  let s = Array.from(input.toLowerCase().normalize('NFC'), (ch) => CYR[ch] ?? ch).join('')
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  s = s.replace(/[\u02bb\u02bc\u2019\u2018`\u00b4'"\u201c\u201d\u00ab\u00bb]/g, '')
  for (const [re, to] of FOLD) s = s.replace(re, to)
  return s.replace(/[^\p{L}\p{N}@_ ]/gu, '').replace(/\s+/g, ' ').trim()
}

export function matches(haystack: string, needleKey: string): boolean {
  return !needleKey || searchKey(haystack).includes(needleKey)
}
