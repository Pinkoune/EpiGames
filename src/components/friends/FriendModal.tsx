import { useState } from 'react'
import { Link } from 'react-router-dom'
import { relativeTime } from '../../lib/format'
import type { Game, PlayEntry, PresenceInfo, UserProfile } from '../../lib/types'
import { resolveProfileTitle } from '../../lib/profileCustomization'
import { Avatar, Modal, btnDanger, btnGhost, btnPrimary } from '../ui'

/** Absolute date+time, for "last seen" ("22/07/2026 à 17:32"). */
function dateTime(ts: number): string {
  const d = new Date(ts)
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/**
 * Friend card: who they are, what they last played, when they were last
 * around, and every action you'd want on them. Opened from the friends list.
 */
export function FriendModal({
  profile,
  presence,
  lastPlay,
  games,
  invitableGames,
  playingGameId,
  onClose,
  onMessage,
  onInvite,
  onRemove,
}: {
  profile: UserProfile
  presence: PresenceInfo | undefined
  /** Their most recent launch, if any. */
  lastPlay: PlayEntry | undefined
  games: Game[]
  invitableGames: Game[]
  /** Game the VIEWER is currently in — offered first when inviting. */
  playingGameId: string | undefined
  onClose: () => void
  onMessage: () => void
  onInvite: (gameId: string) => void
  onRemove: () => void
}) {
  const [picking, setPicking] = useState(false)

  const online = presence?.online ?? false
  const playing = online ? presence?.playing : null
  const title = resolveProfileTitle(profile.profileTitle)
  const lastPlayTitle =
    games.find((g) => g.id === lastPlay?.gameId)?.title ?? lastPlay?.title

  return (
    <Modal title={profile.displayName} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar user={profile} size="lg" online={online} />
          <div className="min-w-0">
            {title && <p className="text-sm font-medium text-accent">« {title} »</p>}
            <p className="text-sm">
              {playing ? (
                <span className="text-emerald-400">🎮 Joue à {playing.title}</span>
              ) : online ? (
                <span className="text-emerald-400">En ligne</span>
              ) : (
                <span className="text-ink-dim">Hors ligne</span>
              )}
            </p>
            {profile.bio && (
              <p className="mt-1 text-sm text-ink/80 italic">« {profile.bio} »</p>
            )}
          </div>
        </div>

        <dl className="space-y-2 rounded-lg border border-edge bg-panel-2/50 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-dim">Dernier jeu</dt>
            <dd className="min-w-0 truncate text-right">
              {lastPlay && lastPlayTitle ? (
                <Link
                  to={`/game/${lastPlay.gameId}`}
                  onClick={onClose}
                  className="hover:text-accent hover:underline"
                >
                  {lastPlayTitle}
                </Link>
              ) : (
                <span className="text-ink-dim">—</span>
              )}
            </dd>
          </div>
          {lastPlay && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-dim">Joué</dt>
              <dd className="text-right">{relativeTime(lastPlay.at)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-ink-dim">{online ? 'Connecté' : 'Vu pour la dernière fois'}</dt>
            <dd className="text-right">
              {online
                ? 'maintenant'
                : presence?.lastSeen
                  ? dateTime(presence.lastSeen)
                  : 'jamais'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-dim">Membre depuis</dt>
            <dd className="text-right">
              {new Date(profile.createdAt).toLocaleDateString('fr-FR')}
            </dd>
          </div>
        </dl>

        {/* Invite: pick the game, then it's sent as a private message. */}
        {picking ? (
          <div className="rounded-lg border border-edge">
            <p className="border-b border-edge px-3 py-2 text-xs tracking-wide text-ink-dim uppercase">
              Inviter à jouer à…
            </p>
            <div className="max-h-48 overflow-y-auto py-1">
              {invitableGames.length === 0 ? (
                <p className="px-3 py-2 text-xs text-ink-dim">Aucun jeu à proposer.</p>
              ) : (
                invitableGames.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => onInvite(g.id)}
                    className="block w-full truncate px-3 py-2 text-left text-sm transition hover:bg-panel-2"
                  >
                    {g.id === playingGameId && <span className="text-emerald-400">▶ </span>}
                    {g.title}
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setPicking(false)}
              className="w-full border-t border-edge px-3 py-2 text-xs text-ink-dim transition hover:text-ink"
            >
              Annuler
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onMessage} className={btnPrimary}>
              💬 Envoyer un message
            </button>
            <button onClick={() => setPicking(true)} className={btnGhost}>
              🎮 Inviter à jouer
            </button>
            <Link
              to={`/profile/${profile.uid}`}
              onClick={onClose}
              className={`${btnGhost} text-center`}
            >
              Voir le profil
            </Link>
            <button
              onClick={() => {
                if (confirm(`Retirer ${profile.displayName} de tes amis ?`)) onRemove()
              }}
              className={btnDanger}
            >
              Retirer des amis
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
