import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SignInScreen } from './components/auth/SignInScreen'
import { Shell } from './components/layout/Shell'
import { AdminPage } from './pages/AdminPage'
import { ForumPage } from './pages/ForumPage'
import { FriendsPage } from './pages/FriendsPage'
import { GameDetailPage } from './pages/GameDetailPage'
import { LibraryPage } from './pages/LibraryPage'
import { ProfilePage } from './pages/ProfilePage'
import { useAuthStore } from './stores/authStore'
import { useFriendsStore } from './stores/friendsStore'
import { useGamesStore } from './stores/gamesStore'
import { usePresenceStore } from './stores/presenceStore'
import { useUsersStore } from './stores/usersStore'

export default function App() {
  const { user, loading, init } = useAuthStore()
  const initUsers = useUsersStore((s) => s.init)
  const initGames = useGamesStore((s) => s.init)
  const initPresence = usePresenceStore((s) => s.init)
  const watchFriends = useFriendsStore((s) => s.watch)

  useEffect(() => init(), [init])

  // Data subscriptions only once signed in (rules require auth to read).
  useEffect(() => {
    if (!user) {
      watchFriends(null)
      return
    }
    initUsers()
    initGames()
    initPresence()
    watchFriends(user.uid)
  }, [user, initUsers, initGames, initPresence, watchFriends])

  if (loading) {
    return (
      <div className="bp-bg flex min-h-full items-center justify-center">
        <div className="animate-pulse text-4xl">🕹️</div>
      </div>
    )
  }

  if (!user) return <SignInScreen />

  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<LibraryPage />} />
          <Route path="game/:gameId" element={<GameDetailPage />} />
          <Route path="forum" element={<ForumPage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="profile/:uid" element={<ProfilePage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
