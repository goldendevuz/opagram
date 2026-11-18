import { useState, type FormEvent, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import type { Backend, Keys } from '../types'
import { useI18n, type Key } from '../i18n'
import { Wordmark } from '../components/Wordmark'
import { LangSwitch } from '../components/LangSwitch'

export type Step = 'keys' | 'phone' | 'code' | 'password'
const ORDER: Step[] = ['keys', 'phone', 'code', 'password']

interface Props {
  step: Step
  setStep: (s: Step) => void
  backend: Backend | null
  onKeys: (k: Keys) => Promise<void>
  onDone: () => Promise<void>
}

export function Auth({ step, setStep, backend, onKeys, onDone }: Props) {
  const { t, err } = useI18n()
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phone, setPhone] = useState('+998')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // The card leans toward the pointer, a little like a physical card on a desk.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const rx = useSpring(useTransform(py, [-1, 1], [7, -7]), { stiffness: 120, damping: 14 })
  const ry = useSpring(useTransform(px, [-1, 1], [-9, 9]), { stiffness: 120, damping: 14 })

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      console.error('[opagram]', e)
      setError(err(e))
      if ((e as { errorMessage?: string }).errorMessage === 'API_ID_INVALID') setStep('keys')
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (step === 'keys')
      return run(async () => {
        const id = Number(apiId.trim())
        const hash = apiHash.trim()
        if (!Number.isInteger(id) || id <= 0 || !/^[0-9a-fA-F]{32}$/.test(hash)) throw new Error('keys.bad')
        await onKeys({ apiId: id, apiHash: hash })
      }).then(() => undefined)
    if (step === 'phone')
      return run(async () => {
        await backend!.sendCode(phone.replace(/[\s()-]/g, ''))
        setStep('code')
      })
    if (step === 'code')
      return run(async () => {
        const r = await backend!.signIn(code.replace(/\D/g, ''))
        if (r === 'password') setStep('password')
        else await onDone()
      })
    return run(async () => {
      await backend!.checkPassword(pw)
      await onDone()
    })
  }

  const title: Key = step === 'keys' ? 'keys.title' : step === 'phone' ? 'phone.title' : step === 'code' ? 'code.title' : 'pw.title'
  const cta: Key = step === 'keys' ? 'keys.next' : step === 'phone' ? 'phone.send' : 'code.verify'
  const shownError = error

  return (
    <motion.main
      className="auth"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      onPointerMove={(e) => {
        px.set((e.clientX / window.innerWidth) * 2 - 1)
        py.set((e.clientY / window.innerHeight) * 2 - 1)
      }}
    >
      <div className="auth-top">
        <LangSwitch />
      </div>

      <div className="floaters" aria-hidden>
        <i className="fl f1" />
        <i className="fl f2" />
        <i className="fl f3" />
      </div>

      <motion.section className="card" style={{ rotateX: rx, rotateY: ry }}>
        <motion.div
          className="brand"
          initial={{ y: -14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 16 }}
        >
          <Wordmark size="lg" />
          <p>{t('tagline')}</p>
        </motion.div>

        <div className="dots">
          {ORDER.map((s, i) => (
            <i key={s} className={i <= ORDER.indexOf(step) ? 'on' : ''} />
          ))}
        </div>

        <motion.form
          key={step}
          onSubmit={submit}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          <h2>{t(title)}</h2>

          {step === 'keys' && (
            <>
              <p className="help">{t('keys.help')}</p>
              <Field label="api_id">
                <input inputMode="numeric" autoComplete="off" value={apiId} onChange={(e) => setApiId(e.target.value)} placeholder="12345678" autoFocus />
              </Field>
              <Field label="api_hash">
                <input autoComplete="off" spellCheck={false} value={apiHash} onChange={(e) => setApiHash(e.target.value)} placeholder="0123456789abcdef0123456789abcdef" />
              </Field>
              <p className="safe">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                  <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Zm-1 14-4-4 1.4-1.4L11 13.2l4.6-4.6L17 10l-6 6Z" fill="currentColor" />
                </svg>
                {t('keys.safe')}
              </p>
              <a className="link" href="https://my.telegram.org/apps" target="_blank" rel="noreferrer">
                {t('keys.open')} ↗
              </a>
            </>
          )}

          {step === 'phone' && (
            <Field label="+998 90 123 45 67">
              <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
            </Field>
          )}

          {step === 'code' && (
            <>
              <p className="help">{t('code.hint')}</p>
              <Field label="• • • • •">
                <input className="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
              </Field>
            </>
          )}

          {step === 'password' && (
            <>
              <p className="help">{t('pw.hint')}</p>
              <Field label="••••••••">
                <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
              </Field>
            </>
          )}

          {shownError && (
            <motion.p className="error" initial={{ x: -8 }} animate={{ x: [0, -8, 8, -5, 5, 0] }} transition={{ duration: 0.4 }} key={shownError}>
              {shownError}
            </motion.p>
          )}

          <motion.button className="btn primary" disabled={busy} whileTap={{ scale: 0.96 }}>
            {busy ? <span className="spin" /> : t(cta)}
          </motion.button>

          {step !== 'keys' && step !== 'phone' && (
            <button type="button" className="btn ghost" onClick={() => setStep(step === 'code' ? 'phone' : 'code')}>
              {t('back')}
            </button>
          )}
        </motion.form>
      </motion.section>
    </motion.main>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}
