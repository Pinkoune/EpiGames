import type { FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  getDatabase,
  onDisconnect,
  onValue,
  ref,
  set,
  update,
} from 'firebase/database'
import type {
  AchievementStatus,
  ChatMessage,
  Friendship,
  EditableProfile,
  Game,
  GameAchievement,
  GameRequest,
  PlayEntry,
  PlayingStatus,
  PresenceInfo,
  RequestComment,
  RequestStatus,
  UserProfile,
} from '../types'
import { friendshipId, normalizeGame, normalizeUser } from '../types'
import type {
  Backend,
  NewAchievementInput,
  NewGameInput,
  NewRequestInput,
  Unsubscribe,
} from './types'

/**
 * Firebase implementation of the Backend contract.
 * Firestore for data, Realtime Database for presence (same pattern as
 * our other games). Client-authoritative by design for a small trusted
 * group — enforcement lives in firestore.rules / database.rules.json.
 */
export class FirebaseBackend implements Backend {
  readonly mode = 'firebase' as const

  private auth
  private db
  private rtdb

  constructor(app: FirebaseApp) {
    this.auth = getAuth(app)
    this.db = getFirestore(app)
    this.rtdb = getDatabase(app)
  }

  // ---- auth ----

  onAuthChanged(cb: (user: UserProfile | null) => void): Unsubscribe {
    let unsubDoc: Unsubscribe | null = null
    const unsubAuth = onAuthStateChanged(this.auth, (fbUser) => {
      unsubDoc?.()
      unsubDoc = null
      if (!fbUser) {
        cb(null)
        return
      }
      void this.ensureUserDoc(fbUser)
      unsubDoc = onSnapshot(doc(this.db, 'users', fbUser.uid), (snap) => {
        if (snap.exists()) cb(normalizeUser({ ...snap.data(), uid: snap.id }))
      })
    })
    return () => {
      unsubDoc?.()
      unsubAuth()
    }
  }

  /** Creates the profile doc on first sign-in. Never touches isAdmin after creation. */
  private async ensureUserDoc(fbUser: User): Promise<void> {
    const userRef = doc(this.db, 'users', fbUser.uid)
    const snap = await getDoc(userRef)
    if (snap.exists()) return
    const profile: Omit<UserProfile, 'uid'> = {
      displayName: fbUser.displayName ?? fbUser.email?.split('@')[0] ?? 'Joueur',
      // Google sign-in: reuse the account picture; customizable later.
      avatar: fbUser.photoURL ?? '🎮',
      bio: '',
      isAdmin: false,
      createdAt: Date.now(),
      seenUpdates: {},
      linkedUids: [],
      profileFrame: 'none',
      profileBackground: 'none',
      profileTitle: 'none',
      profileAccent: 'default',
      favoriteGameId: '',
      seenChats: {},
    }
    await setDoc(userRef, profile)
  }

