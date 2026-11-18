import { createRoot } from 'react-dom/client'
import '@fontsource-variable/onest'
import '@fontsource-variable/unbounded'
import './styles.css'
import { I18nProvider } from './i18n'
import { App } from './App'

try {
  const theme = localStorage.getItem('opagram.theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
  else document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
} catch {
  /* default theme stays */
}

// the browser's own right-click menu makes the app feel like a web page; keep it only for text fields and message text
document.addEventListener('contextmenu', (e) => {
  if (!(e.target as Element).closest('input, textarea, .text')) e.preventDefault()
})

// in the desktop app, links in messages open in the normal browser instead of inside the app window
if ('__TAURI_INTERNALS__' in window) {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="http"]')
    if (!a) return
    e.preventDefault()
    import('@tauri-apps/plugin-opener').then((m) => m.openUrl(a.href))
  })
}

createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
)
