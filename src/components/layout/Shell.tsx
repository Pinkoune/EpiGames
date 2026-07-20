import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../Logo'
import { backend } from '../../lib/backend'
import { usePresenceAutoAway } from '../../lib/usePresenceAutoAway'
import { useAuthStore } from '../../stores/authStore'
import { useFriendsStore, friendUidsOf, pendingIncoming } from '../../stores/friendsStore'
import { useGamesStore } from '../../stores/gamesStore'
import { usePresenceStore } from '../../stores/presenceStore'
import { ProfileEditor } from '../auth/ProfileEditor'
import { NotificationsBell } from './NotificationsBell'
import { Avatar } from '../ui'

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 text-sm font-medium tracking-wide transition border-b-2 ${
    isActive
      ? 'border-accent text-ink'
      : 'border-transparent text-ink-dim hover:text-ink'
  }`

export function Shell() {
  const { user, signOut } = useAuthStore()
  const friendships = useFriendsStore((s) => s.friendships)
  const games = useGamesStore((s) => s.games)
  const [editingProfile, setEditingProfile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const presence = usePresenceStore((s) => s.presence)
  const setPlaying = usePresenceStore((s) => s.setPlaying)

  // Self-correcting "en jeu": clears the status on prolonged inactivity.
  usePresenceAutoAway(user?.uid)

  const myPlaying = user ? (presence[user.uid]?.playing ?? null) : null
  const playableGames = games.filter((g) => g.approved && !g.archived && g.status === 'live')

  const incoming = user ? pendingIncoming(friendships, user.uid).length : 0
  const pendingGames = user?.isAdmin ? games.filter((g) => !g.approved).length : 0
  const onlineFriends = user
    ? friendUidsOf(friendships, user.uid).filter((uid) => presence[uid]?.online).length
    : 0

  return (
    <div className="bp-bg flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-edge bg-abyss/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <NavLink to="/">
            <Logo size="sm" />
          </NavLink>

          <nav className="flex h-full items-center gap-1">
            <NavLink to="/" end className={navCls}>
              Bibliothèque
            </NavLink>
            <NavLink to="/forum" className={navCls}>
              Forum
            </NavLink>
            <NavLink to="/friends" className={navCls}>
              Amis
              {onlineFriends > 0 && (
                <span
                  className="ml-1.5 text-xs font-semibold text-emerald-400"
                  title={`${onlineFriends} ami(s) en ligne`}
                >
                  ● {onlineFriends}
                </span>
              )}
              {incoming > 0 && (
                <span className="ml-1.5 rounded-full bg-accent px-1.5 text-xs font-bold text-abyss">
                  {incoming}
                </span>
              )}
            </NavLink>
            {user?.isAdmin && (
              <NavLink to="/admin" className={navCls}>
                Admin
                {pendingGames > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-xs font-bold text-abyss">
                    {pendingGames}
                  </span>
                )}
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {backend.mode === 'local' && (
              <span
                className="rounded border border-amber-500/30 px-1.5 py-0.5 text-[11px] text-amber-400/90"
                title="Firebase non configuré — données dans ce navigateur uniquement"
              >
                LOCAL
              </span>
            )}
            <NotificationsBell />
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-panel-2"
              >
                <Avatar user={user ?? undefined} size="sm" />
                <span className="text-sm font-medium">{user?.displayName}</span>
                {myPlaying && (
                  <span
                    className="max-w-28 truncate text-xs text-emerald-400"
                    title={`En train de jouer à ${myPlaying.title}`}
                  >
                    🎮 {myPlaying.title}
                  </span>
                )}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-edge bg-panel shadow-2xl">
                    <NavLink
                      to={`/profile/${user?.uid}`}
                      onClick={() => setMenuOpen(false)}
                      className="block w-full px-4 py-2.5 text-left text-sm hover:bg-panel-2"
                    >
                      Mon profil
                    </NavLink>
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        setEditingProfile(true)
                      }}
                      className="block w-full px-4 py-2.5 text-left text-sm hover:bg-panel-2"
                    >
                      Modifier le profil
                    </button>
                    {/* Declarative "playing" status lives here, Discord-style */}
                    {user && (
                      <div className="border-t border-edge px-4 py-2.5">
                        {myPlaying ? (
                          <button
                            onClick={() => {
                              setMenuOpen(false)
                              void setPlaying(user.uid, null)
                            }}
                            className="text-left text-sm text-emerald-400 hover:underline"
                          >
                            ■ Arrêter « {myPlaying.title} »
                          </button>
                        ) : playableGames.length > 0 ? (
                          <>
                            <p className="mb-1.5 text-xs tracking-wide text-ink-dim uppercase">
                              Je joue à…
                            </p>
                            <div className="flex flex-col gap-1">
                              {playableGames.slice(0, 6).map((g) => (
                                <button
                                  key={g.id}
                                  onClick={() => {
                                    setMenuOpen(false)
                                    void setPlaying(user.uid, g)
                                  }}
                                  className="truncate text-left text-sm text-ink-dim transition hover:text-ink"
                                >
                                  🎮 {g.title}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-ink-dim">Aucun jeu live à signaler.</p>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        void signOut()
                      }}
                      className="block w-full border-t border-edge px-4 py-2.5 text-left text-sm text-rose-400 hover:bg-panel-2"
                    >
                      Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      {editingProfile && <ProfileEditor onClose={() => setEditingProfile(false)} />}
    </div>
  )
}
