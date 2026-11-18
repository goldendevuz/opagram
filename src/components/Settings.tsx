import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useI18n } from '../i18n'
import { LangSwitch } from './LangSwitch'

type Theme = 'light' | 'dark' | 'auto'

function currentTheme(): Theme {
  try {
    const v = localStorage.getItem('opagram.theme')
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return 'auto'
}

function applyTheme(t: Theme) {
  try {
    if (t === 'auto') localStorage.removeItem('opagram.theme')
    else localStorage.setItem('opagram.theme', t)
  } catch {
    /* ignore */
  }
  document.documentElement.dataset.theme = t === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t
}

export function Settings({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const { t } = useI18n()
  const [theme, setTheme] = useState<Theme>(currentTheme)
  const [confirm, setConfirm] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as Element).closest('.icon-btn')) onClose()
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      className="pop"
      initial={{ opacity: 0, y: -8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 460, damping: 28 }}
    >
      <h3>{t('settings')}</h3>
      <div className="setting">
        <span>{t('language')}</span>
        <LangSwitch />
      </div>
      <div className="setting">
        <span>{t('theme')}</span>
        <div className="seg">
          {(['light', 'dark', 'auto'] as Theme[]).map((x) => (
            <button
              key={x}
              className={x === theme ? 'on' : ''}
              onClick={() => {
                setTheme(x)
                applyTheme(x)
              }}
            >
              {t(`theme.${x}` as 'theme.light')}
            </button>
          ))}
        </div>
      </div>
      {!confirm ? (
        <button className="btn danger" onClick={() => setConfirm(true)}>
          {t('logout')}
        </button>
      ) : (
        <div className="confirm">
          <p>{t('logout.ask')}</p>
          <div className="row">
            <button className="btn ghost small" onClick={() => setConfirm(false)}>
              {t('cancel')}
            </button>
            <button className="btn danger small" onClick={onLogout}>
              {t('logout')}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
