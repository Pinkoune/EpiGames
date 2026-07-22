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

// Full-width rows for the mobile drawer.
const mobileNavCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition ${
    isActive ? 'bg-accent/15 text-accent' : 'text-ink-dim hover:bg-panel-2 hover:text-ink'
  }`

export function Shell() {
  const { user, signOut } = useAuthStore()
  const friendships = useFriendsStore((s) => s.friendships)
  const games = useGamesStore((s) => s.games)
  const [editingProfile, setEditingProfile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  const presence = usePresenceStore((s) => s.presence)
  const setPlaying = usePresenceStore((s) => s.setPlaying)

  // Self-correcting "en jeu": clears the status on prolonged inactivity.
  usePresenceAutoAway(user?.uid)

  const myPlaying = user ? (presence[user.uid]?.playing ?? null) : null

  const incoming = user ? pendingIncoming(friendships, user.uid).length : 0
  const pendingGames = user?.isAdmin ? games.filter((g) => !g.approved).length : 0
  const onlineFriends = user
    ? friendUidsOf(friendships, user.uid).filter((uid) => presence[uid]?.online).length
    : 0

  // Nav links shared between the desktop bar and the mobile drawer, so the
  // badges (online friends, pending requests, pending games) stay in sync.
  const navLinks = (
    cls: typeof navCls,
    onClick?: () => void,
  ) => (
    <>
      <NavLink to="/" end className={cls} onClick={onClick}>
        Bibliothèque
      </NavLink>
      <NavLink to="/forum" className={cls} onClick={onClick}>
        Forum
      </NavLink>
      <NavLink to="/friends" className={cls} onClick={onClick}>
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
        <NavLink to="/admin" className={cls} onClick={onClick}>
          Admin
          {pendingGames > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-xs font-bold text-abyss">
              {pendingGames}
            </span>
          )}
        </NavLink>
      )}
    </>
  )

  return (
    <div className="bp-bg flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-edge bg-abyss/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setNavOpen((v) => !v)}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-md text-ink-dim transition hover:bg-panel-2 hover:text-ink md:hidden"
            aria-label="Menu"
            aria-expanded={navOpen}
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
              {navOpen ? (
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M3 6h14M3 10h14M3 14h14"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>

          <NavLink to="/" onClick={() => setNavOpen(false)}>
            <Logo size="sm" />
          </NavLink>

          <nav className="hidden h-full items-center gap-1 md:flex">
            {navLinks(navCls)}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {backend.mode === 'local' && (
              <span
                className="hidden rounded border border-amber-500/30 px-1.5 py-0.5 text-[11px] text-amber-400/90 sm:inline"
                title="Firebase non configuré — données dans ce navigateur uniquement"
              >
                LOCAL
              </span>
            )}
            <NotificationsBell />
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md px-1 py-1 transition hover:bg-panel-2 sm:px-2"
              >
                <Avatar user={user ?? undefined} size="sm" />
                <span className="hidden text-sm font-medium sm:inline">{user?.displayName}</span>
                {myPlaying && (
                  <span
                    className="hidden max-w-28 truncate text-xs text-emerald-400 sm:inline"
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
                    {/* Manual stop only — the status itself is only ever set by
                        the ▶ Jouer button on a game, never picked from here. */}
                    {user && myPlaying && (
                      <div className="border-t border-edge px-4 py-2.5">
                        <button
                          onClick={() => {
                            setMenuOpen(false)
                            void setPlaying(user.uid, null)
                          }}
                          className="text-left text-sm text-emerald-400 hover:underline"
                        >
                          ■ Arrêter « {myPlaying.title} »
                        </button>
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

        {/* Mobile nav drawer */}
        {navOpen && (
          <>
            <div className="fixed inset-0 top-14 z-30 md:hidden" onClick={() => setNavOpen(false)} />
            <nav className="relative z-40 space-y-0.5 border-t border-edge bg-abyss/95 px-3 py-3 backdrop-blur md:hidden">
              {navLinks(mobileNavCls, () => setNavOpen(false))}
            </nav>
          </>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      {editingProfile && <ProfileEditor onClose={() => setEditingProfile(false)} />}
    </div>
  )
}
