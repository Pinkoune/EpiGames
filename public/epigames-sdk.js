/**
 * Epigames SDK — drop this in your game to talk to the portal.
 *
 *   <script src="https://pinkoune.github.io/EpiGames/epigames-sdk.js"></script>
 *   <script>
 *     Epigames.onReady(session => console.log('Salut', session.user.displayName))
 *     Epigames.onNotification(n => myUi.showToast(n.title, n.body))
 *     Epigames.unlock('speedrun_10min')
 *   </script>
 *
 * It works whether the portal embedded you in an iframe or opened you in a
 * tab: the SDK finds the portal window itself (`parent`, else `opener`).
 *
 * If the game is opened directly (not through the portal), every call becomes
 * a no-op and `Epigames.available` is false — so you can ship ONE build that
 * runs both standalone and on the portal.
 *
 * No dependency, no build step, no Firebase. The portal performs the writes
 * with the player's own account: your game never sees a credential.
 */
(function (global) {
  'use strict'

  var PREFIX = 'epigames:'

  // The portal is our parent (iframe) or our opener (tab). `parent === window`
  // when we're top-level, hence the check.
  var portal = global.parent !== global ? global.parent : global.opener || null

  var readyHandlers = []
  var notificationHandlers = []
  var session = null
  /** Unlock codes sent while we were still waiting for the handshake. */
  var pending = []

  function post(message) {
    if (!portal) return
    // '*' is fine here: the portal validates OUR origin against the launchUrl
    // it has on file, and nothing secret ever travels game -> portal.
    portal.postMessage(message, '*')
  }

  function handle(event) {
    // Only accept messages coming from the portal window we know about.
    if (!portal || event.source !== portal) return
    var data = event.data
    if (!data || typeof data !== 'object') return
    if (typeof data.type !== 'string' || data.type.indexOf(PREFIX) !== 0) return

    if (data.type === PREFIX + 'session') {
      session = { user: data.user, achievements: data.achievements || [] }
      readyHandlers.forEach(function (fn) {
        try {
          fn(session)
        } catch (e) {
          console.error('[Epigames] onReady handler failed', e)
        }
      })
      readyHandlers = []
      // Flush anything unlocked before the portal answered.
      pending.forEach(function (code) {
        post({ type: PREFIX + 'achievement', code: code })
      })
      pending = []
    } else if (data.type === PREFIX + 'notification') {
      notificationHandlers.forEach(function (fn) {
        try {
          fn({ title: data.title, body: data.body, icon: data.icon })
        } catch (e) {
          console.error('[Epigames] onNotification handler failed', e)
        }
      })
    }
  }

  if (portal) {
    global.addEventListener('message', handle)
    // Announce ourselves; the portal replies with the session.
    post({ type: PREFIX + 'ready', version: 1 })
  }

  var Epigames = {
    /** False when the game runs outside the portal — all calls are no-ops. */
    available: Boolean(portal),

    /** The signed-in player + achievement list, or null before the handshake. */
    get session() {
      return session
    },

    /**
     * Called once the portal has sent the session. Fires immediately if it
     * already arrived, so registration order never matters.
     */
    onReady: function (fn) {
      if (typeof fn !== 'function') return
      if (session) fn(session)
      else readyHandlers.push(fn)
    },

    /** Portal notifications (friend online, message, invite…) for your own UI. */
    onNotification: function (fn) {
      if (typeof fn === 'function') notificationHandlers.push(fn)
    },

    /**
     * Unlock one of this game's achievements by its CODE (set in the portal,
     * on the achievement). Safe to call repeatedly: already-unlocked and
     * unknown codes are ignored by the portal.
     */
    unlock: function (code) {
      if (!code || !portal) return
      if (!session) pending.push(code)
      else post({ type: PREFIX + 'achievement', code: code })
    },

    /** True if the player already has this achievement (after onReady). */
    hasUnlocked: function (code) {
      if (!session) return false
      return session.achievements.some(function (a) {
        return a.code === code && a.unlocked
      })
    },

    /** Ask the portal to show one of ITS toasts (e.g. "Boss vaincu !"). */
    toast: function (title, body) {
      post({ type: PREFIX + 'toast', title: String(title), body: body })
    },
  }

  global.Epigames = Epigames
})(window)
