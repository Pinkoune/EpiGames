import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { backend } from '../../lib/backend'
import { useChat } from '../../lib/hooks'
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

/** "Général" discussion channel (portal-wide or per game). */
export function ChatChannel({ scopeId, placeholder }: { scopeId: string; placeholder: string }) {
  const user = useAuthStore((s) => s.user)
  const users = useUsersStore((s) => s.users)
  const messages = useChat(scopeId)
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  if (!user) return null

  async function send(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || !user) return
    setText('')
    await backend.sendChatMessage(scopeId, user.uid, t)
  }

  return (
    <div className="flex h-[65vh] flex-col rounded-lg border border-edge bg-panel">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-ink-dim">
            Personne n'a encore rien dit — lance la discussion.
          </p>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const grouped =
            prev && prev.authorUid === m.authorUid && m.createdAt - prev.createdAt < 300_000
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
                <p className="text-sm break-words whitespace-pre-wrap text-ink/90">{m.text}</p>
              </div>
              {(m.authorUid === user.uid || user.isAdmin) && (
                <button
                  onClick={() => void backend.deleteChatMessage(scopeId, m.id)}
                  className="text-xs text-ink-dim opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                  title="Supprimer le message"
                >
                  ✕
                </button>
              )}
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
