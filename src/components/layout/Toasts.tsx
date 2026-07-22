import { useNavigate } from 'react-router-dom'
import { useToastStore } from '../../stores/toastStore'
import { useUsersStore } from '../../stores/usersStore'
import { Avatar } from '../ui'

/**
 * Console-style notification bubbles: they slide in under the topbar, sit for
 * a few seconds, then leave. Click to jump to what they announce.
 */
export function Toasts() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  const users = useUsersStore((s) => s.users)
  const navigate = useNavigate()

  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed top-16 right-3 z-50 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2 sm:right-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => {
            if (t.to) navigate(t.to)
            dismiss(t.id)
          }}
          className={`toast-in pointer-events-auto flex items-center gap-3 rounded-lg border border-edge-2 bg-panel/95 p-3 shadow-2xl backdrop-blur transition hover:border-accent/60 ${
            t.to ? 'cursor-pointer' : ''
          }`}
        >
          {t.avatarUid ? (
            <Avatar user={users[t.avatarUid]} size="sm" />
          ) : (
            <span className="text-xl">{t.icon ?? '🔔'}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{t.title}</p>
            {t.body && <p className="truncate text-xs text-ink-dim">{t.body}</p>}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              dismiss(t.id)
            }}
            className="shrink-0 text-xs text-ink-dim transition hover:text-ink"
            aria-label="Fermer la notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
