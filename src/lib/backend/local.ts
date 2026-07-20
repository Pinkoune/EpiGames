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
import { friendshipId, normalizeGame, normalizeUser } from '../types'
import type { Backend, NewGameInput, NewRequestInput, Unsubscribe } from './types'

/**
 * Full localStorage implementation of the Backend contract.
 * Used when Firebase is not configured, so the whole app can be
 * developed and tested without any cloud account.
 *
 * - Data lives in localStorage (shared across tabs -> storage events give
 *   us cross-tab "realtime" for free).
 * - The signed-in uid lives in sessionStorage (per-tab), so two tabs can be
 *   two different users — handy for testing friends/presence flows.
 * - Presence uses a heartbeat timestamp: online = fresh heartbeat.
 */

const DB_KEY = 'epigames:db'
const PRESENCE_KEY = 'epigames:presence'
const SESSION_KEY = 'epigames:session'
const HEARTBEAT_MS = 15_000
const ONLINE_THRESHOLD_MS = 45_000

interface LocalDb {
  users: UserProfile[]
  games: Game[]
  /** gameId -> requests */
  requests: Record<string, GameRequest[]>
  /** `${gameId}/${requestId}` -> comments */
  comments: Record<string, RequestComment[]>
  /** scopeId (PORTAL_SCOPE | gameId) -> chat messages */
  chats: Record<string, ChatMessage[]>
  friendships: Friendship[]
}

const EMPTY_DB: LocalDb = {
  users: [],
  games: [],
  requests: {},
  comments: {},
  chats: {},
  friendships: [],
}

function loadDb(): LocalDb {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) return structuredClone(EMPTY_DB)
    return { ...structuredClone(EMPTY_DB), ...JSON.parse(raw) }
  } catch {
    return structuredClone(EMPTY_DB)
  }
}

