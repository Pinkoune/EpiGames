import { create } from 'zustand'
import { backend } from '../lib/backend'
import type { NewGameInput } from '../lib/backend/types'
import type { Game, UserProfile } from '../lib/types'

interface GamesState {
  games: Game[]
  loaded: boolean
  init: () => void
  addGame: (input: NewGameInput, createdBy: string, approved: boolean) => Promise<string>
  updateGame: (
    gameId: string,
    patch: Partial<Omit<Game, 'id' | 'createdBy' | 'createdAt'>>,
  ) => Promise<void>
  approveGame: (gameId: string, approved: boolean) => Promise<void>
  setArchived: (gameId: string, archived: boolean) => Promise<void>
  deleteGame: (gameId: string) => Promise<void>
}

let initialized = false

export const useGamesStore = create<GamesState>((set) => ({
  games: [],
  loaded: false,
  init: () => {
    if (initialized) return
    initialized = true
    backend.watchGames((games) => set({ games, loaded: true }))
  },
  addGame: (input, createdBy, approved) => backend.addGame(input, createdBy, approved),
  updateGame: (gameId, patch) => backend.updateGame(gameId, patch),
  approveGame: (gameId, approved) => backend.approveGame(gameId, approved),
  setArchived: (gameId, archived) => backend.updateGame(gameId, { archived }),
  deleteGame: (gameId) => backend.deleteGame(gameId),
}))

export function canEditGame(user: UserProfile | null, game: Game): boolean {
  if (!user) return false
  return user.isAdmin || game.ownerUids.includes(user.uid)
}

/** Unapproved games are only listed for their owners and admins. */
export function canSeeGame(user: UserProfile | null, game: Game): boolean {
  if (game.approved) return true
  return canEditGame(user, game)
}
