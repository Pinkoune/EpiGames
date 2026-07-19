import { Link, Navigate } from 'react-router-dom'
import { SectionLabel, Avatar, btnGhost } from '../components/ui'
import { useAuthStore } from '../stores/authStore'
import { useGamesStore } from '../stores/gamesStore'
import { useUsersStore } from '../stores/usersStore'

export function AdminPage() {
  const user = useAuthStore((s) => s.user)
  const users = useUsersStore((s) => s.users)
  const setUserFlags = useUsersStore((s) => s.setUserFlags)
  const { games, approveGame } = useGamesStore()

  if (!user?.isAdmin) return <Navigate to="/" replace />

  const pending = games.filter((g) => !g.approved)
  const members = Object.values(users).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  )

  return (
    <div>
      <h1 className="font-display mb-8 text-3xl font-bold tracking-tight">Administration</h1>

      <section className="mb-10">
        <SectionLabel>Jeux en attente de publication ({pending.length})</SectionLabel>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-edge p-6 text-sm text-ink-dim">
            Aucune soumission en attente.
          </p>
        ) : (
          <div className="space-y-2">
            {pending.map((g) => (
              <div
                key={g.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/25 bg-panel p-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/game/${g.id}`}
                    className="font-display font-semibold hover:text-accent"
                  >
                    {g.title}
                  </Link>
                  <p className="text-xs text-ink-dim">
                    soumis par {users[g.createdBy]?.displayName ?? '???'} ·{' '}
                    {new Date(g.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <Link to={`/game/${g.id}`} className={btnGhost}>
                  Examiner
                </Link>
                <button
                  onClick={() => void approveGame(g.id, true)}
                  className="rounded-md bg-amber-400 px-4 py-2 text-sm font-bold text-abyss transition hover:brightness-110"
                >
                  Publier
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionLabel>Membres & rôles ({members.length})</SectionLabel>
        <p className="mb-3 text-xs text-ink-dim">
          Tout membre peut soumettre un jeu depuis son profil.{' '}
          <strong>Admin</strong> : publie les jeux soumis, gère les rôles, peut
          tout supprimer.
        </p>
        <div className="space-y-2">
          {members.map((m) => {
            const isSelf = m.uid === user.uid
            return (
              <div
                key={m.uid}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-panel p-3"
              >
                <Avatar user={m} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {m.displayName}
                    {isSelf && <span className="ml-2 text-xs text-ink-dim">(toi)</span>}
                  </p>
                  {m.bio && <p className="truncate text-xs text-ink-dim">{m.bio}</p>}
                </div>
                <label
                  className={`flex items-center gap-1.5 text-sm ${
                    isSelf ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  }`}
                  title={
                    isSelf
                      ? 'Tu ne peux pas retirer ton propre accès admin ici'
                      : 'Donner ou retirer l’accès admin'
                  }
                >
                  <input
                    type="checkbox"
                    checked={m.isAdmin}
                    disabled={isSelf}
                    onChange={(e) => {
                      const on = e.target.checked
                      const msg = on
                        ? `Donner l'accès admin à ${m.displayName} ? Il pourra gérer les rôles, publier et supprimer des jeux.`
                        : `Retirer l'accès admin à ${m.displayName} ?`
                      if (confirm(msg)) void setUserFlags(m.uid, { isAdmin: on })
                      else e.target.checked = !on
                    }}
                    className="accent-accent"
                  />
                  Admin
                </label>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
