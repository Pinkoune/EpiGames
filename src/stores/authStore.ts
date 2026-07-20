import { create } from 'zustand'
import { backend } from '../lib/backend'
import type { UserProfile } from '../lib/types'

interface AuthState {
  user: UserProfile | null
  /** true until the first auth callback fires */
  loading: boolean
  error: string | null
  init: () => void
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (email: string, password: string, displayName: string) => Promise<void>
  signInGoogle: () => Promise<void>
  signInLocal: (displayName: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (
    patch: Partial<
      Pick<UserProfile, 'displayName' | 'avatar' | 'bio' | 'profileFrame' | 'profileBackground'>
    >,
  ) => Promise<void>
  clearError: () => void
}

let initialized = false

async function run(set: (s: Partial<AuthState>) => void, fn: () => Promise<void>) {
  set({ error: null })
  try {
    await fn()
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) })
    throw e
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,

  init: () => {
    if (initialized) return
    initialized = true
    let lastOnlineUid: string | null = null
    backend.onAuthChanged((user) => {
      set({ user, loading: false })
      if (user && user.uid !== lastOnlineUid) {
        lastOnlineUid = user.uid
        backend.goOnline(user.uid)
      }
      if (!user) lastOnlineUid = null
    })
  },

  signInEmail: (email, password) => run(set, () => backend.signInEmail(email, password)),
  signUpEmail: (email, password, name) => run(set, () => backend.signUpEmail(email, password, name)),
  signInGoogle: () => run(set, () => backend.signInGoogle()),
  signInLocal: (name) => run(set, () => backend.signInLocal(name)),
  signOut: () => run(set, () => backend.signOut()),

  updateProfile: async (patch) => {
    const { user } = get()
    if (!user) return
    await run(set, () => backend.updateProfile(user.uid, patch))
  },

  clearError: () => set({ error: null }),
}))
