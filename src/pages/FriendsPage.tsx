import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChatChannel } from '../components/forum/ChatChannel'
import { FriendModal } from '../components/friends/FriendModal'
import { Avatar, SectionLabel, btnGhost, btnPrimary, inputCls } from '../components/ui'
import { backend } from '../lib/backend'
import { buildFriendActivity, buildSuggestions } from '../lib/activity'
import { coverFallback } from '../lib/cover'
import { relativeTime } from '../lib/format'
import { useAllScopeData, useFriendDms, usePlaysMap } from '../lib/hooks'
import type { Game } from '../lib/types'
import { dmScopeId, friendshipId, inviteMessage, parseInvite } from '../lib/types'
import { useAuthStore } from '../stores/authStore'
import {
  friendUidsOf,
  pendingIncoming,
  pendingOutgoing,
  useFriendsStore,
} from '../stores/friendsStore'
import { canSeeGame, useGamesStore } from '../stores/gamesStore'
import { usePresenceStore } from '../stores/presenceStore'
import { useUsersStore } from '../stores/usersStore'

/** Compact preview line for a conversation ("Toi : salut"). */
function previewOf(text: string, mine: boolean, gameTitle?: string): string {
  // Invite markers are machine-readable; show something human here.
  const raw = parseInvite(text) ? `🎮 Invitation — ${gameTitle ?? 'un jeu'}` : text
  const body = raw.length > 38 ? `${raw.slice(0, 38)}…` : raw
  return mine ? `Toi : ${body}` : body
}

