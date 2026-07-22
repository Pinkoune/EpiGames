import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { backend } from '../../lib/backend'
import { useChat } from '../../lib/hooks'
import { coverFallback } from '../../lib/cover'
import { resolveProfileAccent } from '../../lib/profileCustomization'
import type { Game } from '../../lib/types'
import { isDmScope, parseInvite } from '../../lib/types'
import { useGamesStore } from '../../stores/gamesStore'
import { useAuthStore } from '../../stores/authStore'
import { useUsersStore, displayNameOf } from '../../stores/usersStore'
import { Avatar, inputCls } from '../ui'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const today = new Date().toDateString() === d.toDateString()
  return today
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) +
        ' ' +
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Game invite rendered from its `[invite:<id>]` marker. Kept OUTSIDE the
 * bubble tint: its emerald identity has to stay readable whatever accent
 * colour the sender picked.
 */
function InviteCard({ gameId, games }: { gameId: string; games: Game[] }) {
  const game = games.find((g) => g.id === gameId)
  if (!game) {
    return <p className="text-sm text-ink-dim italic">Invitation à un jeu introuvable.</p>
  }
  return (
    <Link
      to={`/game/${game.id}`}
      className="mt-0.5 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 transition hover:border-emerald-400/60"
    >
      <div
        className="hidden aspect-video w-20 shrink-0 rounded border border-edge bg-cover bg-center sm:block"
        style={
          game.coverUrl
            ? { backgroundImage: `url(${game.coverUrl})` }
            : { background: coverFallback(game.id) }
        }
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-emerald-400 uppercase">
          🎮 Invitation à jouer
        </p>
        <p className="truncate font-display font-semibold">{game.title}</p>
        <p className="text-xs text-accent">Rejoindre →</p>
      </div>
    </Link>
  )
}

/**
 * Discussion channel. Two layouts:
 * - public channels (portal / per game) keep the flat, avatar-led list — with
 *   many participants, left/right alignment would be meaningless;
 * - private conversations get messenger bubbles, yours on the right tinted
 *   with your profile accent colour.
 */
export function ChatChannel({ scopeId, placeholder }: { scopeId: string; placeholder: string }) {
  const user = useAuthStore((s) => s.user)
  const users = useUsersStore((s) => s.users)
  const games = useGamesStore((s) => s.games)
  const messages = useChat(scopeId)
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  if (!user) return null

  const bubbles = isDmScope(scopeId)
  // Admins moderate public channels, but a private conversation is nobody
  // else's business — firestore.rules enforces the same boundary.
  const canModerate = user.isAdmin && !bubbles
  // '' means "keep the portal default" — fall back to the theme variable.
  const myAccent = resolveProfileAccent(user.profileAccent) || 'var(--color-accent)'

  async function send(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || !user) return
    setText('')
    await backend.sendChatMessage(scopeId, user.uid, t)
  }

  const deleteButton = (messageId: string) => (
    <button
      onClick={() => void backend.deleteChatMessage(scopeId, messageId)}
      className="shrink-0 text-xs text-ink-dim opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
      title="Supprimer le message"
    >
      ✕
    </button>
  )

  return (
    <div className="flex h-[65vh] flex-col rounded-lg border border-edge bg-panel">
      <div className={`flex-1 overflow-y-auto p-4 ${bubbles ? 'space-y-2' : 'space-y-4'}`}>
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-ink-dim">
            Personne n'a encore rien dit — lance la discussion.
          </p>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const grouped =
            prev && prev.authorUid === m.authorUid && m.createdAt - prev.createdAt < 300_000
          const invitedGameId = parseInvite(m.text)
          const mine = m.authorUid === user.uid

          // ---- private conversation: left/right bubbles ----
          if (bubbles) {
            return (
              <div
                key={m.id}
                className={`group flex items-end gap-2 ${
                  mine ? 'justify-end' : 'justify-start'
                } ${grouped ? '-mt-1' : ''}`}
              >
                {/* Their avatar anchors the left column; keep the gutter on
                    grouped messages so bubbles stay aligned. */}
                {!mine && (
                  <span className="w-7 shrink-0">
                    {!grouped && <Avatar user={users[m.authorUid]} size="sm" />}
                  </span>
                )}
                {mine && deleteButton(m.id)}

                <div className={`max-w-[75%] min-w-0 ${mine ? 'text-right' : ''}`}>
                  {invitedGameId ? (
                    <InviteCard gameId={invitedGameId} games={games} />
                  ) : (
                    <div
                      className={`inline-block rounded-2xl px-3 py-2 text-left ${
                        mine ? 'text-abyss' : 'bg-panel-2 text-ink/90'
                      }`}
                      style={mine ? { background: myAccent } : undefined}
                    >
                      <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>
                      <p
                        className={`mt-0.5 text-[10px] ${
                          mine ? 'text-abyss/60' : 'text-ink-dim'
                        }`}
                      >
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                  )}
                </div>

                {!mine && canModerate && deleteButton(m.id)}
              </div>
            )
          }

          // ---- public channel: flat, avatar-led list ----
          return (
            <div key={m.id} className={`group flex items-start gap-3 ${grouped ? '-mt-3' : ''}`}>
              <span className="w-7 shrink-0">
                {!grouped && <Avatar user={users[m.authorUid]} size="sm" />}
              </span>
              <div className="min-w-0 flex-1">
                {!grouped && (
                  <p className="mb-0.5 text-sm">
                    <Link
                      to={`/profile/${m.authorUid}`}
                      className="font-semibold hover:underline"
                    >
                      {displayNameOf(users, m.authorUid)}
                    </Link>
                    <span className="ml-2 text-xs text-ink-dim">{formatTime(m.createdAt)}</span>
                  </p>
                )}
                {invitedGameId ? (
                  <InviteCard gameId={invitedGameId} games={games} />
                ) : (
                  <p className="text-sm break-words whitespace-pre-wrap text-ink/90">{m.text}</p>
                )}
              </div>
              {(mine || canModerate) && deleteButton(m.id)}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-edge p-3">
        <input
          className={inputCls}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={1000}
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 text-sm font-semibold text-abyss transition hover:brightness-115"
        >
          Envoyer
        </button>
      </form>
    </div>
  )
}
