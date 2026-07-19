import type {
  ChatMessage,
  Friendship,
  Game,
  GameRequest,
  PlayingStatus,
  PresenceInfo,
  RequestComment,
  RequestStatus,
  UserProfile,
} from '../types'

export type Unsubscribe = () => void

export interface NewGameInput {
  title: string
  tagline: string
  description: string
  coverUrl: string
  screenshots: string[]
  kind: Game['kind']
  launchUrl: string
  repoUrl: string
  status: Game['status']
  tags: string[]
  ownerUids: string[]
}

export interface NewRequestInput {
  type: GameRequest['type']
  title: string
  description: string
}

/**
 * Single contract both implementations honor.
 * Stores only ever talk to this interface — never to Firebase directly —
 * so the localStorage fallback is a full implementation, not a degraded mode.
 */
export interface Backend {
  readonly mode: 'firebase' | 'local'

  // ---- auth / profile ----
  /** Fires with the signed-in user's profile (kept in sync) or null. */
  onAuthChanged(cb: (user: UserProfile | null) => void): Unsubscribe
  signInEmail(email: string, password: string): Promise<void>
  signUpEmail(email: string, password: string, displayName: string): Promise<void>
  signInGoogle(): Promise<void>
  /** Local mode only: instant pseudo-based session. */
  signInLocal(displayName: string): Promise<void>
  signOut(): Promise<void>
  updateProfile(
    uid: string,
    patch: Partial<Pick<UserProfile, 'displayName' | 'avatar' | 'bio'>>,
  ): Promise<void>
  /** Dismiss a game's update announcement ("j'ai vu") for this user. */
  setSeenUpdate(uid: string, gameId: string, publishedAt: number): Promise<void>

  // ---- users (small trusted group: watch them all) ----
  watchUsers(cb: (users: UserProfile[]) => void): Unsubscribe
  /** Admin only (enforced by rules): grant/revoke the admin role. */
  setUserFlags(uid: string, flags: Partial<Pick<UserProfile, 'isAdmin'>>): Promise<void>

  // ---- games ----
  watchGames(cb: (games: Game[]) => void): Unsubscribe
  /** `approved` = admin creating directly; devs submit with approved=false. */
  addGame(input: NewGameInput, createdBy: string, approved: boolean): Promise<string>
  /** Admin only (enforced by rules): publish/unpublish a submitted game. */
  approveGame(gameId: string, approved: boolean): Promise<void>
  updateGame(
    gameId: string,
    patch: Partial<Omit<Game, 'id' | 'createdBy' | 'createdAt'>>,
  ): Promise<void>
  deleteGame(gameId: string): Promise<void>

  // ---- requests ----
  watchRequests(gameId: string, cb: (requests: GameRequest[]) => void): Unsubscribe
  addRequest(gameId: string, input: NewRequestInput, authorUid: string): Promise<string>
  updateRequestContent(
    gameId: string,
    requestId: string,
    patch: Partial<Pick<GameRequest, 'title' | 'description'>>,
  ): Promise<void>
  setRequestStatus(gameId: string, requestId: string, status: RequestStatus): Promise<void>
  toggleUpvote(gameId: string, requestId: string, uid: string, on: boolean): Promise<void>
  deleteRequest(gameId: string, requestId: string): Promise<void>

  // ---- comments ----
  watchComments(
    gameId: string,
    requestId: string,
    cb: (comments: RequestComment[]) => void,
  ): Unsubscribe
  addComment(gameId: string, requestId: string, authorUid: string, text: string): Promise<void>
  deleteComment(gameId: string, requestId: string, commentId: string): Promise<void>

  // ---- forum chat ("Général" channels; scope = PORTAL_SCOPE or a gameId) ----
  watchChat(scopeId: string, cb: (messages: ChatMessage[]) => void): Unsubscribe
  sendChatMessage(scopeId: string, authorUid: string, text: string): Promise<void>
  deleteChatMessage(scopeId: string, messageId: string): Promise<void>

  // ---- friendships ----
  /** All friendships involving `uid` (pending + accepted). */
  watchFriendships(uid: string, cb: (friendships: Friendship[]) => void): Unsubscribe
  sendFriendRequest(fromUid: string, toUid: string): Promise<void>
  acceptFriendRequest(friendshipId: string): Promise<void>
  /** Decline a pending request or remove an accepted friend. */
  removeFriendship(friendshipId: string): Promise<void>

  // ---- presence ----
  watchPresence(cb: (presence: Record<string, PresenceInfo>) => void): Unsubscribe
  /** Marks `uid` online and installs the disconnect cleanup. */
  goOnline(uid: string): void
  goOffline(uid: string): void
  setPlaying(uid: string, playing: PlayingStatus | null): Promise<void>
}
