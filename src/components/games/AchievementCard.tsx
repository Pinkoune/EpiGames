import { useState, type FormEvent } from 'react'
import { backend } from '../../lib/backend'
import { useAchievementComments } from '../../lib/hooks'
import type { AchievementStatus, GameAchievement } from '../../lib/types'
import { useAuthStore } from '../../stores/authStore'
import { useUsersStore } from '../../stores/usersStore'
import { Avatar, btnGhost, inputCls } from '../ui'
import { AchievementFormModal } from './AchievementFormModal'

/** Approved achievement, player-facing: unlock it on the honor system. */
export function AchievementBadge({ achievement }: { achievement: GameAchievement }) {
  const user = useAuthStore((s) => s.user)
  const unlockers = Object.keys(achievement.unlockedBy)
  const mine = user ? Boolean(achievement.unlockedBy[user.uid]) : false

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 transition ${
        mine ? 'border-amber-500/40 bg-amber-500/5' : 'border-edge bg-panel'
      }`}
    >
      <span className={`text-3xl ${mine ? '' : 'opacity-70 grayscale'}`}>{achievement.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{achievement.title}</p>
        <p className="line-clamp-2 text-xs text-ink-dim">{achievement.description}</p>
        <p className="mt-0.5 text-[11px] text-ink-dim/70">
          {unlockers.length} débloqué{unlockers.length > 1 ? 's' : ''}
        </p>
      </div>
      {user && (
        <button
          onClick={() => void backend.toggleAchievementUnlock(achievement.gameId, achievement.id, user.uid, !mine)}
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
            mine
              ? 'border border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
              : 'bg-emerald-500 text-white hover:bg-emerald-400'
          }`}
          title={mine ? 'Retirer' : "Je l'ai débloqué"}
        >
          {mine ? '✓ Obtenu' : 'Débloquer'}
        </button>
      )}
    </div>
  )
}

const STATUS_STYLE: Record<AchievementStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
}
const STATUS_LABEL: Record<AchievementStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
}

/**
 * Merge-Request style review card for a proposal — shown to the game's owners
 * and admins. Owner edits in place; admin approves/rejects; both discuss.
 */
export function AchievementReviewCard({ achievement }: { achievement: GameAchievement }) {
  const user = useAuthStore((s) => s.user)
  const users = useUsersStore((s) => s.users)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const comments = useAchievementComments(achievement.gameId, achievement.id, open)

  if (!user) return null
  const isOwnerProposal = achievement.createdBy === user.uid
  const setStatus = (status: AchievementStatus) =>
    void backend.setAchievementStatus(achievement.gameId, achievement.id, status)

  async function addComment(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || !user) return
    setText('')
    await backend.addAchievementComment(achievement.gameId, achievement.id, user.uid, t)
  }

  return (
    <div className="rounded-lg border border-edge bg-panel p-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{achievement.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{achievement.title}</p>
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[achievement.status]}`}
            >
              {STATUS_LABEL[achievement.status]}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ink-dim">{achievement.description}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {user.isAdmin && achievement.status !== 'approved' && (
          <button
            onClick={() => setStatus('approved')}
            className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-400"
          >
            ✓ Approuver
          </button>
        )}
        {user.isAdmin && achievement.status !== 'rejected' && (
          <button
            onClick={() => setStatus('rejected')}
            className="rounded-md border border-rose-500/30 px-2.5 py-1 text-xs font-medium text-rose-400 transition hover:bg-rose-500/10"
          >
            Rejeter
          </button>
        )}
        {user.isAdmin && achievement.status !== 'pending' && (
          <button
            onClick={() => setStatus('pending')}
            className={`${btnGhost} px-2.5 py-1 text-xs`}
          >
            Rouvrir
          </button>
        )}
        {isOwnerProposal && achievement.status === 'pending' && (
          <button onClick={() => setEditing(true)} className={`${btnGhost} px-2.5 py-1 text-xs`}>
            Modifier
          </button>
        )}
        {(user.isAdmin || isOwnerProposal) && (
          <button
            onClick={() => {
              if (confirm(`Supprimer le succès « ${achievement.title} » ?`))
                void backend.deleteAchievement(achievement.gameId, achievement.id)
            }}
            className="rounded-md border border-rose-500/30 px-2.5 py-1 text-xs font-medium text-rose-400 transition hover:bg-rose-500/10"
          >
            Supprimer
          </button>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-xs text-ink-dim transition hover:text-ink"
        >
          {open ? 'Masquer la discussion' : `Discussion${comments.length ? ` (${comments.length})` : ''}`}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-edge pt-3">
          {comments.length === 0 && (
            <p className="text-xs text-ink-dim">Pas encore de commentaire.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 text-sm">
              <Avatar user={users[c.authorUid]} size="sm" />
              <div className="min-w-0">
                <span className="text-xs font-semibold">
                  {users[c.authorUid]?.displayName ?? '???'}
                </span>
                <p className="text-ink/90">{c.text}</p>
              </div>
            </div>
          ))}
          <form onSubmit={addComment} className="flex gap-2 pt-1">
            <input
              className={`${inputCls} text-sm`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Commenter la proposition…"
              maxLength={500}
            />
            <button type="submit" disabled={!text.trim()} className={`${btnGhost} shrink-0 text-sm`}>
              Envoyer
            </button>
          </form>
        </div>
      )}

      {editing && (
        <AchievementFormModal
          gameId={achievement.gameId}
          achievement={achievement}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
