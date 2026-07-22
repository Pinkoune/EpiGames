import { useEffect, useMemo, useRef } from 'react'
import { useFriendDms } from './hooks'
import { parseInvite } from './types'
import { useAuthStore } from '../stores/authStore'
import { friendUidsOf, pendingIncoming, useFriendsStore } from '../stores/friendsStore'
import { useGamesStore } from '../stores/gamesStore'
import { usePresenceStore } from '../stores/presenceStore'
import { useToastStore } from '../stores/toastStore'
import { useUsersStore } from '../stores/usersStore'

/**
 * Turns changes in already-watched data (presence, DMs, friend requests) into
 * transient toast bubbles. Mounted once in Shell.
 *
 * The whole difficulty here is NOT firing on load: every store fills in over
 * several snapshots, so a naive diff would announce "X is online" for everyone
 * the moment you sign in. Two guards handle it:
 *  1. a quiet period after mount — nothing is announced while the stores settle;
 *  2. per-source baselines captured on the first run, so only genuine
 *     transitions after that point produce a bubble.
 */
const QUIET_MS = 4000

export function useFriendEvents(): void {
  const user = useAuthStore((s) => s.user)
  const friendships = useFriendsStore((s) => s.friendships)
  const presence = usePresenceStore((s) => s.presence)
  const users = useUsersStore((s) => s.users)
  const games = useGamesStore((s) => s.games)
  const push = useToastStore((s) => s.push)

  const myUid = user?.uid
  const friendUids = useMemo(
    () => (myUid ? friendUidsOf(friendships, myUid) : []),
    [friendships, myUid],
  )
  const dms = useFriendDms(user, friendUids)

  const mountedAt = useRef(Date.now())
  const settled = () => Date.now() - mountedAt.current > QUIET_MS

  // Latest values, so the effects below can read them without re-running.
  const nameOf = (uid: string) => users[uid]?.displayName ?? 'Un ami'
  const latest = useRef({ nameOf, push, games })
  latest.current = { nameOf, push, games }

  // ---- presence: came online / started playing ----
  const prevPresence = useRef<Record<string, { online: boolean; playingId: string | null }> | null>(
    null,
  )
  useEffect(() => {
    const snapshot: Record<string, { online: boolean; playingId: string | null }> = {}
    for (const uid of friendUids) {
      const p = presence[uid]
      snapshot[uid] = {
        online: Boolean(p?.online),
        playingId: p?.online ? (p.playing?.gameId ?? null) : null,
      }
    }
    const prev = prevPresence.current
    prevPresence.current = snapshot
    if (!prev || !settled()) return

    for (const uid of friendUids) {
      const now = snapshot[uid]
      const before = prev[uid]
      // No baseline for this friend yet (just added) — start tracking silently.
      if (!before) continue

      if (!before.online && now.online) {
        latest.current.push({
          avatarUid: uid,
          title: `${latest.current.nameOf(uid)} est en ligne`,
          to: `/profile/${uid}`,
        })
      }
      if (now.playingId && now.playingId !== before.playingId) {
        const title = latest.current.games.find((g) => g.id === now.playingId)?.title
        latest.current.push({
          avatarUid: uid,
          title: `${latest.current.nameOf(uid)} joue`,
          body: title ?? undefined,
          to: `/game/${now.playingId}`,
        })
      }
    }
  }, [presence, friendUids])

  // ---- private messages & invites ----
  // Keyed on message id: a bubble must never repeat if the list re-renders.
  const toasted = useRef(new Set<string>())
  useEffect(() => {
    if (!myUid || !settled()) return
    for (const dm of dms) {
      const last = dm.lastMessage
      if (!last || last.authorUid === myUid) continue
      // Only messages that arrived while this session was open.
      if (last.createdAt <= mountedAt.current) continue
      if (toasted.current.has(last.id)) continue
      toasted.current.add(last.id)

      const invitedGameId = parseInvite(last.text)
      if (invitedGameId) {
        const title = latest.current.games.find((g) => g.id === invitedGameId)?.title
        latest.current.push({
          avatarUid: dm.friendUid,
          title: `${latest.current.nameOf(dm.friendUid)} t'invite à jouer`,
          body: title ?? undefined,
          to: `/game/${invitedGameId}`,
        })
      } else {
        latest.current.push({
          avatarUid: dm.friendUid,
          title: latest.current.nameOf(dm.friendUid),
          body: last.text,
          to: '/friends',
        })
      }
    }
  }, [dms, myUid])

  // ---- incoming friend requests ----
  const prevRequests = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!myUid) return
    const incoming = pendingIncoming(friendships, myUid)
    const ids = new Set(incoming.map((f) => f.id))
    const prev = prevRequests.current
    prevRequests.current = ids
    if (!prev || !settled()) return

    for (const f of incoming) {
      if (prev.has(f.id)) continue
      const other = f.users[0] === myUid ? f.users[1] : f.users[0]
      latest.current.push({
        icon: '👥',
        avatarUid: other,
        title: `${latest.current.nameOf(other)} veut être ton ami`,
        body: 'Demande en attente',
        to: '/friends',
      })
    }
  }, [friendships, myUid])
}