function loadPresence(): Record<string, PresenceInfo> {
  try {
    return JSON.parse(localStorage.getItem(PRESENCE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export class LocalBackend implements Backend {
  readonly mode = 'local' as const

  private listeners = new Set<() => void>()
  private authListeners = new Set<(user: UserProfile | null) => void>()
  private heartbeat: ReturnType<typeof setInterval> | null = null

  constructor() {
    window.addEventListener('storage', (e) => {
      if (e.key === DB_KEY || e.key === PRESENCE_KEY) {
        this.emit()
        this.emitAuth()
      }
    })
  }

  // ---- internals ----

  private emit() {
    for (const l of this.listeners) l()
  }

  private emitAuth() {
    const user = this.currentUser()
    for (const l of this.authListeners) l(user)
  }

  private mutate(fn: (db: LocalDb) => void) {
    const db = loadDb()
    fn(db)
    localStorage.setItem(DB_KEY, JSON.stringify(db))
    this.emit()
  }

  private mutatePresence(fn: (p: Record<string, PresenceInfo>) => void) {
    const p = loadPresence()
    fn(p)
    localStorage.setItem(PRESENCE_KEY, JSON.stringify(p))
    this.emit()
  }

  private currentUser(): UserProfile | null {
    const id = sessionStorage.getItem(SESSION_KEY)
    if (!id) return null
    const u = loadDb().users.find((x) => x.uid === id)
    return u ? normalizeUser(u) : null
  }

  private subscribe(push: () => void): Unsubscribe {
    push()
    this.listeners.add(push)
    return () => this.listeners.delete(push)
  }

  // ---- auth ----

  onAuthChanged(cb: (user: UserProfile | null) => void): Unsubscribe {
    cb(this.currentUser())
    this.authListeners.add(cb)
    // Profile edits should also refresh the auth user object.
    const push = () => cb(this.currentUser())
    this.listeners.add(push)
    return () => {
      this.authListeners.delete(cb)
      this.listeners.delete(push)
    }
  }

  async signInEmail(): Promise<void> {
    throw new Error('Firebase non configuré — utilise la connexion locale (pseudo).')
  }

  async signUpEmail(): Promise<void> {
    throw new Error('Firebase non configuré — utilise la connexion locale (pseudo).')
  }

  async signInGoogle(): Promise<void> {
    throw new Error('Firebase non configuré — utilise la connexion locale (pseudo).')
  }

  async signInLocal(displayName: string): Promise<void> {
    const name = displayName.trim()
    if (!name) throw new Error('Pseudo requis.')
    const id = `local-${slug(name)}`
    this.mutate((db) => {
      if (!db.users.some((u) => u.uid === id)) {
        db.users.push({
          uid: id,
          displayName: name,
          avatar: '🎮',
          bio: '',
          // Dev convenience: first local user is admin.
          isAdmin: db.users.length === 0,
          createdAt: Date.now(),
          seenUpdates: {},
          linkedUids: [],
          profileFrame: 'none',
          profileBackground: 'none',
        })
      }
    })
    sessionStorage.setItem(SESSION_KEY, id)
    this.emitAuth()
  }

  async signOut(): Promise<void> {
    const user = this.currentUser()
    if (user) this.goOffline(user.uid)
    sessionStorage.removeItem(SESSION_KEY)
    this.emitAuth()
  }

  async updateProfile(
    targetUid: string,
    patch: Partial<
      Pick<UserProfile, 'displayName' | 'avatar' | 'bio' | 'profileFrame' | 'profileBackground'>
    >,
  ): Promise<void> {
    this.mutate((db) => {
      const u = db.users.find((x) => x.uid === targetUid)
      if (u) Object.assign(u, patch)
    })
    this.emitAuth()
  }

  async setSeenUpdate(targetUid: string, gameId: string, publishedAt: number): Promise<void> {
    this.mutate((db) => {
      const u = db.users.find((x) => x.uid === targetUid)
      if (u) {
        u.seenUpdates = { ...(u.seenUpdates ?? {}), [gameId]: publishedAt }
      }
    })
    this.emitAuth()
  }

  // ---- users ----

  watchUsers(cb: (users: UserProfile[]) => void): Unsubscribe {
    return this.subscribe(() => cb(loadDb().users.map((u) => normalizeUser(u))))
  }

  async setUserFlags(
    targetUid: string,
    flags: Partial<Pick<UserProfile, 'isAdmin'>>,
  ): Promise<void> {
    this.mutate((db) => {
      const u = db.users.find((x) => x.uid === targetUid)
      if (u) Object.assign(u, flags)
    })
    this.emitAuth()
  }

  // ---- games ----

  watchGames(cb: (games: Game[]) => void): Unsubscribe {
    return this.subscribe(() =>
      cb(
        loadDb()
          .games.map((g) => normalizeGame(g))
          .sort((a, b) => b.createdAt - a.createdAt),
      ),
    )
  }

  async addGame(input: NewGameInput, createdBy: string, approved: boolean): Promise<string> {
    const id = uid('game')
    const now = Date.now()
    this.mutate((db) => {
      db.games.push({
        ...input,
        id,
        update: null,
        approved,
        archived: false,
        createdBy,
        createdAt: now,
        updatedAt: now,
      })
    })
    return id
  }

  async approveGame(gameId: string, approved: boolean): Promise<void> {
    return this.updateGame(gameId, { approved })
  }

  async updateGame(
    gameId: string,
    patch: Partial<Omit<Game, 'id' | 'createdBy' | 'createdAt'>>,
  ): Promise<void> {
    this.mutate((db) => {
      const g = db.games.find((x) => x.id === gameId)
      if (g) Object.assign(g, patch, { updatedAt: Date.now() })
    })
  }

  async deleteGame(gameId: string): Promise<void> {
    this.mutate((db) => {
      db.games = db.games.filter((g) => g.id !== gameId)
      delete db.requests[gameId]
      delete db.chats[gameId]
      for (const key of Object.keys(db.comments)) {
        if (key.startsWith(`${gameId}/`)) delete db.comments[key]
      }
    })
  }

  // ---- requests ----

  watchRequests(gameId: string, cb: (requests: GameRequest[]) => void): Unsubscribe {
    return this.subscribe(() =>
      cb([...(loadDb().requests[gameId] ?? [])].sort((a, b) => b.createdAt - a.createdAt)),
    )
  }

  async addRequest(gameId: string, input: NewRequestInput, authorUid: string): Promise<string> {
    const id = uid('req')
    const now = Date.now()
    this.mutate((db) => {
      const list = db.requests[gameId] ?? (db.requests[gameId] = [])
      list.push({
        ...input,
        id,
        gameId,
        status: 'open',
        authorUid,
        upvotes: {},
        createdAt: now,
        updatedAt: now,
      })
    })
    return id
  }

  private mutateRequest(gameId: string, requestId: string, fn: (r: GameRequest) => void) {
    this.mutate((db) => {
      const r = (db.requests[gameId] ?? []).find((x) => x.id === requestId)
      if (r) {
        fn(r)
        r.updatedAt = Date.now()
      }
    })
  }

  async updateRequestContent(
    gameId: string,
    requestId: string,
    patch: Partial<Pick<GameRequest, 'title' | 'description'>>,
  ): Promise<void> {
    this.mutateRequest(gameId, requestId, (r) => Object.assign(r, patch))
  }

  async setRequestStatus(gameId: string, requestId: string, status: RequestStatus): Promise<void> {
    this.mutateRequest(gameId, requestId, (r) => {
      r.status = status
    })
  }

  async toggleUpvote(gameId: string, requestId: string, voter: string, on: boolean): Promise<void> {
    this.mutateRequest(gameId, requestId, (r) => {
      if (on) r.upvotes[voter] = true
      else delete r.upvotes[voter]
    })
  }

  async deleteRequest(gameId: string, requestId: string): Promise<void> {
    this.mutate((db) => {
      db.requests[gameId] = (db.requests[gameId] ?? []).filter((r) => r.id !== requestId)
      delete db.comments[`${gameId}/${requestId}`]
    })
  }

  // ---- comments ----

  watchComments(
    gameId: string,
    requestId: string,
    cb: (comments: RequestComment[]) => void,
  ): Unsubscribe {
    const key = `${gameId}/${requestId}`
    return this.subscribe(() =>
      cb([...(loadDb().comments[key] ?? [])].sort((a, b) => a.createdAt - b.createdAt)),
    )
  }

  async addComment(
    gameId: string,
    requestId: string,
    authorUid: string,
    text: string,
  ): Promise<void> {
    const key = `${gameId}/${requestId}`
    this.mutate((db) => {
      const list = db.comments[key] ?? (db.comments[key] = [])
      list.push({ id: uid('com'), authorUid, text, createdAt: Date.now() })
    })
  }

  async deleteComment(gameId: string, requestId: string, commentId: string): Promise<void> {
    const key = `${gameId}/${requestId}`
    this.mutate((db) => {
      db.comments[key] = (db.comments[key] ?? []).filter((c) => c.id !== commentId)
    })
  }

  // ---- forum chat ----

  watchChat(scopeId: string, cb: (messages: ChatMessage[]) => void): Unsubscribe {
    return this.subscribe(() =>
      cb([...(loadDb().chats[scopeId] ?? [])].sort((a, b) => a.createdAt - b.createdAt)),
    )
  }

  async sendChatMessage(scopeId: string, authorUid: string, text: string): Promise<void> {
    this.mutate((db) => {
      const list = db.chats[scopeId] ?? (db.chats[scopeId] = [])
      list.push({ id: uid('msg'), authorUid, text, createdAt: Date.now() })
    })
  }

  async deleteChatMessage(scopeId: string, messageId: string): Promise<void> {
    this.mutate((db) => {
      db.chats[scopeId] = (db.chats[scopeId] ?? []).filter((m) => m.id !== messageId)
    })
  }

  // ---- friendships ----

  watchFriendships(uidTarget: string, cb: (friendships: Friendship[]) => void): Unsubscribe {
    return this.subscribe(() =>
      cb(loadDb().friendships.filter((f) => f.users.includes(uidTarget))),
    )
  }

  async sendFriendRequest(fromUid: string, toUid: string): Promise<void> {
    const id = friendshipId(fromUid, toUid)
    this.mutate((db) => {
      if (!db.friendships.some((f) => f.id === id)) {
        db.friendships.push({
          id,
          users: [fromUid, toUid].sort() as [string, string],
          requestedBy: fromUid,
          status: 'pending',
          createdAt: Date.now(),
        })
      }
    })
  }

  async acceptFriendRequest(id: string): Promise<void> {
    this.mutate((db) => {
      const f = db.friendships.find((x) => x.id === id)
      if (f) f.status = 'accepted'
    })
  }

  async removeFriendship(id: string): Promise<void> {
    this.mutate((db) => {
      db.friendships = db.friendships.filter((f) => f.id !== id)
    })
  }

  // ---- presence ----

  watchPresence(cb: (presence: Record<string, PresenceInfo>) => void): Unsubscribe {
    const push = () => {
      const raw = loadPresence()
      const now = Date.now()
      const out: Record<string, PresenceInfo> = {}
      for (const [k, v] of Object.entries(raw)) {
        const online = v.online && now - v.lastSeen < ONLINE_THRESHOLD_MS
        out[k] = { ...v, online, playing: online ? v.playing : null }
      }
      cb(out)
    }
    // Heartbeats only bump timestamps; re-evaluate freshness periodically.
    const interval = setInterval(push, 10_000)
    const unsub = this.subscribe(push)
    return () => {
      clearInterval(interval)
      unsub()
    }
  }

  goOnline(uidTarget: string): void {
    const beat = () =>
      this.mutatePresence((p) => {
        const prev = p[uidTarget]
        p[uidTarget] = {
          online: true,
          lastSeen: Date.now(),
          playing: prev?.playing ?? null,
        }
      })
    beat()
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = setInterval(beat, HEARTBEAT_MS)
    window.addEventListener('beforeunload', () => this.goOffline(uidTarget), { once: true })
  }

  goOffline(uidTarget: string): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
    this.mutatePresence((p) => {
      p[uidTarget] = { online: false, lastSeen: Date.now(), playing: null }
    })
  }

  async setPlaying(uidTarget: string, playing: PlayingStatus | null): Promise<void> {
    this.mutatePresence((p) => {
      const prev = p[uidTarget] ?? { online: true, lastSeen: Date.now(), playing: null }
      p[uidTarget] = { ...prev, lastSeen: Date.now(), playing }
    })
  }
}
