import { create } from 'zustand'
import { backend } from '../lib/backend'
import type { UserProfile } from '../lib/types'

interface UsersState {
  users: Record<string, UserProfile>
  init: () => void
  setUserFlags: (uid: string, flags: Partial<Pick<UserProfile, 'isAdmin'>>) => Promise<void>
}

let initialized = false

/** Directory of all member profiles (small trusted group — watch them all). */
export const useUsersStore = create<UsersState>((set) => ({
  users: {},
  init: () => {
    if (initialized) return
    initialized = true
    backend.watchUsers((list) => {
      set({ users: Object.fromEntries(list.map((u) => [u.uid, u])) })
    })
  },
  setUserFlags: (uid, flags) => backend.setUserFlags(uid, flags),
}))

export function displayNameOf(users: Record<string, UserProfile>, uid: string): string {
  return users[uid]?.displayName ?? '???'
}
