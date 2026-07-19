import { create } from 'zustand'
import { backend } from '../lib/backend'
import type { Unsubscribe } from '../lib/backend/types'
import type { Friendship } from '../lib/types'

interface FriendsState {
  friendships: Friendship[]
  /** (Re)subscribe for the signed-in uid; call with null on sign-out. */
  watch: (uid: string | null) => void
  sendRequest: (fromUid: string, toUid: string) => Promise<void>
  accept: (friendshipId: string) => Promise<void>
  remove: (friendshipId: string) => Promise<void>
}

let unsub: Unsubscribe | null = null
let watchedUid: string | null = null

export const useFriendsStore = create<FriendsState>((set) => ({
  friendships: [],
  watch: (uid) => {
    if (uid === watchedUid) return
    watchedUid = uid
    unsub?.()
    unsub = null
    if (!uid) {
      set({ friendships: [] })
      return
    }
    unsub = backend.watchFriendships(uid, (friendships) => set({ friendships }))
  },
  sendRequest: (fromUid, toUid) => backend.sendFriendRequest(fromUid, toUid),
  accept: (id) => backend.acceptFriendRequest(id),
  remove: (id) => backend.removeFriendship(id),
}))

export function friendUidsOf(friendships: Friendship[], me: string): string[] {
  return friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (f.users[0] === me ? f.users[1] : f.users[0]))
}

export function pendingIncoming(friendships: Friendship[], me: string): Friendship[] {
  return friendships.filter((f) => f.status === 'pending' && f.requestedBy !== me)
}

export function pendingOutgoing(friendships: Friendship[], me: string): Friendship[] {
  return friendships.filter((f) => f.status === 'pending' && f.requestedBy === me)
}
