import { useEffect, useRef } from 'react'
import { backend } from './backend'
import { usePresenceStore } from '../stores/presenceStore'

/**
 * Makes the declarative "en jeu" status self-correcting instead of eternal.
 *
 * The raw problem: clicking "Jouer" posts a status, but nothing takes it back
 * down if you walk away from the PC or close the (external) game — you'd show
 * as playing forever. Two safety nets here, on top of what the backends
 * already do (RTDB onDisconnect / local heartbeat clear `playing` when the
 * tab actually closes):
 *
 * - IDLE: no mouse/keyboard/scroll for a while → you clearly left, clear it.
 * - CAP: a single session can't reasonably last forever → hard ceiling.
 *
 * Embedded games (iframe on the portal) additionally clear the moment you
 * leave the game page — that path is fully accurate and handled in the page.
 */

const IDLE_MS = 12 * 60_000 // 12 min without activity → assume away
const SESSION_CAP_MS = 4 * 60 * 60_000 // 4 h ceiling for a single session
const CHECK_MS = 30_000

export function usePresenceAutoAway(uid: string | undefined) {
  const lastActivity = useRef(Date.now())

  useEffect(() => {
    if (!uid) return

    const bump = () => {
      lastActivity.current = Date.now()
    }
    const events = ['mousemove', 'keydown', 'pointerdown', 'touchstart', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))

    const interval = setInterval(() => {
      const playing = usePresenceStore.getState().presence[uid]?.playing
      if (!playing) return
      const idle = Date.now() - lastActivity.current > IDLE_MS
      const tooLong = Date.now() - playing.since > SESSION_CAP_MS
      if (idle || tooLong) void backend.setPlaying(uid, null)
    }, CHECK_MS)

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(interval)
    }
  }, [uid])
}
