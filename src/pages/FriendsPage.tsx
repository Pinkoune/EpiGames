import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, btnGhost, btnPrimary, inputCls } from '../components/ui'
import { friendshipId } from '../lib/types'
import { useAuthStore } from '../stores/authStore'
import {
  friendUidsOf,
  pendingIncoming,
  pendingOutgoing,
  useFriendsStore,
} from '../stores/friendsStore'
import { usePresenceStore } from '../stores/presenceStore'
import { useUsersStore } from '../stores/usersStore'

export function FriendsPage() {
  const user = useAuthStore((s) => s.user)
  const users = useUsersStore((s) => s.users)
  const presence = usePresenceStore((s) => s.presence)
  const setPlaying = usePresenceStore((s) => s.setPlaying)
  const { friendships, sendRequest, accept, remove } = useFriendsStore()
  const [search, setSearch] = useState('')

  const me = user?.uid ?? ''
  const friendUids = useMemo(() => friendUidsOf(friendships, me), [friendships, me])
  const incoming = useMemo(() => pendingIncoming(friendships, me), [friendships, me])
  const outgoing = useMemo(() => pendingOutgoing(friendships, me), [friendships, me])

  const relatedUids = new Set(friendships.flatMap((f) => f.users))
  const candidates = Object.values(users).filter((u) => {
    if (u.uid === me || relatedUids.has(u.uid)) return false
    const q = search.trim().toLowerCase()
    return !q || u.displayName.toLowerCase().includes(q)
  })

  // Online friends first, then playing, then name.
  const sortedFriends = [...friendUids].sort((a, b) => {
    const pa = presence[a]
    const pb = presence[b]
    const oa = pa?.online ? 1 : 0
    const ob = pb?.online ? 1 : 0
    if (oa !== ob) return ob - oa
    return (users[a]?.displayName ?? '').localeCompare(users[b]?.displayName ?? '')
  })

  const myPresence = presence[me]

  if (!user) return null

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div>
        <h1 className="mb-1 text-2xl font-black tracking-tight">Amis</h1>
        {myPresence?.playing && (
          <p className="mb-4 flex items-center gap-2 text-sm text-emerald-400">
            Tu es en train de jouer à{' '}
            <Link
              to={`/game/${myPresence.playing.gameId}`}
              className="font-semibold hover:underline"
            >
              {myPresence.playing.title}
            </Link>
            <button
              onClick={() => void setPlaying(me, null)}
              className="rounded border border-edge px-1.5 py-0.5 text-xs text-ink-dim hover:text-ink"
            >
              J'ai fini
            </button>
          </p>
        )}

        {incoming.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-bold tracking-wide text-accent uppercase">
              Demandes reçues
            </h2>
            <div className="space-y-2">
              {incoming.map((f) => {
                const other = f.users[0] === me ? f.users[1] : f.users[0]
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3"
                  >
                    <Avatar user={users[other]} online={presence[other]?.online ?? false} />
                    <span className="font-semibold">{users[other]?.displayName ?? '???'}</span>
                    <div className="ml-auto flex gap-2">
                      <button onClick={() => void accept(f.id)} className={`${btnPrimary} px-3 py-1.5 text-sm`}>
                        Accepter
                      </button>
                      <button onClick={() => void remove(f.id)} className={`${btnGhost} px-3 py-1.5 text-sm`}>
                        Refuser
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-bold tracking-wide text-ink-dim uppercase">
            Mes amis ({friendUids.length})
          </h2>
          {sortedFriends.length === 0 ? (
            <p className="rounded-xl border border-dashed border-edge p-8 text-center text-sm text-ink-dim">
              Pas encore d'amis — envoie une demande depuis la liste des membres →
            </p>
          ) : (
            <div className="space-y-2">
              {sortedFriends.map((uid) => {
                const p = presence[uid]
                const playing = p?.online ? p.playing : null
                return (
                  <div
                    key={uid}
                    className="flex items-center gap-3 rounded-xl border border-edge bg-panel p-3"
                  >
                    <Avatar user={users[uid]} online={p?.online ?? false} />
                    <div className="min-w-0">
                      <Link
                        to={`/profile/${uid}`}
                        className="font-semibold hover:text-accent hover:underline"
                      >
                        {users[uid]?.displayName ?? '???'}
                      </Link>
                      <p className="text-xs text-ink-dim">
                        {playing ? (
                          <Link
                            to={`/game/${playing.gameId}`}
                            className="text-emerald-400 hover:underline"
                          >
                            🎮 Joue à {playing.title}
                          </Link>
                        ) : p?.online ? (
                          'En ligne'
                        ) : (
                          'Hors ligne'
                        )}
                      </p>
                    </div>
                    {users[uid]?.bio && (
                      <p className="ml-4 hidden truncate text-xs text-ink-dim italic sm:block">
                        {users[uid].bio}
                      </p>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Retirer ${users[uid]?.displayName} de tes amis ?`)) {
                          void remove(friendshipId(me, uid))
                        }
                      }}
                      className="ml-auto text-xs text-ink-dim hover:text-rose-400"
                    >
                      Retirer
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <aside>
        <h2 className="mb-2 text-sm font-bold tracking-wide text-ink-dim uppercase">Membres</h2>
        <input
          className={`${inputCls} mb-3`}
          placeholder="Chercher un membre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="space-y-2">
          {outgoing.map((f) => {
            const other = f.users[0] === me ? f.users[1] : f.users[0]
            return (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-edge bg-panel/50 p-3"
              >
                <Avatar user={users[other]} size="sm" />
                <span className="text-sm">{users[other]?.displayName ?? '???'}</span>
                <span className="ml-auto text-xs text-ink-dim">En attente…</span>
                <button
                  onClick={() => void remove(f.id)}
                  className="text-xs text-ink-dim hover:text-rose-400"
                  title="Annuler la demande"
                >
                  ✕
                </button>
              </div>
            )
          })}
          {candidates.map((u) => (
            <div
              key={u.uid}
              className="flex items-center gap-3 rounded-xl border border-edge bg-panel p-3"
            >
              <Avatar user={u} size="sm" online={presence[u.uid]?.online ?? false} />
              <Link
                to={`/profile/${u.uid}`}
                className="text-sm font-medium hover:text-accent hover:underline"
              >
                {u.displayName}
              </Link>
              <button
                onClick={() => void sendRequest(me, u.uid)}
                className="ml-auto rounded-lg border border-accent/40 px-2.5 py-1 text-xs font-semibold text-accent transition hover:bg-accent/10"
              >
                + Ami
              </button>
            </div>
          ))}
          {candidates.length === 0 && outgoing.length === 0 && (
            <p className="text-xs text-ink-dim">Aucun autre membre à ajouter.</p>
          )}
        </div>
      </aside>
    </div>
  )
}
