import { useMemo, useState } from 'react'
import { ChatChannel } from '../components/forum/ChatChannel'
import { RequestCard } from '../components/requests/RequestCard'
import { RequestForm } from '../components/requests/RequestForm'
import { btnPrimary } from '../components/ui'
import { useRequestsMap } from '../lib/hooks'
import type { Game } from '../lib/types'
import { PORTAL_SCOPE, isRequestClosed, normalizeGame } from '../lib/types'
import { useAuthStore } from '../stores/authStore'
import { canSeeGame, useGamesStore } from '../stores/gamesStore'

type View = 'general' | 'requests'

interface Selection {
  scope: string
  view: View
}

/** Synthetic "game" carrying the portal's own request threads (triage = admin). */
const PORTAL_GAME: Game = normalizeGame({
  id: PORTAL_SCOPE,
  title: 'Portail Epigames',
})

export function ForumPage() {
  const user = useAuthStore((s) => s.user)
  const games = useGamesStore((s) => s.games)
  const [selection, setSelection] = useState<Selection>({
    scope: PORTAL_SCOPE,
    view: 'general',
  })
  const [addingRequest, setAddingRequest] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'bug' | 'feature'>('all')
  // Mobile: the triage sidebar is a collapsible drawer (it's a long list, so
  // showing it stacked above the content on every visit would bury the chat).
  const [navOpen, setNavOpen] = useState(false)

  // Selecting a channel also closes the mobile drawer.
  const select = (next: Selection) => {
    setSelection(next)
    setNavOpen(false)
  }

  const visibleGames = useMemo(
    () => games.filter((g) => !g.archived && canSeeGame(user, g)),
    [games, user],
  )
  const requestsMap = useRequestsMap([
    PORTAL_SCOPE,
    ...visibleGames.map((g) => g.id),
  ])

  const openCount = (scope: string) =>
    (requestsMap[scope] ?? []).filter((r) => !isRequestClosed(r.status)).length

  const selectedGame =
    selection.scope === PORTAL_SCOPE
      ? PORTAL_GAME
      : (visibleGames.find((g) => g.id === selection.scope) ?? PORTAL_GAME)

  const selectedRequests = useMemo(() => {
    const list = (requestsMap[selection.scope] ?? []).filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      return showClosed ? true : !isRequestClosed(r.status)
    })
    return [...list].sort((a, b) => {
      const diff = Object.keys(b.upvotes).length - Object.keys(a.upvotes).length
      return diff !== 0 ? diff : b.createdAt - a.createdAt
    })
  }, [requestsMap, selection.scope, showClosed, typeFilter])

  const entryCls = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition ${
      active ? 'bg-accent/15 text-accent' : 'text-ink-dim hover:bg-panel-2 hover:text-ink'
    }`

  function channelEntries(scope: string, isPortal: boolean) {
    const open = openCount(scope)
    return (
      <>
        <button
          onClick={() => select({ scope, view: 'general' })}
          className={entryCls(selection.scope === scope && selection.view === 'general')}
        >
          <span className="text-ink-dim/70">#</span> Général
        </button>
        <button
          onClick={() => select({ scope, view: 'requests' })}
          className={entryCls(selection.scope === scope && selection.view === 'requests')}
        >
          <span className="text-ink-dim/70">◌</span>
          {isPortal ? 'Bugs & features du portail' : 'Bugs & features'}
          {open > 0 && (
            <span className="ml-auto rounded-full bg-panel-2 px-1.5 text-xs font-semibold text-ink-dim">
              {open}
            </span>
          )}
        </button>
        {/* Latest threads, GitHub-issues style, directly in the triage bar */}
        {(requestsMap[scope] ?? [])
          .filter((r) => !isRequestClosed(r.status))
          .slice(0, 4)
          .map((r) => (
            <button
              key={r.id}
              onClick={() => select({ scope, view: 'requests' })}
              className="flex w-full items-center gap-1.5 rounded px-2.5 py-0.5 text-left text-xs text-ink-dim/70 transition hover:text-ink"
              title={r.title}
            >
              <span className={r.type === 'bug' ? 'text-rose-400/80' : 'text-accent/80'}>
                {r.type === 'bug' ? '●' : '◆'}
              </span>
              <span className="truncate">{r.title}</span>
            </button>
          ))}
      </>
    )
  }

  const currentLabel =
    (selection.scope === PORTAL_SCOPE ? 'Portail' : selectedGame.title) +
    (selection.view === 'general' ? ' · # Général' : ' · ◌ Bugs & features')

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Mobile channel picker toggle */}
      <button
        onClick={() => setNavOpen((v) => !v)}
        className="flex items-center justify-between gap-2 rounded-lg border border-edge bg-panel px-3 py-2.5 text-sm lg:hidden"
        aria-expanded={navOpen}
      >
        <span className="min-w-0 truncate">
          <span className="text-ink-dim">Salon : </span>
          <span className="font-medium">{currentLabel}</span>
        </span>
        <span className="shrink-0 text-ink-dim">{navOpen ? '▲' : '▼'}</span>
      </button>

      {/* Triage sidebar */}
      <aside
        className={`${navOpen ? 'block' : 'hidden'} lg:block lg:sticky lg:top-20 lg:self-start`}
      >
        <div className="space-y-5 rounded-lg border border-edge bg-panel p-3">
          <div>
            <p className="mb-1.5 px-2 text-xs font-semibold tracking-[0.15em] text-ink-dim uppercase">
              Portail
            </p>
            <div className="space-y-0.5">{channelEntries(PORTAL_SCOPE, true)}</div>
          </div>
          {visibleGames.map((g) => (
            <div key={g.id}>
              <p className="mb-1.5 truncate px-2 text-xs font-semibold tracking-[0.15em] text-ink-dim uppercase">
                {g.title}
              </p>
              <div className="space-y-0.5">{channelEntries(g.id, false)}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main area */}
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {selectedGame.title === PORTAL_GAME.title && selection.scope === PORTAL_SCOPE
              ? 'Portail'
              : selectedGame.title}
            <span className="ml-2 text-ink-dim">
              {selection.view === 'general' ? '# Général' : '◌ Bugs & features'}
            </span>
          </h1>
          {selection.view === 'requests' && (
            <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
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
                        : 'bg-panel text-ink-dim hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-sm text-ink-dim">
                <input
                  type="checkbox"
                  checked={showClosed}
                  onChange={(e) => setShowClosed(e.target.checked)}
                  className="accent-accent"
                />
                Closes
              </label>
              <button onClick={() => setAddingRequest(true)} className={btnPrimary}>
                + Bug / Feature
              </button>
            </div>
          )}
        </div>

        {selection.view === 'general' ? (
          <ChatChannel
            key={selection.scope}
            scopeId={selection.scope}
            placeholder={
              selection.scope === PORTAL_SCOPE
                ? 'Discuter avec tout le monde…'
                : `Discuter de ${selectedGame.title}…`
            }
          />
        ) : selectedRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-edge py-16 text-center text-sm text-ink-dim">
            Aucun fil ici — signale un bug ou propose une feature.
          </div>
        ) : (
          <div className="space-y-3">
            {selectedRequests.map((r) => (
              <RequestCard key={r.id} game={selectedGame} request={r} />
            ))}
          </div>
        )}
      </div>

      {addingRequest && (
        <RequestForm gameId={selection.scope} onClose={() => setAddingRequest(false)} />
      )}
    </div>
  )
}
