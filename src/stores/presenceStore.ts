import { create } from 'zustand'
import { backend } from '../lib/backend'
import type { Game, PresenceInfo } from '../lib/types'

interface PresenceState {
  presence: Record<string, PresenceInfo>
  init: () => void
  /** Declarative "I'm playing X" status. */
  setPlaying: (uid: string, game: Game | null) => Promise<void>
  /**
   * Web game: posts an ephemeral "playing" status, then opens the game.
   * Downloadable game: just opens the download page (declare playing
   * manually from the game page).
   */
  launchGame: (uid: string | undefined, game: Game) => Promise<void>
}

let initialized = false

export const usePresenceStore = create<PresenceState>((set) => ({
  presence: {},
  init: () => {
    if (initialized) return
    initialized = true
    backend.watchPresence((presence) => set({ presence }))
  },
  setPlaying: (uid, game) =>
    backend.setPlaying(
      uid,
      game ? { gameId: game.id, title: game.title, since: Date.now() } : null,
    ),
  launchGame: async (uid, game) => {
    if (uid && game.kind === 'web') {
      await backend.setPlaying(uid, { gameId: game.id, title: game.title, since: Date.now() })
    }
    window.open(game.launchUrl, '_blank', 'noopener')
  },
}))
