import { Link } from 'react-router-dom'
import { coverFallback } from '../../lib/cover'
import type { Game } from '../../lib/types'
import { hasUnseenUpdate } from '../../lib/types'
import { usePresenceStore } from '../../stores/presenceStore'
import { useAuthStore } from '../../stores/authStore'
import { useUsersStore } from '../../stores/usersStore'
import { DownloadIcon, GameStatusBadge } from '../ui'

export function GameCard({
  game,
  playersCount,
  openRequests,
  onTagClick,
}: {
  game: Game
  playersCount: number
  openRequests?: number
  onTagClick?: (tag: string) => void
}) {
  const user = useAuthStore((s) => s.user)
  const users = useUsersStore((s) => s.users)
  const launchGame = usePresenceStore((s) => s.launchGame)

  const creator = users[game.createdBy]?.displayName
  const download = game.kind === 'download'

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border bg-panel transition ${
        download
          ? 'border-violet-500/25 hover:border-violet-400/60'
          : 'border-edge hover:border-accent/50'
      }`}
    >
      <Link to={`/game/${game.id}`} className="block">
        <div
          className="relative aspect-video bg-cover bg-center"
          style={
            game.coverUrl
              ? { backgroundImage: `url(${game.coverUrl})` }
              : { background: coverFallback(game.id) }
          }
        >
          {!game.coverUrl && (
            <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-white/25">
              {game.title}
            </span>
          )}
          {/* Downloadable games are visually distinct: violet install ribbon */}
          {download && (
            <span className="absolute top-0 right-0 flex items-center gap-1 rounded-bl-lg bg-violet-500/90 px-2 py-1 text-[11px] font-bold tracking-wide text-white">
              <DownloadIcon /> À INSTALLER
            </span>
          )}
          {!game.approved && (
            <span className="absolute top-2 left-2 rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-abyss">
              EN ATTENTE
            </span>
          )}
          {game.approved && hasUnseenUpdate(user, game) && (
            <span
              className="absolute top-2 left-2 animate-pulse rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold text-abyss"
              title={`Mise à jour ${game.update?.version ?? ''} disponible`}
            >
              MAJ
            </span>
          )}
          {playersCount > 0 && (
            <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-400">
              ● {playersCount} en jeu
            </span>
          )}
        </div>
        <div className="p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-display truncate font-semibold">{game.title}</h3>
            <GameStatusBadge status={game.status} />
          </div>
          {game.tagline && (
            <p className="mt-0.5 line-clamp-1 text-sm text-ink-dim">{game.tagline}</p>
          )}
          <p className="mt-1.5 flex items-center gap-3 text-xs text-ink-dim/80">
            {creator && (
              <span>
                par{' '}
                <Link
                  to={`/profile/${game.createdBy}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-ink-dim hover:text-ink hover:underline"
                >
                  {creator}
                </Link>
              </span>
            )}
            {openRequests !== undefined && openRequests > 0 && (
              <span title="Demandes ouvertes (bugs & features)">
                ◌ {openRequests} demande{openRequests > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </Link>

      {game.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3.5 pb-3">
          {game.tags.slice(0, 4).map((t) => (
            <button
              key={t}
              onClick={() => onTagClick?.(t)}
              className="rounded bg-panel-2 px-1.5 py-0.5 text-[11px] text-ink-dim transition hover:bg-edge hover:text-ink"
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {game.launchUrl && (
        <button
          onClick={() => void launchGame(user?.uid, game)}
          className={`absolute top-2 right-2 rounded-md px-3 py-1 text-sm font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100 ${
            download ? 'top-8 bg-violet-500 hover:bg-violet-400' : 'bg-accent text-abyss'
          }`}
          title={
            download
              ? 'Ouvre la page de téléchargement'
              : 'Ouvre le jeu et signale aux amis que tu y joues'
          }
        >
          {download ? (
            <>
              <DownloadIcon /> Obtenir
            </>
          ) : (
            '▶ Jouer'
          )}
        </button>
      )}
    </div>
  )
}
