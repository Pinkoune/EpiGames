import { useState, type FormEvent } from 'react'
import { backend } from '../../lib/backend'
import { useAuthStore } from '../../stores/authStore'
import { Logo } from '../Logo'
import { btnGhost, btnPrimary, inputCls } from '../ui'

type Tab = 'signin' | 'signup'

export function SignInScreen() {
  const { signInEmail, signUpEmail, signInGoogle, signInLocal, error, clearError } = useAuthStore()
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const localMode = backend.mode === 'local'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (localMode) await signInLocal(name)
      else if (tab === 'signin') await signInEmail(email, password)
      else await signUpEmail(email, password, name)
    } catch {
      // error is surfaced via the store
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bp-bg flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo size="lg" />
          <p className="mt-3 text-sm text-ink-dim">
            Les jeux du groupe. Un seul endroit.
          </p>
        </div>

        <div className="rounded-xl border border-edge bg-panel p-6">
          {localMode && (
            <p className="mb-4 rounded-md border border-amber-500/25 px-3 py-2 text-xs text-amber-400/90">
              Mode local — Firebase non configuré, les données restent dans ce
              navigateur.
            </p>
          )}

          {!localMode && (
            <div className="mb-5 grid grid-cols-2 border-b border-edge">
              {(['signin', 'signup'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t)
                    clearError()
                  }}
                  className={`border-b-2 pb-2 text-sm font-medium transition ${
                    tab === t
                      ? 'border-accent text-ink'
                      : 'border-transparent text-ink-dim hover:text-ink'
                  }`}
                >
                  {t === 'signin' ? 'Connexion' : 'Inscription'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {(localMode || tab === 'signup') && (
              <input
                className={inputCls}
                placeholder="Pseudo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={30}
              />
            )}
            {!localMode && (
              <>
                <input
                  className={inputCls}
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  className={inputCls}
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </>
            )}
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
              {localMode ? 'Entrer' : tab === 'signin' ? 'Se connecter' : 'Créer le compte'}
            </button>
          </form>

          {!localMode && (
            <button
              onClick={() => void signInGoogle().catch(() => undefined)}
              className={`${btnGhost} mt-3 w-full`}
            >
              Continuer avec Google
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
