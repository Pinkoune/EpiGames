/**
 * Friend activity feed and game suggestions — both DERIVED from data the
 * portal already watches (launch history, games, requests). No activity
 * collection, no denormalized feed to keep in sync: same approach as the
 * meta-achievements and the notifications digest.
 */

import type { Game, GameRequest, PlayEntry, RequestType } from './types'
import { PORTAL_SCOPE } from './types'

export type ActivityKind = 'play' | 'publish' | 'request'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  /** Friend who did it. */
  uid: string
  at: number
  gameId: string
  gameTitle: string
  /** Set when kind === 'request'. */
  requestTitle?: string
  requestType?: RequestType
  /** Route to open on click. */
  to: string
}

export interface ActivityInput {
  friendUids: string[]
  /** uid -> launch history (newest first). */
  playsMap: Record<string, PlayEntry[]>
  /** scopeId -> requests. */
  requestsMap: Record<string, GameRequest[]>
  games: Game[]
  /** Only surface games the viewer is allowed to see. */
  canSee: (game: Game) => boolean
  limit?: number
}

export function buildFriendActivity({
  friendUids,
  playsMap,
  requestsMap,
  games,
  canSee,
  limit = 30,
}: ActivityInput): ActivityItem[] {
  const friends = new Set(friendUids)
  const gameById = new Map(games.map((g) => [g.id, g]))
  const visible = (gameId: string): Game | undefined => {
    const g = gameById.get(gameId)
    return g && !g.archived && canSee(g) ? g : undefined
  }

  const items: ActivityItem[] = []

  // ---- launches ----
  // A member re-launching the same game shouldn't flood the feed: keep only
  // their most recent launch per game (histories come newest-first).
  for (const uid of friendUids) {
    const seen = new Set<string>()
    for (const play of playsMap[uid] ?? []) {
      if (seen.has(play.gameId)) continue
      seen.add(play.gameId)
      const game = visible(play.gameId)
      if (!game) continue
      items.push({
        id: `play:${uid}:${play.id}`,
        kind: 'play',
        uid,
        at: play.at,
        gameId: game.id,
        gameTitle: game.title,
        to: `/game/${game.id}`,
      })
    }
  }

  // ---- published games ----
  for (const game of games) {
    if (!game.approved || game.archived || !canSee(game)) continue
    const owner = game.ownerUids.find((uid) => friends.has(uid))
    if (!owner) continue
    items.push({
      id: `publish:${game.id}`,
      kind: 'publish',
      uid: owner,
      at: game.createdAt,
      gameId: game.id,
      gameTitle: game.title,
      to: `/game/${game.id}`,
    })
  }

  // ---- bugs & features ----
  for (const [scopeId, requests] of Object.entries(requestsMap)) {
    const isPortal = scopeId === PORTAL_SCOPE
    const game = isPortal ? undefined : visible(scopeId)
    if (!isPortal && !game) continue
    for (const r of requests) {
      if (!friends.has(r.authorUid)) continue
      items.push({
        id: `request:${scopeId}:${r.id}`,
        kind: 'request',
        uid: r.authorUid,
        at: r.createdAt,
        gameId: scopeId,
        gameTitle: isPortal ? 'le portail' : (game?.title ?? '?'),
        requestTitle: r.title,
        requestType: r.type,
        to: isPortal ? '/forum' : `/game/${scopeId}`,
      })
    }
  }

  return items.sort((a, b) => b.at - a.at).slice(0, limit)
}

export interface Suggestion {
  game: Game
  /** Friends who have played it (most recent first). */
  friendUids: string[]
  lastAt: number
}

/**
 * "Your friends play these, you don't yet." Games at least one friend has
 * launched that the viewer never has.
 */
export function buildSuggestions({
  friendUids,
  playsMap,
  myPlays,
  games,
  canSee,
  limit = 4,
}: {
  friendUids: string[]
  playsMap: Record<string, PlayEntry[]>
  myPlays: PlayEntry[]
  games: Game[]
  canSee: (game: Game) => boolean
  limit?: number
}): Suggestion[] {
  const mine = new Set(myPlays.map((p) => p.gameId))
  const gameById = new Map(games.map((g) => [g.id, g]))
  const byGame = new Map<string, { friendUids: string[]; lastAt: number }>()

  for (const uid of friendUids) {
    for (const play of playsMap[uid] ?? []) {
      if (mine.has(play.gameId)) continue
      const entry = byGame.get(play.gameId) ?? { friendUids: [], lastAt: 0 }
      if (!entry.friendUids.includes(uid)) entry.friendUids.push(uid)
      entry.lastAt = Math.max(entry.lastAt, play.at)
      byGame.set(play.gameId, entry)
    }
  }

  const suggestions: Suggestion[] = []
  for (const [gameId, entry] of byGame) {
    const game = gameById.get(gameId)
    if (!game || game.archived || !canSee(game)) continue
    suggestions.push({ game, ...entry })
  }

  // Most friends first, then most recently played.
  return suggestions
    .sort((a, b) => b.friendUids.length - a.friendUids.length || b.lastAt - a.lastAt)
    .slice(0, limit)
}
