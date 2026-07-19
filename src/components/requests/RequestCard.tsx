import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { backend } from '../../lib/backend'
import { useComments } from '../../lib/hooks'
import type { Game, GameRequest, RequestStatus } from '../../lib/types'
import { REQUEST_STATUS_LABELS, isRequestClosed } from '../../lib/types'
import { useAuthStore } from '../../stores/authStore'
import { canEditGame } from '../../stores/gamesStore'
import { useUsersStore, displayNameOf } from '../../stores/usersStore'
import { Avatar, RequestStatusBadge, inputCls } from '../ui'
import { Markdown } from '../Markdown'
import { RequestForm } from './RequestForm'

export function RequestCard({ game, request }: { game: Game; request: GameRequest }) {
  const user = useAuthStore((s) => s.user)
  const users = useUsersStore((s) => s.users)
  // Threads open by default — the discussion IS the point.
  const [showComments, setShowComments] = useState(true)
  const [editing, setEditing] = useState(false)
  const [commentText, setCommentText] = useState('')
  const comments = useComments(game.id, request.id, showComments)

  if (!user) return null

  // Game owners triage THEIR game's requests; global admin can too.
  const canTriage = canEditGame(user, game)
  const isAuthor = request.authorUid === user.uid
  const closed = isRequestClosed(request.status)
  const votes = Object.keys(request.upvotes).length
  const hasVoted = Boolean(request.upvotes[user.uid])

  async function sendComment(e: FormEvent) {
    e.preventDefault()
    const text = commentText.trim()
    if (!text || !user) return
    setCommentText('')
    await backend.addComment(game.id, request.id, user.uid, text)
  }

  const setStatus = (status: RequestStatus) =>
    void backend.setRequestStatus(game.id, request.id, status)

  return (
    <div
      className={`rounded-lg border bg-panel p-4 transition ${
        closed ? 'border-edge/60 opacity-75' : 'border-edge'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Upvote: prioritization by the group */}
        <button
          onClick={() => void backend.toggleUpvote(game.id, request.id, user.uid, !hasVoted)}
          disabled={isAuthor || closed}
          title={
            isAuthor
              ? 'Pas de vote sur sa propre demande'
              : closed
                ? 'Demande close'
                : 'Prioriser cette demande'
          }
          className={`flex min-w-11 flex-col items-center rounded-md border px-2 py-1 transition ${
            hasVoted
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-edge text-ink-dim hover:border-edge-2'
          } disabled:cursor-default disabled:opacity-40`}
        >
          <span className="text-xs">▲</span>
          <span className="text-sm font-bold">{votes}</span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-bold tracking-wide uppercase ${
                request.type === 'bug' ? 'text-rose-400' : 'text-accent'
              }`}
            >
              {request.type === 'bug' ? 'Bug' : 'Feature'}
            </span>
            <h4 className={`font-semibold ${closed ? 'text-ink-dim' : ''}`}>
              {request.title}
            </h4>
            <RequestStatusBadge status={request.status} />
          </div>
          {request.description && (
            <Markdown text={request.description} className="mt-1 text-sm text-ink-dim" />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-dim">
            <Link
              to={`/profile/${request.authorUid}`}
              className="flex items-center gap-1.5 transition hover:text-ink"
            >
              <Avatar user={users[request.authorUid]} size="sm" />
              {displayNameOf(users, request.authorUid)}
            </Link>
            <span>{new Date(request.createdAt).toLocaleDateString('fr-FR')}</span>
            <button
              onClick={() => setShowComments((v) => !v)}
              className="font-medium text-accent hover:underline"
            >
              {showComments ? 'Masquer le fil' : 'Fil de discussion'}
            </button>
            {isAuthor && !closed && (
              <button onClick={() => setEditing(true)} className="font-medium hover:text-ink">
                Modifier
              </button>
            )}
            {/* GitHub-style: the author can close/reopen their own request */}
            {isAuthor && !canTriage && (
              closed ? (
                <button onClick={() => setStatus('open')} className="font-medium hover:text-ink">
                  Rouvrir
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setStatus('done')}
                    className="font-medium hover:text-ink"
                    title="Clore comme faite"
                  >
                    Clore (fait)
                  </button>
                  <button
                    onClick={() => setStatus('rejected')}
                    className="font-medium hover:text-ink"
                    title="Clore sans suite"
                  >
                    Clore (refusé)
                  </button>
                </>
              )
            )}
            {(isAuthor || canTriage) && (
              <button
                onClick={() => {
                  if (confirm('Supprimer cette demande et son fil ?')) {
                    void backend.deleteRequest(game.id, request.id)
                  }
                }}
                className="font-medium text-rose-400/70 hover:text-rose-400"
              >
                Supprimer
              </button>
            )}
          </div>
        </div>

        {canTriage && (
          <select
            value={request.status}
            onChange={(e) => setStatus(e.target.value as RequestStatus)}
            className="rounded-md border border-edge bg-abyss px-2 py-1 text-xs text-ink outline-none focus:border-accent"
            title="Changer le statut (propriétaire du jeu)"
          >
            {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>

      {showComments && (
        <div className="mt-3 space-y-3 border-t border-edge pt-3 pl-14">
          {closed && (
            <p className="text-xs text-ink-dim italic">
              Fil clos — {request.status === 'done' ? 'demande faite' : 'demande refusée'}.
              Les commentaires restent ouverts.
            </p>
          )}
          {comments.length === 0 && (
            <p className="text-xs text-ink-dim">Aucun message dans ce fil.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 text-sm">
              <Avatar user={users[c.authorUid]} size="sm" />
              <div className="min-w-0 flex-1">
                <span className="mr-2 font-semibold">{displayNameOf(users, c.authorUid)}</span>
                <span className="text-xs text-ink-dim">
                  {new Date(c.createdAt).toLocaleString('fr-FR')}
                </span>
                <p className="whitespace-pre-wrap text-ink-dim">{c.text}</p>
              </div>
              {(c.authorUid === user.uid || canTriage) && (
                <button
                  onClick={() => void backend.deleteComment(game.id, request.id, c.id)}
                  className="text-xs text-ink-dim transition hover:text-rose-400"
                  title="Supprimer le message"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <form onSubmit={sendComment} className="flex gap-2 pt-1">
            <input
              className={inputCls}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Répondre dans le fil…"
              maxLength={1000}
            />
            <button
              type="submit"
              className="rounded-md bg-accent px-3 py-1 text-sm font-semibold text-abyss transition hover:brightness-115"
            >
              Envoyer
            </button>
          </form>
        </div>
      )}

      {editing && (
        <RequestForm gameId={game.id} request={request} onClose={() => setEditing(false)} />
      )}
    </div>
  )
}
