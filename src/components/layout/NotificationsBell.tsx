import { useState } from 'react'
import { Link } from 'react-router-dom'
import { hasUnseenNewGame, hasUnseenUpdate } from '../../lib/types'
import { useAuthStore } from '../../stores/authStore'
import { useFriendsStore, friendUidsOf, pendingIncoming } from '../../stores/friendsStore'
import { useGamesStore } from '../../stores/gamesStore'
import { usePresenceStore } from '../../stores/presenceStore'
import { useUsersStore } from '../../stores/usersStore'
import { Avatar } from '../ui'

/**
 * Lightweight, ephemeral notifications — no storage, no new data model.
 * Everything is derived on the fly from what the app already watches:
 * pending friend requests, newly published games, game updates you haven't
 * dismissed, and friends currently in-game. It's a glanceable digest, not an
 * inbox.
 */
export function NotificationsBell() {
  const user = useAuthStore((s) => s.user)
  const users = useUsersStore((s) => s.users)
  const games = useGamesStore((s) => s.games)
  const friendships = useFriendsStore((s) => s.friendships)
  const presence = usePresenceStore((s) => s.presence)
  const [open, setOpen] = useState(false)

  if (!user) return null

  const incoming = pendingIncoming(friendships, user.uid)
  const updatedGames = games.filter(
    (g) => g.approved && !g.archived && hasUnseenUpdate(user, g),
  )
  const newGames = games.filter(
    (g) => g.approved && !g.archived && hasUnseenNewGame(user, g),
  )
  const friendsInGame = friendUidsOf(friendships, user.uid)
    .map((uid) => ({ uid, info: presence[uid] }))
    .filter((f) => f.info?.online && f.info.playing)

  const count = incoming.length + updatedGames.length + newGames.length
  const isEmpty = count === 0 && friendsInGame.length === 0

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-ink-dim transition hover:bg-panel-2 hover:text-ink"
        aria-label="Notifications"
        title="Notifications"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
          <path
            d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5c0 3-1.2 4.2-1.7 4.8-.2.2 0 .7.3.7h11.8c.3 0 .5-.5.3-.7-.5-.6-1.7-1.8-1.7-4.8A4.5 4.5 0 0 0 10 2.5ZM8.3 15.5a1.8 1.8 0 0 0 3.4 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-abyss">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-edge bg-panel shadow-2xl">
            <div className="border-b border-edge px-4 py-2.5 text-xs font-semibold tracking-wide text-ink-dim uppercase">
              Notifications
            </div>
            <div className="max-h-96 overflow-y-auto">
              {isEmpty && (
                <p className="px-4 py-6 text-center text-sm text-ink-dim">Rien de neuf.</p>
              )}

              {incoming.length > 0 && (
                <Link
                  to="/friends"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-panel-2"
                >
                  <span className="text-accent">👥</span>
                  <span>
                    <span className="font-semibold">{incoming.length}</span> demande
                    {incoming.length > 1 ? 's' : ''} d'ami en attente
                  </span>
                </Link>
              )}

              {newGames.map((g) => (
                <Link
                  key={g.id}
                  to={`/game/${g.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-panel-2"
                >
                  <span className="text-accent">🚀</span>
                  <span className="min-w-0">
                    Nouveau jeu : <span className="font-semibold">{g.title}</span>
                  </span>
                </Link>
              ))}

              {updatedGames.map((g) => (
                <Link
                  key={g.id}
                  to={`/game/${g.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-panel-2"
                >
                  <span className="text-accent">📣</span>
                  <span className="min-w-0">
                    Mise à jour de <span className="font-semibold">{g.title}</span>
                    {g.update?.version ? ` (${g.update.version})` : ''}
                  </span>
                </Link>
              ))}

              {friendsInGame.length > 0 && (
                <div className="border-t border-edge">
                  <p className="px-4 pt-2 pb-1 text-[11px] tracking-wide text-ink-dim uppercase">
                    Amis en jeu
                  </p>
                  {friendsInGame.map(({ uid, info }) => (
                    <Link
                      key={uid}
                      to={`/game/${info.playing!.gameId}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm transition hover:bg-panel-2"
                    >
                      <Avatar user={users[uid]} size="sm" online />
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{users[uid]?.displayName ?? '???'}</span>
                        <span className="text-ink-dim"> · {info.playing!.title}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
