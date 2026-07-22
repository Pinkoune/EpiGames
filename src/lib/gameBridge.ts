/**
 * Portal <-> game bridge (postMessage).
 *
 * WHY THIS EXISTS, and why it is NOT the phase-2 SSO:
 * a game never talks to the portal's Firebase. It posts a message to the
 * portal window, and the PORTAL performs the write with the signed-in user's
 * own credentials. So there is no token to sign, no Cloud Function, and no
 * coupling between Firebase projects — exactly what the phase-2 note asks us
 * not to build yet. SSO stays the answer for a game that needs its OWN
 * authenticated backend; this bridge covers "the game wants to tell the
 * portal something".
 *
 * Two transports, same protocol:
 * - embedded games: the iframe's `contentWindow` (portal is the parent);
 * - web games: the tab opened by the portal, which answers via
 *   `window.opener` — only possible when the game opted into the bridge, as
 *   `noopener` is otherwise kept on (see presenceStore.launchGame).
 *
 * TRUST MODEL: client-authoritative, like the rest of the portal. Origin is
 * checked so an unrelated site can't drive the bridge, but a player who opens
 * devtools can forge an unlock for a game they can already play. That is the
 * documented trade-off of this project — it is not an anti-cheat system.
 */

import { backend } from './backend'
import type { Game, GameAchievement, UserProfile } from './types'

/** Messages the GAME sends to the portal. */
export type GameToPortal =
  | { type: 'epigames:ready'; version?: number }
  | { type: 'epigames:achievement'; code: string }
  | { type: 'epigames:toast'; title: string; body?: string }

/** Messages the PORTAL sends to the game. */
export type PortalToGame =
  | {
      type: 'epigames:session'
      user: { uid: string; displayName: string; avatar: string }
      achievements: { code: string; title: string; description: string; unlocked: boolean }[]
    }
  | { type: 'epigames:achievement:ok'; code: string }
  | { type: 'epigames:notification'; title: string; body?: string; icon?: string }

/**
 * Handle on the tab opened for a bridge-enabled `web` game. The portal keeps
 * it so it can post INTO that tab; the game answers through `window.opener`.
 * Module-level because the launch happens in the presence store while the
 * listener lives on the game page.
 */
let openedGameWindow: Window | null = null

export function setOpenedGameWindow(w: Window | null): void {
  openedGameWindow = w
}

export function getOpenedGameWindow(): Window | null {
  return openedGameWindow && !openedGameWindow.closed ? openedGameWindow : null
}

/** Origin of a game's launch URL, or null when it isn't a usable absolute URL. */
export function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export interface BridgeHost {
  game: Game
  user: UserProfile
  achievements: GameAchievement[]
  /** Where to post portal->game messages (iframe contentWindow, or the opened tab). */
  target: () => Window | null
  /** Surface something the game asked to show, using the portal's own toasts. */
  onToast?: (title: string, body?: string) => void
}

function sessionMessage(host: BridgeHost): PortalToGame {
  const { user, achievements } = host
  return {
    type: 'epigames:session',
    user: { uid: user.uid, displayName: user.displayName, avatar: user.avatar },
    achievements: achievements
      .filter((a) => a.status === 'approved' && a.code)
      .map((a) => ({
        code: a.code,
        title: a.title,
        description: a.description,
        unlocked: Boolean(a.unlockedBy[user.uid]),
      })),
  }
}

/**
 * Start listening for a game's messages. Returns a disposer AND a `notify`
 * function the caller can use to push portal notifications into the game
 * (useful when the game is fullscreen and the portal's own toasts are hidden).
 */
export function connectGameBridge(host: BridgeHost): {
  stop: () => void
  notify: (n: { title: string; body?: string; icon?: string }) => void
} {
  const expected = originOf(host.game.launchUrl)

  const post = (message: PortalToGame) => {
    const target = host.target()
    if (!target || !expected) return
    target.postMessage(message, expected)
  }

  const onMessage = (event: MessageEvent) => {
    // Only ever trust messages from the game's own origin.
    if (!expected || event.origin !== expected) return
    const data = event.data as GameToPortal | undefined
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') return
    if (!data.type.startsWith('epigames:')) return

    switch (data.type) {
      case 'epigames:ready':
        post(sessionMessage(host))
        break

      case 'epigames:achievement': {
        const achievement = host.achievements.find(
          (a) => a.code && a.code === data.code && a.status === 'approved',
        )
        // Unknown code, or already unlocked -> nothing to write, but still
        // acknowledge so the game can stop retrying.
        if (achievement && !achievement.unlockedBy[host.user.uid]) {
          void backend.toggleAchievementUnlock(
            host.game.id,
            achievement.id,
            host.user.uid,
            true,
          )
        }
        post({ type: 'epigames:achievement:ok', code: data.code })
        break
      }

      case 'epigames:toast':
        host.onToast?.(data.title, data.body)
        break
    }
  }

  window.addEventListener('message', onMessage)
  return {
    stop: () => window.removeEventListener('message', onMessage),
    notify: (n) => post({ type: 'epigames:notification', ...n }),
  }
}
