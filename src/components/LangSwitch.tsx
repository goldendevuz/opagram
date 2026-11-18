import { LANGS, useI18n } from '../i18n'

export function LangSwitch() {
  const { lang, setLang } = useI18n()
  return (
    <div className="seg" role="group">
      {LANGS.map((l) => (
        <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
