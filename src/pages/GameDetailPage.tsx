import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GameFormModal } from '../components/games/GameFormModal'
import { GameUpdateModal } from '../components/games/GameUpdateModal'
import { AchievementFormModal } from '../components/games/AchievementFormModal'
import {
  AchievementBadge,
  AchievementReviewCard,
} from '../components/games/AchievementCard'
import { Markdown } from '../components/Markdown'
import { coverFallback } from '../lib/cover'
import { RequestCard } from '../components/requests/RequestCard'
import { RequestForm } from '../components/requests/RequestForm'
import {
  Avatar,
  DownloadIcon,
  GameStatusBadge,
  SectionLabel,
  btnDanger,
  btnGhost,
  btnPlay,
  btnPrimary,
} from '../components/ui'
import { useAchievements, useRequests } from '../lib/hooks'
import type { RequestStatus } from '../lib/types'
import {
  GAME_KIND_LABELS,
  REQUEST_STATUS_LABELS,
  hasUnseenUpdate,
  isRequestClosed,
} from '../lib/types'
import { backend } from '../lib/backend'
import { useAuthStore } from '../stores/authStore'
import { canEditGame, canSeeGame, useGamesStore } from '../stores/gamesStore'
import { usePresenceStore } from '../stores/presenceStore'
import { useUsersStore } from '../stores/usersStore'

type Filter = RequestStatus | 'all' | 'open_like' | 'closed'
type TypeFilter = 'all' | 'bug' | 'feature'

