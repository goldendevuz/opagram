import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Backend, Keys } from './types'
import { loadSecrets, saveSecrets, wipeSecrets } from './secure'
import { TelegramBackend } from './backend/telegram'
import { DemoBackend } from './backend/demo'
import { useI18n } from './i18n'
import { Auth, type Step } from './screens/Auth'
import { Messenger } from './screens/Messenger'
import { Aurora } from './components/Aurora'

type Stage = 'boot' | Step | 'app'

export function App() {
  const { t, err } = useI18n()
  const [stage, setStage] = useState<Stage>('boot')
  const [backend, setBackend] = useState<Backend | null>(null)
  const [keys, setKeys] = useState<Keys | null>(null)
  const [bootError, setBootError] = useState('')

  const boot = useCallback(async () => {
    setBootError('')
    if (new URLSearchParams(location.search).has('demo')) {
      setBackend(new DemoBackend())
      setStage('app')
      return
    }
    const s = await loadSecrets()
    if (!s) return setStage('keys')
    setKeys({ apiId: s.apiId, apiHash: s.apiHash })
    const b = new TelegramBackend({ apiId: s.apiId, apiHash: s.apiHash }, s.session)
    try {
      const ok = await b.connect()
      setBackend(b)
      setStage(ok ? 'app' : 'phone')
    } catch (e) {
      setBootError(err(e))
    }
  }, [err])

  useEffect(() => {
    boot()
  }, [boot])

  const submitKeys = async (k: Keys) => {
    const b = new TelegramBackend(k)
    await b.connect()
    await saveSecrets({ ...k, session: '' })
    setKeys(k)
    setBackend(b)
    setStage('phone')
  }

  const signedIn = async () => {
    if (backend && keys) await saveSecrets({ ...keys, session: backend.session() })
    setStage('app')
  }

  const logout = async () => {
    await backend?.logout()
    await wipeSecrets()
    setBackend(null)
    setKeys(null)
    setStage('keys')
  }

  return (
    <>
      <Aurora />
      <AnimatePresence mode="wait">
        {stage === 'boot' && (
          <motion.div key="boot" className="boot" exit={{ opacity: 0 }}>
            <div className="boot-dots">
              <i />
              <i />
              <i />
            </div>
            <p>{bootError || t('connecting')}</p>
            {bootError && (
              <button className="btn" onClick={boot}>
                {t('retry')}
              </button>
            )}
          </motion.div>
        )}
        {(stage === 'keys' || stage === 'phone' || stage === 'code' || stage === 'password') && (
          <Auth
            key="auth"
            step={stage}
            setStep={setStage}
            backend={backend}
            onKeys={submitKeys}
            onDone={signedIn}
          />
        )}
        {stage === 'app' && backend && <Messenger key="app" backend={backend} onLogout={logout} />}
      </AnimatePresence>
    </>
  )
}