  async signInEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password)
  }

  async signUpEmail(email: string, password: string, displayName: string): Promise<void> {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password)
    const userRef = doc(this.db, 'users', cred.user.uid)
    const profile: Omit<UserProfile, 'uid'> = {
      displayName: displayName.trim() || email.split('@')[0],
      avatar: '🎮',
      bio: '',
      isAdmin: false,
      createdAt: Date.now(),
      seenUpdates: {},
      linkedUids: [],
      profileFrame: 'none',
      profileBackground: 'none',
      profileTitle: 'none',
      profileAccent: 'default',
      favoriteGameId: '',
      seenChats: {},
    }
    await setDoc(userRef, profile)
  }

  async signInGoogle(): Promise<void> {
    await signInWithPopup(this.auth, new GoogleAuthProvider())
  }

  async signInLocal(): Promise<void> {
    throw new Error('Connexion locale indisponible quand Firebase est configuré.')
  }

  async signOut(): Promise<void> {
    const uid = this.auth.currentUser?.uid
    if (uid) this.goOffline(uid)
    await fbSignOut(this.auth)
  }

  async updateProfile(uid: string, patch: Partial<EditableProfile>): Promise<void> {
    await updateDoc(doc(this.db, 'users', uid), patch)
  }

  async setSeenUpdate(uid: string, gameId: string, publishedAt: number): Promise<void> {
    await updateDoc(doc(this.db, 'users', uid), {
      [`seenUpdates.${gameId}`]: publishedAt,
    })
  }

  async setSeenChat(uid: string, scopeId: string, lastAt: number): Promise<void> {
    await updateDoc(doc(this.db, 'users', uid), {
      [`seenChats.${scopeId}`]: lastAt,
    })
  }

  // ---- users ----

  watchUsers(cb: (users: UserProfile[]) => void): Unsubscribe {
    return onSnapshot(collection(this.db, 'users'), (snap) => {
      cb(snap.docs.map((d) => normalizeUser({ ...d.data(), uid: d.id })))
    })
  }

  async setUserFlags(
    uid: string,
    flags: Partial<Pick<UserProfile, 'isAdmin'>>,
  ): Promise<void> {
    await updateDoc(doc(this.db, 'users', uid), flags)
  }

  // ---- games ----

  watchGames(cb: (games: Game[]) => void): Unsubscribe {
    return onSnapshot(collection(this.db, 'games'), (snap) => {
      const games = snap.docs.map((d) => normalizeGame({ ...d.data(), id: d.id }))
      cb(games.sort((a, b) => b.createdAt - a.createdAt))
    })
  }

  async addGame(input: NewGameInput, createdBy: string, approved: boolean): Promise<string> {
    const gameRef = doc(collection(this.db, 'games'))
    const now = Date.now()
    const game: Omit<Game, 'id'> = {
      ...input,
      update: null,
      approved,
      archived: false,
      createdBy,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(gameRef, game)
    return gameRef.id
  }

  async approveGame(gameId: string, approved: boolean): Promise<void> {
    await updateDoc(doc(this.db, 'games', gameId), { approved, updatedAt: Date.now() })
  }

  async updateGame(
    gameId: string,
    patch: Partial<Omit<Game, 'id' | 'createdBy' | 'createdAt'>>,
  ): Promise<void> {
    await updateDoc(doc(this.db, 'games', gameId), { ...patch, updatedAt: Date.now() })
  }

  async deleteGame(gameId: string): Promise<void> {
    // Client-side cascade (no Cloud Functions in phase 1): delete
    // requests + comments first, then the game doc. Fine at our scale.
    const requestsSnap = await getDocs(collection(this.db, 'games', gameId, 'requests'))
    for (const reqDoc of requestsSnap.docs) {
      const commentsSnap = await getDocs(collection(reqDoc.ref, 'comments'))
      await Promise.all(commentsSnap.docs.map((c) => deleteDoc(c.ref)))
      await deleteDoc(reqDoc.ref)
    }
    const chatSnap = await getDocs(collection(this.db, 'chats', gameId, 'messages'))
    await Promise.all(chatSnap.docs.map((m) => deleteDoc(m.ref)))
    await deleteDoc(doc(this.db, 'games', gameId))
  }

  // ---- requests ----

  watchRequests(gameId: string, cb: (requests: GameRequest[]) => void): Unsubscribe {
    return onSnapshot(collection(this.db, 'games', gameId, 'requests'), (snap) => {
      const requests = snap.docs.map((d) => ({ id: d.id, gameId, ...d.data() }) as GameRequest)
      cb(requests.sort((a, b) => b.createdAt - a.createdAt))
    })
  }

  async addRequest(gameId: string, input: NewRequestInput, authorUid: string): Promise<string> {
    const reqRef = doc(collection(this.db, 'games', gameId, 'requests'))
    const now = Date.now()
    const request: Omit<GameRequest, 'id' | 'gameId'> = {
      ...input,
      status: 'open',
      authorUid,
      upvotes: {},
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(reqRef, request)
    return reqRef.id
  }

  async updateRequestContent(
    gameId: string,
    requestId: string,
    patch: Partial<Pick<GameRequest, 'title' | 'description'>>,
  ): Promise<void> {
    await updateDoc(doc(this.db, 'games', gameId, 'requests', requestId), {
      ...patch,
      updatedAt: Date.now(),
    })
  }

  async setRequestStatus(gameId: string, requestId: string, status: RequestStatus): Promise<void> {
    await updateDoc(doc(this.db, 'games', gameId, 'requests', requestId), {
      status,
      updatedAt: Date.now(),
    })
  }

  async toggleUpvote(
    gameId: string,
    requestId: string,
    uid: string,
    on: boolean,
  ): Promise<void> {
    await updateDoc(doc(this.db, 'games', gameId, 'requests', requestId), {
      [`upvotes.${uid}`]: on ? true : deleteField(),
    })
  }

  async deleteRequest(gameId: string, requestId: string): Promise<void> {
    const reqRef = doc(this.db, 'games', gameId, 'requests', requestId)
    const commentsSnap = await getDocs(collection(reqRef, 'comments'))
    await Promise.all(commentsSnap.docs.map((c) => deleteDoc(c.ref)))
    await deleteDoc(reqRef)
  }

  // ---- comments ----

  watchComments(
    gameId: string,
    requestId: string,
    cb: (comments: RequestComment[]) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(this.db, 'games', gameId, 'requests', requestId, 'comments'),
      (snap) => {
        const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RequestComment)
        cb(comments.sort((a, b) => a.createdAt - b.createdAt))
      },
    )
  }

  async addComment(
    gameId: string,
    requestId: string,
    authorUid: string,
    text: string,
  ): Promise<void> {
    const comRef = doc(
      collection(this.db, 'games', gameId, 'requests', requestId, 'comments'),
    )
    await setDoc(comRef, { authorUid, text, createdAt: Date.now() })
  }

  async deleteComment(gameId: string, requestId: string, commentId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'games', gameId, 'requests', requestId, 'comments', commentId))
  }

  // ---- forum chat ----

  watchChat(scopeId: string, cb: (messages: ChatMessage[]) => void): Unsubscribe {
    return onSnapshot(collection(this.db, 'chats', scopeId, 'messages'), (snap) => {
      const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatMessage)
      cb(messages.sort((a, b) => a.createdAt - b.createdAt))
    })
  }

  async sendChatMessage(scopeId: string, authorUid: string, text: string): Promise<void> {
    const msgRef = doc(collection(this.db, 'chats', scopeId, 'messages'))
    await setDoc(msgRef, { authorUid, text, createdAt: Date.now() })
  }

  async deleteChatMessage(scopeId: string, messageId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'chats', scopeId, 'messages', messageId))
  }

  // ---- friendships ----

  watchFriendships(uid: string, cb: (friendships: Friendship[]) => void): Unsubscribe {
    const q = query(collection(this.db, 'friendships'), where('users', 'array-contains', uid))
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Friendship))
    })
  }

  async sendFriendRequest(fromUid: string, toUid: string): Promise<void> {
    const id = friendshipId(fromUid, toUid)
    const fRef = doc(this.db, 'friendships', id)
    const existing = await getDoc(fRef)
    if (existing.exists()) return
    const friendship: Omit<Friendship, 'id'> = {
      users: [fromUid, toUid].sort() as [string, string],
      requestedBy: fromUid,
      status: 'pending',
      createdAt: Date.now(),
    }
    await setDoc(fRef, friendship)
  }

  async acceptFriendRequest(id: string): Promise<void> {
    await updateDoc(doc(this.db, 'friendships', id), { status: 'accepted' })
  }

  async removeFriendship(id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'friendships', id))
  }

  // ---- presence (RTDB, classic .info/connected pattern) ----

  watchPresence(cb: (presence: Record<string, PresenceInfo>) => void): Unsubscribe {
    return onValue(ref(this.rtdb, 'presence'), (snap) => {
      cb((snap.val() as Record<string, PresenceInfo>) ?? {})
    })
  }

  goOnline(uid: string): void {
    const connRef = ref(this.rtdb, '.info/connected')
    const meRef = ref(this.rtdb, `presence/${uid}`)
    onValue(connRef, (snap) => {
      if (snap.val() !== true) return
      void onDisconnect(meRef)
        .set({ online: false, lastSeen: Date.now(), playing: null })
        .then(() => set(meRef, { online: true, lastSeen: Date.now(), playing: null }))
    })
  }

  goOffline(uid: string): void {
    void set(ref(this.rtdb, `presence/${uid}`), {
      online: false,
      lastSeen: Date.now(),
      playing: null,
    })
  }

  async setPlaying(uid: string, playing: PlayingStatus | null): Promise<void> {
    await update(ref(this.rtdb, `presence/${uid}`), { playing, lastSeen: Date.now() })
    // Launching a game (playing != null) is the moment we log for history.
    if (playing) await this.logPlay(uid, playing.gameId, playing.title)
  }

  // ---- play history (Firestore subcollection) ----

  async logPlay(uid: string, gameId: string, title: string): Promise<void> {
    await addDoc(collection(this.db, 'users', uid, 'plays'), {
      gameId,
      title,
      at: Date.now(),
    })
  }

  watchPlays(uid: string, cb: (plays: PlayEntry[]) => void): Unsubscribe {
    const q = query(
      collection(this.db, 'users', uid, 'plays'),
      orderBy('at', 'desc'),
      limit(30),
    )
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayEntry))
    })
  }

  // ---- game achievements (dev-defined, admin-approved) ----

  watchAchievements(
    gameId: string,
    cb: (achievements: GameAchievement[]) => void,
  ): Unsubscribe {
    return onSnapshot(collection(this.db, 'games', gameId, 'achievements'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, gameId, ...d.data() }) as GameAchievement)
      cb(list.sort((a, b) => a.createdAt - b.createdAt))
    })
  }

  async addAchievement(
    gameId: string,
    input: NewAchievementInput,
    createdBy: string,
  ): Promise<string> {
    const ref_ = doc(collection(this.db, 'games', gameId, 'achievements'))
    const now = Date.now()
    const achievement: Omit<GameAchievement, 'id' | 'gameId'> = {
      ...input,
      status: 'pending',
      unlockedBy: {},
      createdBy,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(ref_, achievement)
    return ref_.id
  }

  async updateAchievementContent(
    gameId: string,
    achievementId: string,
    patch: NewAchievementInput,
  ): Promise<void> {
    await updateDoc(doc(this.db, 'games', gameId, 'achievements', achievementId), {
      ...patch,
      updatedAt: Date.now(),
    })
  }

  async setAchievementStatus(
    gameId: string,
    achievementId: string,
    status: AchievementStatus,
  ): Promise<void> {
    await updateDoc(doc(this.db, 'games', gameId, 'achievements', achievementId), {
      status,
      updatedAt: Date.now(),
    })
  }

  async toggleAchievementUnlock(
    gameId: string,
    achievementId: string,
    uid: string,
    on: boolean,
  ): Promise<void> {
    await updateDoc(doc(this.db, 'games', gameId, 'achievements', achievementId), {
      [`unlockedBy.${uid}`]: on ? true : deleteField(),
    })
  }

  async deleteAchievement(gameId: string, achievementId: string): Promise<void> {
    const ref_ = doc(this.db, 'games', gameId, 'achievements', achievementId)
    const commentsSnap = await getDocs(collection(ref_, 'comments'))
    await Promise.all(commentsSnap.docs.map((c) => deleteDoc(c.ref)))
    await deleteDoc(ref_)
  }

  watchAchievementComments(
    gameId: string,
    achievementId: string,
    cb: (comments: RequestComment[]) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(this.db, 'games', gameId, 'achievements', achievementId, 'comments'),
      (snap) => {
        const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RequestComment)
        cb(comments.sort((a, b) => a.createdAt - b.createdAt))
      },
    )
  }

  async addAchievementComment(
    gameId: string,
    achievementId: string,
    authorUid: string,
    text: string,
  ): Promise<void> {
    const comRef = doc(
      collection(this.db, 'games', gameId, 'achievements', achievementId, 'comments'),
    )
    await setDoc(comRef, { authorUid, text, createdAt: Date.now() })
  }

  async deleteAchievementComment(
    gameId: string,
    achievementId: string,
    commentId: string,
  ): Promise<void> {
    await deleteDoc(
      doc(this.db, 'games', gameId, 'achievements', achievementId, 'comments', commentId),
    )
  }
}
