import { create } from 'zustand'
import { backend } from '../lib/backend'
import { setOpenedGameWindow } from '../lib/gameBridge'
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
   * Embedded game: posts the status but opens nothing — the game runs in an
   * iframe on the portal, so the page handles rendering it.
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
    if (uid && (game.kind === 'web' || game.kind === 'embedded')) {
      await backend.setPlaying(uid, { gameId: game.id, title: game.title, since: Date.now() })
    }
    // Embedded games render in-page (iframe); everything else opens externally.
    if (game.kind !== 'embedded') {
      // `noopener` is the safe default, but it also severs `window.opener` —
      // the only back-channel a game in another tab has. Drop it ONLY for
      // games that opted into the bridge (our own, declared by an owner).
      const win = game.bridge
        ? window.open(game.launchUrl, '_blank')
        : window.open(game.launchUrl, '_blank', 'noopener')
      if (game.bridge) setOpenedGameWindow(win)
    }
  },
}))
