import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GameCard } from '../components/library/GameCard'
import { DownloadIcon, inputCls } from '../components/ui'
import { useRequestsMap } from '../lib/hooks'
import type { Game, GameKind, GameStatus } from '../lib/types'
import { isRequestClosed } from '../lib/types'
import { useAuthStore } from '../stores/authStore'
import { canSeeGame, useGamesStore } from '../stores/gamesStore'
import { usePresenceStore } from '../stores/presenceStore'

const SECTIONS: { status: GameStatus; title: string; hint?: string }[] = [
  { status: 'live', title: 'Jouables maintenant' },
  { status: 'dev', title: 'En développement', hint: 'testables, retours bienvenus' },
  { status: 'planned', title: 'À venir' },
  { status: 'paused', title: 'En pause' },
]

const KIND_FILTERS: { value: GameKind | 'all'; label: ReactNode }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'embedded', label: '▶ Sur le portail' },
  { value: 'web', label: '🌐 Jouables en ligne' },
  {
    value: 'download',
    label: (
      <>
        <DownloadIcon /> À installer
      </>
    ),
  },
]

export function LibraryPage() {
  const user = useAuthStore((s) => s.user)
  const { games, loaded } = useGamesStore()
  const presence = usePresenceStore((s) => s.presence)
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<GameKind | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const playersByGame = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of Object.values(presence)) {
      if (p.online && p.playing) {
        counts[p.playing.gameId] = (counts[p.playing.gameId] ?? 0) + 1
      }
    }
    return counts
  }, [presence])

  const listable = games.filter((g) => canSeeGame(user, g))
  const allTags = useMemo(
    () => [...new Set(listable.flatMap((g) => g.tags))].sort(),
    [listable],
  )
  const requestsMap = useRequestsMap(listable.map((g) => g.id))

  // Hide a kind tab entirely while no game of that kind exists yet — an
  // always-empty filter is just clutter (e.g. "Sur le portail" before the
  // first embedded game ships).
  const visibleKindFilters = useMemo(
    () =>
      KIND_FILTERS.filter(
        (k) => k.value === 'all' || listable.some((g) => g.kind === k.value),
      ),
    [listable],
  )

  const filtered = listable
    .filter((g) => {
      if (g.archived !== showArchived) return false
      if (kindFilter !== 'all' && g.kind !== kindFilter) return false
      if (tagFilter && !g.tags.includes(tagFilter)) return false
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (
        g.title.toLowerCase().includes(q) ||
        g.tagline.toLowerCase().includes(q) ||
        g.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
    // Busiest first inside each group, then newest.
    .sort((a, b) => {
      const diff = (playersByGame[b.id] ?? 0) - (playersByGame[a.id] ?? 0)
      return diff !== 0 ? diff : b.createdAt - a.createdAt
    })

  // Status sections keep browsing logical; collapse to a flat grid while searching.
  const flatMode = search.trim() !== '' || showArchived

  const openRequestsOf = (g: Game) =>
    (requestsMap[g.id] ?? []).filter((r) => !isRequestClosed(r.status)).length

  const renderGrid = (list: Game[]) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((g) => (
        <GameCard
          key={g.id}
          game={g}
          playersCount={playersByGame[g.id] ?? 0}
          openRequests={openRequestsOf(g)}
          onTagClick={(t) => setTagFilter(t)}
        />
      ))}
    </div>
  )

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">Bibliothèque</h1>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inputCls} w-52`}
              placeholder="Rechercher un jeu, un tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label className="flex items-center gap-1.5 text-sm text-ink-dim">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="accent-accent"
              />
              Archivés
            </label>
          </div>
          {user && (
            <p className="text-xs text-ink-dim">
              Un jeu qui traîne ?{' '}
              <Link to={`/profile/${user.uid}`} className="text-accent hover:underline">
                Propose-le depuis ta page profil
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      {/* Kind filter + tags menu */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-edge">
          {visibleKindFilters.map((k) => (
            <button
              key={k.value}
              onClick={() => setKindFilter(k.value)}
              className={`px-3 py-1.5 text-sm font-medium transition ${
                kindFilter === k.value
                  ? 'bg-accent text-abyss'
                  : 'bg-panel text-ink-dim hover:text-ink'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {allTags.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setTagsOpen((v) => !v)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                tagFilter
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-edge bg-panel text-ink-dim hover:text-ink'
              }`}
            >
              {tagFilter ? `Tag : ${tagFilter} ✕` : 'Tags ▾'}
            </button>
            {tagsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setTagsOpen(false)} />
                <div className="absolute z-50 mt-2 flex max-h-60 w-56 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-edge bg-panel p-3 shadow-2xl">
                  {allTags.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTagFilter(tagFilter === t ? null : t)
                        setTagsOpen(false)
                      }}
                      className={`rounded px-2 py-0.5 text-xs font-medium transition ${
                        tagFilter === t
                          ? 'bg-accent text-abyss'
                          : 'bg-panel-2 text-ink-dim hover:text-ink'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!loaded ? (
        <p className="py-20 text-center text-ink-dim">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-edge py-20 text-center text-ink-dim">
          {listable.length === 0
            ? 'Aucun jeu pour l’instant — publie le tien depuis ton profil !'
            : 'Aucun jeu ne correspond aux filtres.'}
        </div>
      ) : flatMode ? (
        renderGrid(filtered)
      ) : (
        <div className="space-y-10">
          {SECTIONS.map(({ status, title, hint }) => {
            const list = filtered.filter((g) => g.status === status)
            if (list.length === 0) return null
            return (
              <section key={status}>
                <div className="mb-3 flex items-baseline gap-3">
                  <h2 className="font-display text-lg font-semibold">{title}</h2>
                  <span className="text-xs text-ink-dim">
                    {list.length}
                    {hint ? ` · ${hint}` : ''}
                  </span>
                </div>
                {renderGrid(list)}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