export function GameDetailPage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const users = useUsersStore((s) => s.users)
  const { games, loaded, setArchived, deleteGame, approveGame } = useGamesStore()
  const presence = usePresenceStore((s) => s.presence)
  const launchGame = usePresenceStore((s) => s.launchGame)
  const requests = useRequests(gameId)
  const achievements = useAchievements(gameId)

  const [editing, setEditing] = useState(false)
  const [announcing, setAnnouncing] = useState(false)
  const [addingRequest, setAddingRequest] = useState(false)
  const [proposingAchievement, setProposingAchievement] = useState(false)
  const [statusFilter, setStatusFilter] = useState<Filter>('open_like')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [lightbox, setLightbox] = useState<string | null>(null)
  // Embedded games: whether the in-page iframe has been launched.
  const [embedRunning, setEmbedRunning] = useState(false)
  const runStartRef = useRef(0)

  const game = games.find((g) => g.id === gameId)

  const playersNow = useMemo(
    () =>
      Object.entries(presence).filter(([, p]) => p.online && p.playing?.gameId === gameId),
    [presence, gameId],
  )

  const visibleRequests = useMemo(() => {
    const filtered = requests.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      if (statusFilter === 'all') return true
      if (statusFilter === 'open_like') return !isRequestClosed(r.status)
      if (statusFilter === 'closed') return isRequestClosed(r.status)
      return r.status === statusFilter
    })
    return filtered.sort((a, b) => {
      const diff = Object.keys(b.upvotes).length - Object.keys(a.upvotes).length
      return diff !== 0 ? diff : b.createdAt - a.createdAt
    })
  }, [requests, statusFilter, typeFilter])

  // Embedded games run in-page, so we KNOW when you leave: stop the "en jeu"
  // status when you navigate away or close the tab (only if it's still this
  // game). This is why embedded presence is accurate where web games can't be.
  const embedKind = game?.kind
  useEffect(() => {
    if (!embedRunning || embedKind !== 'embedded' || !user || !gameId) return
    runStartRef.current = Date.now()
    const clearIfThis = () => {
      const cur = usePresenceStore.getState().presence[user.uid]?.playing
      if (cur?.gameId === gameId) void backend.setPlaying(user.uid, null)
    }
    window.addEventListener('pagehide', clearIfThis)
    return () => {
      window.removeEventListener('pagehide', clearIfThis)
      // Guard against React StrictMode's dev-only mount/unmount/mount cycle.
      if (Date.now() - runStartRef.current > 1500) clearIfThis()
    }
  }, [embedRunning, embedKind, user, gameId])

  if (!loaded) return <p className="py-20 text-center text-ink-dim">Chargement…</p>
  if (!game || !canSeeGame(user, game)) {
    return (
      <div className="py-20 text-center text-ink-dim">
        Jeu introuvable.{' '}
        <Link to="/" className="text-accent hover:underline">
          Retour
        </Link>
      </div>
    )
  }

  const isOwner = canEditGame(user, game)
  const openCount = requests.filter((r) => !isRequestClosed(r.status)).length
  const closedCount = requests.length - openCount

  return (
    <div>
      <Link to="/" className="text-sm text-ink-dim transition hover:text-ink">
        ← Bibliothèque
      </Link>

      {!game.approved && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
          <span>
            En attente de publication — visible uniquement des propriétaires et des
            admins.
          </span>
          {user?.isAdmin && (
            <button
              onClick={() => void approveGame(game.id, true)}
              className="rounded-md bg-amber-400 px-3 py-1 text-xs font-bold text-abyss transition hover:brightness-110"
            >
              Publier maintenant
            </button>
          )}
        </div>
      )}

      {/* Hero */}
      <div
        className="mt-4 flex aspect-[21/7] items-end overflow-hidden rounded-lg border border-edge bg-cover bg-center"
        style={
          game.coverUrl
            ? { backgroundImage: `url(${game.coverUrl})` }
            : { background: coverFallback(game.id) }
        }
      >
        <div className="w-full bg-gradient-to-t from-black/85 via-black/40 to-transparent px-6 pt-16 pb-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="font-display text-4xl font-bold tracking-tight text-white">
              {game.title}
            </h1>
            <GameStatusBadge status={game.status} />
            {game.kind === 'embedded' && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/90 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-white">
                ▶ JOUABLE ICI
              </span>
            )}
            {game.archived && (
              <span className="rounded bg-zinc-700/80 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-300">
                ARCHIVÉ
              </span>
            )}
          </div>
          {game.tagline && <p className="mt-1 text-white/70">{game.tagline}</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_280px]">
        {/* Main column */}
        <div className="min-w-0">
          {/* Embedded games play right here, itch.io style. */}
          {game.kind === 'embedded' && game.launchUrl && (
            <section className="mb-8">
              {embedRunning ? (
                <div className="overflow-hidden rounded-lg border border-emerald-500/30 bg-black">
                  <iframe
                    src={game.launchUrl}
                    title={game.title}
                    className="aspect-video w-full"
                    allow="fullscreen; autoplay; gamepad; clipboard-write"
                    sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms"
                  />
                  <div className="flex items-center justify-between gap-3 border-t border-edge bg-panel px-3 py-2 text-xs text-ink-dim">
                    <span>▶ En jeu — {game.title}</span>
                    <a
                      href={game.launchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      Ouvrir en plein écran ↗
                    </a>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEmbedRunning(true)
                    void launchGame(user?.uid, game)
                  }}
                  className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-emerald-500/30 bg-cover bg-center"
                  style={
                    game.coverUrl
                      ? { backgroundImage: `url(${game.coverUrl})` }
                      : { background: coverFallback(game.id) }
                  }
                >
                  <span className="absolute inset-0 bg-black/40 transition group-hover:bg-black/30" />
                  <span className="relative flex items-center gap-2 rounded-md bg-emerald-500 px-6 py-3 text-lg font-bold text-white shadow-lg transition group-hover:bg-emerald-400">
                    ▶ Jouer
                  </span>
                </button>
              )}
            </section>
          )}

          {/* Update announcement sits ABOVE the description — it's news. */}
          {game.update && (
            <section className="mb-8 rounded-lg border border-accent/35 bg-accent/5 p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-display font-semibold text-accent">
                  Mise à jour{game.update.version ? ` ${game.update.version}` : ''}
                </p>
                <span className="text-xs text-ink-dim">
                  {new Date(game.update.publishedAt).toLocaleDateString('fr-FR')}
                </span>
                {user && hasUnseenUpdate(user, game) && (
                  <button
                    onClick={() =>
                      void backend.setSeenUpdate(user.uid, game.id, game.update!.publishedAt)
                    }
                    className="ml-auto rounded-md border border-accent/40 px-2.5 py-1 text-xs font-semibold text-accent transition hover:bg-accent/10"
                    title="Ne plus signaler cette mise à jour"
                  >
                    ✓ J'ai vu
                  </button>
                )}
              </div>
              <Markdown text={game.update.text} className="mt-2 text-sm text-ink/90" />
            </section>
          )}

          {game.description && (
            <section className="mb-8">
              <SectionLabel>À propos</SectionLabel>
              <Markdown text={game.description} className="text-ink/90" />
            </section>
          )}

          {game.screenshots.length > 0 && (
            <section className="mb-8">
              <SectionLabel>Captures</SectionLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {game.screenshots.map((url) => (
                  <button
                    key={url}
                    onClick={() => setLightbox(url)}
                    className="aspect-video overflow-hidden rounded-md border border-edge transition hover:border-edge-2"
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Achievements (dev-defined, admin-approved) */}
          {(() => {
            const approved = achievements.filter((a) => a.status === 'approved')
            const reviewable = achievements.filter((a) => a.status !== 'approved')
            if (approved.length === 0 && !isOwner) return null
            return (
              <section className="mb-8">
                <div className="mb-3 flex items-center gap-3">
                  <SectionLabel>Succès du jeu</SectionLabel>
                  {isOwner && (
                    <button
                      onClick={() => setProposingAchievement(true)}
                      className={`${btnGhost} -mt-3 ml-auto px-2.5 py-1 text-xs`}
                    >
                      + Proposer un succès
                    </button>
                  )}
                </div>
                {approved.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {approved.map((a) => (
                      <AchievementBadge key={a.id} achievement={a} />
                    ))}
                  </div>
                )}
                {isOwner && reviewable.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs tracking-wide text-ink-dim uppercase">
                      En validation
                    </p>
                    {reviewable.map((a) => (
                      <AchievementReviewCard key={a.id} achievement={a} />
                    ))}
                  </div>
                )}
                {approved.length === 0 && reviewable.length === 0 && isOwner && (
                  <p className="rounded-lg border border-dashed border-edge py-6 text-center text-sm text-ink-dim">
                    Propose des succès pour ton jeu — un admin les validera.
                  </p>
                )}
              </section>
            )
          })()}

          {/* Requests */}
          <section>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <SectionLabel>Demandes & retours</SectionLabel>
              <span className="-mt-3 text-xs text-ink-dim">
                {openCount} ouvertes · {closedCount} closes
              </span>
              <div className="ml-auto -mt-2 flex items-center gap-2">
                <div className="flex overflow-hidden rounded-md border border-edge">
                  {(
                    [
                      ['all', 'Tous'],
                      ['bug', '🐛 Bugs'],
                      ['feature', '✨ Features'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setTypeFilter(value)}
                      className={`px-2.5 py-1.5 text-xs font-medium transition ${
                        typeFilter === value
                          ? 'bg-accent text-abyss'
                          : 'bg-abyss text-ink-dim hover:text-ink'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <select
                  className="rounded-md border border-edge bg-abyss px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as Filter)}
                >
                  <option value="open_like">Ouvertes</option>
                  <option value="closed">Closes</option>
                  <option value="all">Toutes</option>
                  {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button onClick={() => setAddingRequest(true)} className={btnPrimary}>
                  + Bug / Feature
                </button>
              </div>
            </div>

            {visibleRequests.length === 0 ? (
              <div className="rounded-lg border border-dashed border-edge py-14 text-center text-sm text-ink-dim">
                Rien ici — signale un bug ou propose une feature.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleRequests.map((r) => (
                  <RequestCard key={r.id} game={game} request={r} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="space-y-2">
            {game.kind === 'download' && game.launchUrl && (
              <button
                onClick={() => void launchGame(user?.uid, game)}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-violet-500 py-3 text-base font-semibold text-white transition hover:bg-violet-400"
              >
                <DownloadIcon /> Télécharger
              </button>
            )}

            {game.kind === 'web' && game.launchUrl && (
              <button
                onClick={() => void launchGame(user?.uid, game)}
                className={`${btnPlay} w-full py-3 text-base`}
              >
                ▶ Jouer
              </button>
            )}

            {game.kind === 'embedded' && game.launchUrl && (
              <>
                <button
                  onClick={() => {
                    setEmbedRunning(true)
                    void launchGame(user?.uid, game)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className={`${btnPlay} w-full py-3 text-base`}
                >
                  ▶ Jouer
                </button>
                {/* Optional download button, right below "Jouer". */}
                {game.downloadUrl && (
                  <a
                    href={game.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-violet-500/40 py-2.5 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/10"
                  >
                    <DownloadIcon /> Télécharger
                  </a>
                )}
              </>
            )}
          </div>

          {game.kind === 'download' && (
            <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-4 text-sm">
              <p className="mb-1 font-semibold text-violet-300">Jeu à installer</p>
              <p className="text-ink-dim">
                Ce jeu ne se lance pas dans le navigateur : récupère-le depuis la
                page de téléchargement{game.repoUrl ? ' (releases du dépôt)' : ''}.
                Quand tu y joues, signale-le via ton menu profil (en haut à
                droite) — tes amis le verront.
              </p>
            </div>
          )}

          {game.kind === 'embedded' && (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm">
              <p className="mb-1 font-semibold text-emerald-300">Jouable sur le portail</p>
              <p className="text-ink-dim">
                Ce jeu se lance directement ici, sans rien installer : clique sur
                « Jouer » et il s'ouvre dans la page. Tes amis verront que tu y
                joues.
              </p>
            </div>
          )}

          {playersNow.length > 0 && (
            <div>
              <SectionLabel>En jeu maintenant</SectionLabel>
              <div className="space-y-1.5">
                {playersNow.map(([uid]) => (
                  <div key={uid} className="flex items-center gap-2 text-sm">
                    <Avatar user={users[uid]} size="sm" online />
                    {users[uid]?.displayName ?? '???'}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <SectionLabel>Infos</SectionLabel>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-dim">Type</dt>
                <dd>{GAME_KIND_LABELS[game.kind]}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-dim">Créé par</dt>
                <dd>
                  <Link
                    to={`/profile/${game.createdBy}`}
                    className="hover:text-accent hover:underline"
                  >
                    {users[game.createdBy]?.displayName ?? '???'}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-dim">Ajouté le</dt>
                <dd>{new Date(game.createdAt).toLocaleDateString('fr-FR')}</dd>
              </div>
              {game.repoUrl && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-dim">Code</dt>
                  <dd>
                    <a
                      href={game.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      dépôt
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div>
            <SectionLabel>Développeurs</SectionLabel>
            <div className="space-y-1.5">
              {game.ownerUids.map((uid) => (
                <Link
                  key={uid}
                  to={`/profile/${uid}`}
                  className="flex items-center gap-2 text-sm transition hover:text-accent"
                >
                  <Avatar user={users[uid]} size="sm" />
                  {users[uid]?.displayName ?? '???'}
                </Link>
              ))}
            </div>
          </div>

          {game.tags.length > 0 && (
            <div>
              <SectionLabel>Tags</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {game.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-panel-2 px-2 py-0.5 text-xs text-ink-dim"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isOwner && (
            <div className="space-y-2 border-t border-edge pt-4">
              <button onClick={() => setEditing(true)} className={`${btnGhost} w-full`}>
                Modifier
              </button>
              <button onClick={() => setAnnouncing(true)} className={`${btnGhost} w-full`}>
                {game.update ? 'Gérer la mise à jour' : '📣 Annoncer une mise à jour'}
              </button>
              <button
                onClick={() => void setArchived(game.id, !game.archived)}
                className={`${btnGhost} w-full`}
              >
                {game.archived ? 'Désarchiver' : 'Archiver'}
              </button>
              {user?.isAdmin && game.approved && (
                <button
                  onClick={() => void approveGame(game.id, false)}
                  className={`${btnGhost} w-full`}
                  title="Repasse le jeu en attente de validation"
                >
                  Dépublier
                </button>
              )}
              {user?.isAdmin && (
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Supprimer définitivement « ${game.title} » et toutes ses demandes ?`,
                      )
                    ) {
                      void deleteGame(game.id).then(() => navigate('/'))
                    }
                  }}
                  className={`${btnDanger} w-full`}
                >
                  Supprimer (admin)
                </button>
              )}
            </div>
          )}
        </aside>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-md" />
        </div>
      )}

      {editing && <GameFormModal game={game} onClose={() => setEditing(false)} />}
      {announcing && <GameUpdateModal game={game} onClose={() => setAnnouncing(false)} />}
      {addingRequest && (
        <RequestForm gameId={game.id} onClose={() => setAddingRequest(false)} />
      )}
      {proposingAchievement && (
        <AchievementFormModal
          gameId={game.id}
          onClose={() => setProposingAchievement(false)}
        />
      )}
    </div>
  )
}
