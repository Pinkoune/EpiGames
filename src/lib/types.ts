export type GameStatus = 'live' | 'dev' | 'planned' | 'paused'
export type GameKind = 'web' | 'download' | 'embedded'
export type RequestType = 'bug' | 'feature'
export type RequestStatus = 'open' | 'planned' | 'in_progress' | 'done' | 'rejected'
export type FriendshipStatus = 'pending' | 'accepted'

export interface UserProfile {
  uid: string
  displayName: string
  /** Emoji avatar (or later: URL). Kept simple, no file storage needed. */
  avatar: string
  bio: string
  /**
   * Only ever set by an existing admin or the Firebase console.
   * Security rules forbid a user writing this on their own doc.
   * Admins manage roles, publish submitted games, and can hard-delete.
   * (Any member can SUBMIT a game — publication needs an admin.)
   */
  isAdmin: boolean
  createdAt: number
  /**
   * gameId -> publishedAt of the last game update this user dismissed
   * ("j'ai vu") — the update banner/badge stays until then.
   */
  seenUpdates: Record<string, number>
  /**
   * Phase 2 (SSO) reservation: external uids (from a game's own Firebase
   * project) that map back to this Epigames account. Always [] in phase 1.
   */
  linkedUids: string[]
  /** Avatar ring preset id (see lib/profileCustomization.ts), 'none' = plain. */
  profileFrame: string
  /**
   * Profile page banner: a preset id (see lib/profileCustomization.ts) or,
   * like avatar/coverUrl, a direct image URL pasted by the user.
   */
  profileBackground: string
}

/** Announcement a game owner publishes when they ship an update. */
export interface GameUpdate {
  version: string
  /** Markdown release note. */
  text: string
  publishedAt: number
}