export function FriendsPage() {
  const user = useAuthStore((s) => s.user)
  const users = useUsersStore((s) => s.users)
  const presence = usePresenceStore((s) => s.presence)
  const setPlaying = usePresenceStore((s) => s.setPlaying)
  const { friendships, sendRequest, accept, remove } = useFriendsStore()
  const [search, setSearch] = useState('')
  /** Conversation currently open in the middle column. */
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  /** Friend whose card modal is open (clicking a friend opens this, not the chat). */
  const [modalUid, setModalUid] = useState<string | null>(null)
  // Mobile: the friend list is a drawer so the conversation gets the screen.
  const [listOpen, setListOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  const me = user?.uid ?? ''
  const friendUids = useMemo(() => friendUidsOf(friendships, me), [friendships, me])
  const incoming = useMemo(() => pendingIncoming(friendships, me), [friendships, me])
  const outgoing = useMemo(() => pendingOutgoing(friendships, me), [friendships, me])

  const dms = useFriendDms(user, friendUids)
  const dmOf = (uid: string) => dms.find((d) => d.friendUid === uid)

  // Activity + suggestions: one launch-history subscription set covering me
  // AND my friends, plus the request data the portal already watches.
  const games = useGamesStore((s) => s.games)
  const playsUids = useMemo(() => (me ? [me, ...friendUids] : []), [me, friendUids])
  const playsMap = usePlaysMap(playsUids)
  const { requestsMap } = useAllScopeData(games)
  const canSee = useCallback((g: Game) => canSeeGame(user, g), [user])

  const activity = useMemo(
    () => buildFriendActivity({ friendUids, playsMap, requestsMap, games, canSee, limit: 15 }),
    [friendUids, playsMap, requestsMap, games, canSee],
  )
  const suggestions = useMemo(
    () =>
      buildSuggestions({
        friendUids,
        playsMap,
        myPlays: playsMap[me] ?? [],
        games,
        canSee,
        limit: 3,
      }),
    [friendUids, playsMap, me, games, canSee],
  )
  const gameTitle = (id: string) => games.find((g) => g.id === id)?.title

  const myPresence = presence[me]
  // What you can invite someone to — the game you're in comes first.
  const invitableGames = useMemo(() => {
    const playingId = myPresence?.playing?.gameId
    return games
      .filter((g) => !g.archived && g.launchUrl && canSee(g))
      .sort((a, b) => {
        if (a.id === playingId) return -1
        if (b.id === playingId) return 1
        return a.title.localeCompare(b.title)
      })
  }, [games, canSee, myPresence?.playing?.gameId])

  const relatedUids = new Set(friendships.flatMap((f) => f.users))
  const candidates = Object.values(users).filter((u) => {
    if (u.uid === me || relatedUids.has(u.uid)) return false
    const q = search.trim().toLowerCase()
    return !q || u.displayName.toLowerCase().includes(q)
  })

  // Unread first, then online, then most recent message, then name.
  const sortedFriends = [...friendUids].sort((a, b) => {
    const ua = dmOf(a)?.unread ?? 0
    const ub = dmOf(b)?.unread ?? 0
    if (ua !== ub) return ub - ua
    const oa = presence[a]?.online ? 1 : 0
    const ob = presence[b]?.online ? 1 : 0
    if (oa !== ob) return ob - oa
    const la = dmOf(a)?.lastMessage?.createdAt ?? 0
    const lb = dmOf(b)?.lastMessage?.createdAt ?? 0
    if (la !== lb) return lb - la
    return (users[a]?.displayName ?? '').localeCompare(users[b]?.displayName ?? '')
  })

  // Conversations = friends you've actually exchanged something with.
  const conversations = dms
    .filter((d) => d.lastMessage)
    .sort((a, b) => (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0))

  const selected = selectedUid ? dmOf(selectedUid) : undefined

  // Opening a conversation marks it read. Writing `seenChats` refreshes the
  // auth user, which re-runs this with the guard now false — no loop.
  const lastAt = selected?.lastMessage?.createdAt ?? 0
  const scopeId = selected?.scopeId
  useEffect(() => {
    if (!user || !scopeId || !lastAt) return
    if ((user.seenChats?.[scopeId] ?? 0) < lastAt) {
      void backend.setSeenChat(user.uid, scopeId, lastAt)
    }
  }, [user, scopeId, lastAt])

  const totalUnread = dms.reduce((sum, d) => sum + d.unread, 0)

  if (!user) return null

  const openConversation = (uid: string) => {
    setSelectedUid(uid)
    setModalUid(null)
    setListOpen(false)
  }

  const sendInvite = (toUid: string, gameId: string) => {
    void backend.sendChatMessage(dmScopeId(me, toUid), me, inviteMessage(gameId))
    setModalUid(null)
    setInviteOpen(false)
    setSelectedUid(toUid)
  }

  const selectedProfile = selectedUid ? users[selectedUid] : undefined
  const selectedPresence = selectedUid ? presence[selectedUid] : undefined
  const selectedPlaying = selectedPresence?.online ? selectedPresence.playing : null
  const modalProfile = modalUid ? users[modalUid] : undefined

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr_260px]">
      {/* Mobile drawer toggle */}
      <button
        onClick={() => setListOpen((v) => !v)}
        className="flex items-center justify-between gap-2 rounded-lg border border-edge bg-panel px-3 py-2.5 text-sm lg:hidden"
        aria-expanded={listOpen}
      >
        <span className="min-w-0 truncate">
          <span className="text-ink-dim">Amis — </span>
          <span className="font-medium">{friendUids.length} ami(s)</span>
          {totalUnread > 0 && (
            <span className="ml-2 rounded-full bg-accent px-1.5 text-xs font-bold text-abyss">
              {totalUnread}
            </span>
          )}
        </span>
        <span className="shrink-0 text-ink-dim">{listOpen ? '▲' : '▼'}</span>
      </button>

      {/* ---------- left: friends & requests ---------- */}
      <aside className={`${listOpen ? 'block' : 'hidden'} space-y-6 lg:block`}>
        {myPresence?.playing && (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-400">
            <span>Tu joues à</span>
            <Link
              to={`/game/${myPresence.playing.gameId}`}
              className="font-semibold hover:underline"
            >
              {myPresence.playing.title}
            </Link>
            <button
              onClick={() => void setPlaying(me, null)}
              className="ml-auto rounded border border-edge px-1.5 py-0.5 text-xs text-ink-dim hover:text-ink"
            >
              J'ai fini
            </button>
          </p>
        )}

        {incoming.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold tracking-wide text-accent uppercase">
              Demandes reçues ({incoming.length})
            </h2>
            <div className="space-y-2">
              {incoming.map((f) => {
                const other = f.users[0] === me ? f.users[1] : f.users[0]
                return (
                  <div key={f.id} className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                    <div className="flex items-center gap-2">
                      <Avatar
                        user={users[other]}
                        size="sm"
                        online={presence[other]?.online ?? false}
                      />
                      <span className="min-w-0 truncate text-sm font-semibold">
                        {users[other]?.displayName ?? '???'}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => void accept(f.id)}
                        className={`${btnPrimary} flex-1 px-2 py-1 text-xs`}
                      >
                        Accepter
                      </button>
                      <button
                        onClick={() => void remove(f.id)}
                        className={`${btnGhost} flex-1 px-2 py-1 text-xs`}
                      >
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
            <p className="rounded-lg border border-dashed border-edge p-4 text-center text-sm text-ink-dim">
              Pas encore d'amis — ajoute quelqu'un depuis la liste des membres, en
              dessous.
            </p>
          ) : (
            <div className="space-y-1">
              {sortedFriends.map((uid) => {
                const p = presence[uid]
                const playing = p?.online ? p.playing : null
                const dm = dmOf(uid)
                return (
                  <button
                    key={uid}
                    onClick={() => setModalUid(uid)}
                    className="flex w-full items-center gap-2.5 rounded-md border border-transparent p-2 text-left transition hover:bg-panel-2"
                  >
                    <Avatar user={users[uid]} size="sm" online={p?.online ?? false} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {users[uid]?.displayName ?? '???'}
                      </span>
                      <span className="block truncate text-xs text-ink-dim">
                        {playing
                          ? `🎮 ${playing.title}`
                          : p?.online
                            ? 'En ligne'
                            : 'Hors ligne'}
                      </span>
                    </span>
                    {dm && dm.unread > 0 && (
                      <span className="shrink-0 rounded-full bg-accent px-1.5 text-xs font-bold text-abyss">
                        {dm.unread}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold tracking-wide text-ink-dim uppercase">
            Ajouter des amis
          </h2>
          <input
            className={`${inputCls} mb-2 text-sm`}
            placeholder="Chercher un membre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="space-y-1.5">
            {outgoing.map((f) => {
              const other = f.users[0] === me ? f.users[1] : f.users[0]
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-2 rounded-md border border-edge bg-panel/50 p-2"
                >
                  <Avatar user={users[other]} size="sm" />
                  <span className="min-w-0 truncate text-sm">
                    {users[other]?.displayName ?? '???'}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-ink-dim">En attente…</span>
                  <button
                    onClick={() => void remove(f.id)}
                    className="shrink-0 text-xs text-ink-dim hover:text-rose-400"
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
                className="flex items-center gap-2 rounded-md border border-edge bg-panel p-2"
              >
                <Avatar user={u} size="sm" online={presence[u.uid]?.online ?? false} />
                <Link
                  to={`/profile/${u.uid}`}
                  className="min-w-0 truncate text-sm font-medium hover:text-accent hover:underline"
                >
                  {u.displayName}
                </Link>
                <button
                  onClick={() => void sendRequest(me, u.uid)}
                  className="ml-auto shrink-0 rounded-md border border-accent/40 px-2 py-0.5 text-xs font-semibold text-accent transition hover:bg-accent/10"
                >
                  + Ami
                </button>
              </div>
            ))}
            {candidates.length === 0 && outgoing.length === 0 && (
              <p className="text-xs text-ink-dim">Aucun autre membre à ajouter.</p>
            )}
          </div>
        </section>
      </aside>

      {/* ---------- middle: conversations ---------- */}
      <div className="min-w-0">
        {!selectedUid || !selectedProfile ? (
          <section>
            <SectionLabel>Conversations</SectionLabel>
            {conversations.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-edge text-center text-ink-dim">
                <p className="text-4xl opacity-30">💬</p>
                <p className="mt-3 px-6 text-sm">
                  {friendUids.length === 0
                    ? 'Ajoute un ami pour lui écrire.'
                    : 'Aucune conversation — ouvre la fiche d’un ami pour lui écrire.'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {conversations.map((dm) => {
                  const last = dm.lastMessage!
                  return (
                    <button
                      key={dm.scopeId}
                      onClick={() => openConversation(dm.friendUid)}
                      className="flex w-full items-center gap-3 rounded-lg border border-edge bg-panel p-3 text-left transition hover:border-accent/50"
                    >
                      <Avatar
                        user={users[dm.friendUid]}
                        online={presence[dm.friendUid]?.online ?? false}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="min-w-0 truncate font-medium">
                            {users[dm.friendUid]?.displayName ?? '???'}
                          </span>
                          <span className="ml-auto shrink-0 text-xs text-ink-dim">
                            {relativeTime(last.createdAt)}
                          </span>
                        </span>
                        <span
                          className={`block truncate text-sm ${
                            dm.unread > 0 ? 'font-medium text-ink' : 'text-ink-dim'
                          }`}
                        >
                          {previewOf(
                            last.text,
                            last.authorUid === me,
                            gameTitle(parseInvite(last.text) ?? ''),
                          )}
                        </span>
                      </span>
                      {dm.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-accent px-1.5 text-xs font-bold text-abyss">
                          {dm.unread}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-panel px-3 py-2.5">
              <button
                onClick={() => setModalUid(selectedUid)}
                className="flex min-w-0 items-center gap-3 text-left"
                title="Voir la fiche"
              >
                <Avatar user={selectedProfile} online={selectedPresence?.online ?? false} />
                <span className="min-w-0">
                  <span className="block truncate font-display font-semibold">
                    {selectedProfile.displayName}
                  </span>
                  <span className="block text-xs text-ink-dim">
                    {selectedPlaying ? (
                      <span className="text-emerald-400">🎮 {selectedPlaying.title}</span>
                    ) : selectedPresence?.online ? (
                      'En ligne'
                    ) : (
                      'Hors ligne'
                    )}
                  </span>
                </span>
              </button>

              <div className="ml-auto flex items-center gap-2">
                {/* The point of seeing "playing" at all: go join them. */}
                {selectedPlaying && (
                  <Link
                    to={`/game/${selectedPlaying.gameId}`}
                    className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400"
                  >
                    ▶ Rejoindre
                  </Link>
                )}

                <button
                  onClick={() => setSelectedUid(null)}
                  className="text-xs text-ink-dim transition hover:text-ink"
                  title="Revenir aux conversations"
                >
                  ← Conversations
                </button>

                {/* Invite: an ordinary DM carrying an invite marker, so it
                    rides the existing unread + notification path. */}
                <div className="relative">
                  <button
                    onClick={() => setInviteOpen((v) => !v)}
                    className={`${btnGhost} px-2.5 py-1.5 text-xs`}
                  >
                    🎮 Inviter
                  </button>
                  {inviteOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setInviteOpen(false)} />
                      <div className="absolute right-0 z-50 mt-2 max-h-72 w-60 overflow-y-auto rounded-lg border border-edge bg-panel py-1 shadow-2xl">
                        {invitableGames.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-ink-dim">
                            Aucun jeu à proposer.
                          </p>
                        ) : (
                          invitableGames.map((g) => (
                            <button
                              key={g.id}
                              onClick={() => sendInvite(selectedUid, g.id)}
                              className="block w-full truncate px-3 py-2 text-left text-sm transition hover:bg-panel-2"
                            >
                              {g.id === myPresence?.playing?.gameId && (
                                <span className="text-emerald-400">▶ </span>
                              )}
                              {g.title}
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <ChatChannel
              key={selectedUid}
              scopeId={dmScopeId(me, selectedUid)}
              placeholder={`Message privé à ${selectedProfile.displayName}…`}
            />
          </>
        )}
      </div>

      {/* ---------- right: discovery & activity ---------- */}
      <aside className="min-w-0 space-y-6">
        {suggestions.length > 0 && (
          <section>
            <SectionLabel>Ils y jouent, pas toi</SectionLabel>
            <div className="space-y-1.5">
              {suggestions.map(({ game, friendUids: who }) => (
                <Link
                  key={game.id}
                  to={`/game/${game.id}`}
                  className="flex items-center gap-2 rounded-md border border-edge bg-panel p-2 transition hover:border-accent/50"
                >
                  <div
                    className="aspect-video w-14 shrink-0 rounded border border-edge bg-cover bg-center"
                    style={
                      game.coverUrl
                        ? { backgroundImage: `url(${game.coverUrl})` }
                        : { background: coverFallback(game.id) }
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{game.title}</p>
                    <p className="truncate text-xs text-ink-dim">
                      {who.length === 1
                        ? `${users[who[0]]?.displayName ?? '???'} y joue`
                        : `${who.length} amis y jouent`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionLabel>Activité de tes amis</SectionLabel>
          {activity.length === 0 ? (
            <p className="rounded-lg border border-dashed border-edge p-4 text-center text-xs text-ink-dim">
              Rien pour l'instant.
            </p>
          ) : (
            <div className="space-y-1">
              {activity.map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs transition hover:bg-panel-2"
                >
                  <Avatar user={users[item.uid]} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">
                      {users[item.uid]?.displayName ?? '???'}
                    </span>{' '}
                    {item.kind === 'play' && (
                      <>
                        a joué à <span className="text-emerald-400">{item.gameTitle}</span>
                      </>
                    )}
                    {item.kind === 'publish' && (
                      <>
                        a publié <span className="text-accent">{item.gameTitle}</span> 🚀
                      </>
                    )}
                    {item.kind === 'request' && (
                      <>
                        {item.requestType === 'bug'
                          ? 'a signalé un bug sur '
                          : 'a proposé une feature sur '}
                        <span className="text-ink">{item.gameTitle}</span>
                      </>
                    )}
                    <span className="mt-0.5 block text-[11px] text-ink-dim">
                      {relativeTime(item.at)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </aside>

      {modalUid && modalProfile && (
        <FriendModal
          profile={modalProfile}
          presence={presence[modalUid]}
          lastPlay={playsMap[modalUid]?.[0]}
          games={games}
          invitableGames={invitableGames}
          playingGameId={myPresence?.playing?.gameId}
          onClose={() => setModalUid(null)}
          onMessage={() => openConversation(modalUid)}
          onInvite={(gameId) => sendInvite(modalUid, gameId)}
          onRemove={() => {
            void remove(friendshipId(me, modalUid))
            if (selectedUid === modalUid) setSelectedUid(null)
            setModalUid(null)
          }}
        />
      )}
    </div>
  )
}
