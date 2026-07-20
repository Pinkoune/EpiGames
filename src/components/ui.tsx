import type { ReactNode } from 'react'
import type { GameStatus, RequestStatus, UserProfile } from '../lib/types'
import { GAME_STATUS_LABELS, REQUEST_STATUS_LABELS } from '../lib/types'

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto border border-edge bg-panel p-6 shadow-2xl ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        } rounded-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="px-2 py-1 text-ink-dim transition hover:text-ink"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Clean download glyph (tray + arrow) — replaces the clunky ⬇ emoji. */
export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block h-[1em] w-[1em] align-[-0.125em] ${className ?? ''}`}
      aria-hidden
    >
      <path d="M8 2.5v7M5 7l3 3 3-3M2.5 12.5h11" />
    </svg>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold tracking-[0.18em] text-ink-dim uppercase">
      {children}
    </h2>
  )
}

/* Status dots — quieter than pills, reads like a console UI. */
const GAME_STATUS_DOTS: Record<GameStatus, string> = {
  live: 'bg-emerald-400',
  dev: 'bg-sky-400',
  planned: 'bg-violet-400',
  paused: 'bg-amber-400',
}

export function GameStatusBadge({ status }: { status: GameStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-dim">
      <span className={`h-1.5 w-1.5 rounded-full ${GAME_STATUS_DOTS[status]}`} />
      {GAME_STATUS_LABELS[status]}
    </span>
  )
}

const REQUEST_STATUS_STYLES: Record<RequestStatus, string> = {
  open: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  planned: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  done: 'bg-accent/10 text-accent border-accent/30',
  rejected: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${REQUEST_STATUS_STYLES[status]}`}
    >
      {REQUEST_STATUS_LABELS[status]}
    </span>
  )
}

export function Avatar({
  user,
  size = 'md',
  online,
}: {
  user: Pick<UserProfile, 'avatar' | 'displayName'> | undefined
  size?: 'sm' | 'md' | 'lg'
  online?: boolean
}) {
  const sizes = { sm: 'h-7 w-7 text-sm', md: 'h-9 w-9 text-lg', lg: 'h-16 w-16 text-3xl' }
  const avatar = user?.avatar || '👤'
  // Real picture (Google photoURL or resized custom upload) vs emoji.
  const isImage = avatar.startsWith('http') || avatar.startsWith('data:image/')
  return (
    <span className="relative inline-block shrink-0">
      <span
        className={`flex items-center justify-center overflow-hidden rounded-md border border-edge bg-panel-2 ${sizes[size]}`}
        title={user?.displayName}
      >
        {isImage ? (
          <img
            src={avatar}
            alt={user?.displayName ?? ''}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          avatar
        )}
      </span>
      {online !== undefined && (
        <span
          className={`absolute -right-1 -bottom-1 h-2.5 w-2.5 rounded-full border-2 border-abyss ${
            online ? 'bg-emerald-400' : 'bg-zinc-600'
          }`}
        />
      )}
    </span>
  )
}

export const inputCls =
  'w-full rounded-md border border-edge bg-abyss px-3 py-2 text-ink placeholder:text-ink-dim/50 outline-none transition focus:border-accent'

export const btnPrimary =
  'rounded-md bg-accent px-4 py-2 text-sm font-semibold text-abyss transition hover:brightness-115 disabled:opacity-50 disabled:hover:brightness-100'

/** Steam-style green "Jouer" button (web + embedded games). */
export const btnPlay =
  'inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50'

export const btnGhost =
  'rounded-md border border-edge px-4 py-2 text-sm font-medium text-ink transition hover:border-edge-2 hover:bg-panel-2 disabled:opacity-50'

export const btnDanger =
  'rounded-md border border-rose-500/30 px-4 py-2 text-sm font-medium text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-50'