export interface Game {
  id: string
  title: string
  tagline: string
  /** Long description shown on the game page (plain text, paragraphs kept). */
  description: string
  /** Cover image URL; empty string -> generated gradient fallback. */
  coverUrl: string
  /** Screenshot image URLs for the game page gallery. */
  screenshots: string[]
  /**
   * web: hosted game, "Jouer" opens launchUrl in a new tab.
   * download: installable (e.g. Chrome extension), "Télécharger" opens
   * launchUrl (typically a GitHub releases page).
   * embedded: playable directly on the portal — launchUrl is loaded in an
   * iframe (itch.io style). An optional downloadUrl adds a download button.
   */
  kind: GameKind
  /** External launch / embed / download URL — the portal never hosts games. */
  launchUrl: string
  /**
   * Optional download link shown BELOW the play button for embedded games
   * (the dev may let players grab a standalone build). Empty = no button.
   */
  downloadUrl: string
  /** Source repository URL (optional). */
  repoUrl: string
  status: GameStatus
  tags: string[]
  /** Devs who own this game; any of them can edit it and triage its requests. */
  ownerUids: string[]
  /** Latest update announcement (one at a time; null = none). */
  update: GameUpdate | null
  /**
   * Submission workflow: games created by a dev start unapproved and are
   * only listed for their owners + admins until an admin publishes them.
   * Only admins can flip this flag (enforced by rules).
   */
  approved: boolean
  archived: boolean
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface GameRequest {
  id: string
  gameId: string
  type: RequestType
  title: string
  description: string
  status: RequestStatus
  authorUid: string
  /** uid -> true. Rules restrict each user to toggling their own key. */
  upvotes: Record<string, true>
  createdAt: number
  updatedAt: number
}

/**
 * Forum scope: PORTAL_SCOPE for portal-wide threads, or a gameId.
 * Portal bug/feature requests reuse the whole request machinery under this
 * sentinel scope (games/_portal/requests in Firestore — parent doc never
 * exists, rules special-case it: triage is admin-only).
 */
export const PORTAL_SCOPE = '_portal'

/** One message in a "Général" chat channel (portal-wide or per game). */
export interface ChatMessage {
  id: string
  authorUid: string
  text: string
  createdAt: number
}

export interface RequestComment {
  id: string
  authorUid: string
  text: string
  createdAt: number
}

export type AchievementStatus = 'pending' | 'approved' | 'rejected'

/**
 * A dev-defined achievement for a game, reviewed by admins Merge-Request style:
 * the owner proposes it (status 'pending'), admins discuss it in the comment
 * thread and the owner can edit the proposal in place, until an admin approves
 * or rejects it. Once 'approved' it becomes an official achievement of the game
 * that players unlock on the honor system (`unlockedBy`, like request upvotes).
 */
export interface GameAchievement {
  id: string
  gameId: string
  icon: string
  title: string
  description: string
  status: AchievementStatus
  /** uid -> true. Members toggle only their own key (honor unlock). */
  unlockedBy: Record<string, true>
  createdBy: string
  createdAt: number
  updatedAt: number
}

/** GitHub-style: an achievement proposal is "closed" once approved or rejected. */
export function isAchievementReviewed(status: AchievementStatus): boolean {
  return status === 'approved' || status === 'rejected'
}

export interface Friendship {
  /** Deterministic id: sorted pair "uidA_uidB" -> one doc max per pair. */
  id: string
  users: [string, string]
  requestedBy: string
  status: FriendshipStatus
  createdAt: number
}

export interface PlayingStatus {
  gameId: string
  title: string
  since: number
}

/**
 * One "I launched a game" record — logged at launch time (a moment we
 * control), so history stays accurate even when a session ends by the tab
 * simply closing (which runs no client code). Duration is deliberately not
 * tracked: it can't be captured reliably for external games.
 */
export interface PlayEntry {
  id: string
  gameId: string
  title: string
  at: number
}

export interface PresenceInfo {
  online: boolean
  lastSeen: number
  playing: PlayingStatus | null
}

export function friendshipId(a: string, b: string): string {
  return [a, b].sort().join('_')
}

/** True while the game has an update announcement the user hasn't dismissed. */
export function hasUnseenUpdate(user: UserProfile | null, game: Game): boolean {
  if (!game.update || !user) return false
  return (user.seenUpdates[game.id] ?? 0) < game.update.publishedAt
}

/** GitHub-style: a request is "closed" when done or rejected. */
export function isRequestClosed(status: RequestStatus): boolean {
  return status === 'done' || status === 'rejected'
}

/**
 * Fill defaults for fields added after initial launch, so docs written by
 * older versions (or hand-created) never break the UI.
 */
export function normalizeGame(raw: Partial<Game> & { id: string }): Game {
  return {
    title: '',
    tagline: '',
    description: '',
    coverUrl: '',
    screenshots: [],
    kind: 'web',
    launchUrl: '',
    downloadUrl: '',
    repoUrl: '',
    status: 'dev',
    tags: [],
    ownerUids: [],
    update: null,
    // Legacy docs predate the approval workflow -> treat as published.
    approved: true,
    archived: false,
    createdBy: '',
    createdAt: 0,
    updatedAt: 0,
    ...raw,
  }
}

export function normalizeUser(raw: Partial<UserProfile> & { uid: string }): UserProfile {
  return {
    displayName: '',
    avatar: '🎮',
    bio: '',
    isAdmin: false,
    createdAt: 0,
    seenUpdates: {},
    linkedUids: [],
    profileFrame: 'none',
    profileBackground: 'none',
    ...raw,
  }
}

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  live: 'Live',
  dev: 'En développement',
  planned: 'Planifié',
  paused: 'En pause',
}

export const GAME_KIND_LABELS: Record<GameKind, string> = {
  web: 'Jeu web',
  download: 'Téléchargeable',
  embedded: 'Jouable sur le portail',
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  open: 'Ouvert',
  planned: 'Planifié',
  in_progress: 'En cours',
  done: 'Fait',
  rejected: 'Refusé',
}
