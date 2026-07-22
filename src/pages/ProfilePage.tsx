import { useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ProfileEditor } from '../components/auth/ProfileEditor'
import { GameFormModal } from '../components/games/GameFormModal'
import { GameCard } from '../components/library/GameCard'
import { Avatar, SectionLabel, btnGhost, btnPrimary } from '../components/ui'
import { coverFallback } from '../lib/cover'
import { useMetaProfile } from '../lib/hooks'
import {
  resolveProfileAccent,
  resolveProfileBackground,
  resolveProfileTitle,
} from '../lib/profileCustomization'
import { computeMetaAchievements } from '../lib/achievements'
import type { PlayEntry } from '../lib/types'
import { PORTAL_SCOPE, friendshipId, isRequestClosed } from '../lib/types'
import { useAuthStore } from '../stores/authStore'
import { useFriendsStore } from '../stores/friendsStore'
import { canSeeGame, useGamesStore } from '../stores/gamesStore'
import { usePresenceStore } from '../stores/presenceStore'
import { useUsersStore } from '../stores/usersStore'

/** Compact FR relative time ("il y a 3 h", "hier", "il y a 5 j"). */
function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'hier'
  if (d < 30) return `il y a ${d} j`
  return new Date(ts).toLocaleDateString('fr-FR')
}

function StatTile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-lg border border-edge bg-panel p-4 text-center">
      <p className="font-display text-2xl font-bold text-accent">{value}</p>
      <p className="mt-0.5 text-xs text-ink-dim">{label}</p>
    </div>
  )
}

export function ProfilePage() {
  const { uid } = useParams()
  const me = useAuthStore((s) => s.user)
  const users = useUsersStore((s) => s.users)
  const games = useGamesStore((s) => s.games)
  const presence = usePresenceStore((s) => s.presence)
  const sendFriendRequest = useFriendsStore((s) => s.sendRequest)
  const myFriendships = useFriendsStore((s) => s.friendships)

  const [editing, setEditing] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const profile = uid ? users[uid] : undefined
  const isSelf = Boolean(me && uid && me.uid === uid)

  // Everything the badges and activity lists derive from (shared with the
  // profile editor, which uses the same stats to gate earned titles).
  const { stats, requests: theirRequests, plays } = useMetaProfile(uid, games)

  if (!uid || !profile) {
    return (
      <div className="py-20 text-center text-ink-dim">
        Profil introuvable.{' '}
        <Link to="/" className="text-accent hover:underline">
          Retour
        </Link>
      </div>
    )
  }

  const p = presence[uid]
  const playing = p?.online ? p.playing : null

  const ownedGames = games.filter(
    (g) => g.ownerUids.includes(uid) && !g.archived && canSeeGame(me, g),
  )

  const achievements = computeMetaAchievements(stats).sort(
    (a, b) => Number(b.earned) - Number(a.earned),
  )
  const earnedCount = achievements.filter((a) => a.earned).length

  const relation = me ? myFriendships.find((f) => f.id === friendshipId(me.uid, uid)) : undefined

  const backgroundCss = resolveProfileBackground(profile.profileBackground)
  const title = resolveProfileTitle(profile.profileTitle)
  const accent = resolveProfileAccent(profile.profileAccent)
  // Overriding the theme variable re-themes every `text-accent` / `bg-accent`
  // inside this subtree at once — no per-element color plumbing.
  const accentStyle = accent ? ({ '--color-accent': accent } as CSSProperties) : undefined
  const favoriteGame = profile.favoriteGameId
    ? games.find((g) => g.id === profile.favoriteGameId && canSeeGame(me, g))
    : undefined

  return (
    <div className="relative z-10 mx-auto max-w-4xl" style={accentStyle}>
      {/*
        Steam-style: the chosen background themes the whole profile page.
        The root div above (`relative z-10`) establishes its OWN stacking
        context, nested one level below Shell's plain (non-positioned) .bp-bg
        wrapper. That z-10 is what lifts this whole page above Shell's own
        opaque background at the OUTER level. Within this page's own local
        context, the fixed layer below must stay NEGATIVE z-index so it
        paints behind this page's other (non-positioned, i.e. `static`)
        children — a non-negative z-index here would paint it OVER them
        instead, since positioned descendants (step 6) paint after
        non-positioned in-flow ones (step 3) within the SAME stacking
        context. Negative pairs with positive-on-the-wrapper; z-0 does not.
      */}
      {backgroundCss && (
        <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0" style={{ background: backgroundCss }} />
          <div className="absolute inset-0 bg-abyss/45" />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start gap-5 rounded-lg border border-edge bg-panel p-6">
        <Avatar user={profile} size="lg" online={p?.online ?? false} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {profile.displayName}
            </h1>
            {profile.isAdmin && (
              <span className="rounded border border-accent/40 px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                ADMIN
              </span>
            )}
          </div>
          {title && (
            <p className="mt-0.5 text-sm font-medium tracking-wide text-accent">« {title} »</p>
          )}
          <p className="mt-0.5 text-sm text-ink-dim">
            {playing ? (
              <Link
                to={`/game/${playing.gameId}`}
                className="font-medium text-emerald-400 hover:underline"
              >
                🎮 Joue à {playing.title}
              </Link>
            ) : p?.online ? (
              <span className="text-emerald-400">En ligne</span>
            ) : (
              'Hors ligne'
            )}
            <span className="mx-2 text-ink-dim/50">·</span>
            membre depuis le {new Date(profile.createdAt).toLocaleDateString('fr-FR')}
          </p>
          {profile.bio && <p className="mt-3 text-ink/90 italic">« {profile.bio} »</p>}
        </div>
        <div className="flex flex-col gap-2">
          {isSelf && (
            <button onClick={() => setEditing(true)} className={btnGhost}>
              Modifier le profil
            </button>
          )}
          {!isSelf && me && !relation && (
            <button
              onClick={() => void sendFriendRequest(me.uid, uid)}
              className={btnPrimary}
            >
              + Demander en ami
            </button>
          )}
          {!isSelf && relation?.status === 'pending' && (
            <span className="rounded-md border border-edge px-3 py-2 text-center text-sm text-ink-dim">
              Demande en attente…
            </span>
          )}
          {!isSelf && relation?.status === 'accepted' && (
            <span className="rounded-md border border-emerald-500/30 px-3 py-2 text-center text-sm text-emerald-400">
              ✓ Amis
            </span>
          )}
        </div>
      </div>

      {/* Stats, Steam-style */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile value={stats.publishedGames} label="jeux publiés" />
        <StatTile value={stats.messages} label="messages envoyés" />
        <StatTile value={theirRequests.length} label="bugs & features signalés" />
        <StatTile value={stats.upvotesReceived} label="upvotes reçus" />
        <StatTile value={stats.friends} label="amis" />
      </div>

      {/* Showcase — one pinned game, Steam's "featured" slot. */}
      {favoriteGame && (
        <section className="mt-8">
          <SectionLabel>Jeu vitrine</SectionLabel>
          <Link
            to={`/game/${favoriteGame.id}`}
            className="flex items-center gap-4 overflow-hidden rounded-lg border border-accent/30 bg-gradient-to-r from-accent/10 to-panel p-4 transition hover:border-accent/60"
          >
            <div
              className="hidden aspect-video w-40 shrink-0 rounded-md border border-edge bg-cover bg-center sm:block"
              style={
                favoriteGame.coverUrl
                  ? { backgroundImage: `url(${favoriteGame.coverUrl})` }
                  : { background: coverFallback(favoriteGame.id) }
              }
            />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold">{favoriteGame.title}</p>
              {favoriteGame.tagline && (
                <p className="mt-0.5 line-clamp-2 text-sm text-ink-dim">
                  {favoriteGame.tagline}
                </p>
              )}
              <p className="mt-1.5 text-xs text-accent">Le coup de cœur de {profile.displayName} →</p>
            </div>
          </Link>
        </section>
      )}

      {/* Achievements — portal meta-badges, computed live from the data above */}
      <section className="mt-8">
        <SectionLabel>
          Succès ({earnedCount}/{achievements.length})
        </SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {achievements.map(({ def, value, earned }) => (
            <div
              key={def.id}
              title={def.description}
              className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                earned
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-edge bg-panel opacity-60'
              }`}
            >
              <span className={`text-2xl ${earned ? '' : 'grayscale'}`}>{def.icon}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{def.title}</p>
                {earned ? (
                  <p className="truncate text-xs text-amber-400/90">Débloqué</p>
                ) : (
                  <p className="truncate text-xs text-ink-dim">
                    {Math.min(value, def.goal)} / {def.goal}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Their games */}
      <section className="mt-8">
        <SectionLabel>
          {isSelf ? 'Mes jeux' : `Jeux de ${profile.displayName}`} ({ownedGames.length})
        </SectionLabel>
        {ownedGames.length === 0 ? (
          <p className="rounded-lg border border-dashed border-edge p-6 text-sm text-ink-dim">
            {isSelf
              ? 'Aucun jeu pour l’instant — le tien mérite sa place juste en dessous. ↓'
              : 'Aucun jeu publié pour l’instant.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ownedGames.map((g) => (
              <GameCard key={g.id} game={g} playersCount={0} />
            ))}
          </div>
        )}
      </section>

      {/* Play history — recent launches (accurate for embedded, declared for
          the rest). `plays` logs every launch (needed for the "Habitué"
          achievement's raw count), but re-launching the same game in a row
          shouldn't repeat it 8 times here — collapse to one row per game,
          keeping its most recent launch (list already comes newest-first). */}
      {plays.length > 0 && (
        <section className="mt-8">
          <SectionLabel>Parties récentes</SectionLabel>
          <div className="space-y-1.5">
            {Object.values(
              plays.reduce<Record<string, PlayEntry>>((byGame, play) => {
                byGame[play.gameId] ??= play
                return byGame
              }, {}),
            )
              .sort((a, b) => b.at - a.at)
              .slice(0, 8)
              .map((play) => {
                const game = games.find((g) => g.id === play.gameId)
                return (
                  <Link
                    key={play.id}
                    to={`/game/${play.gameId}`}
                    className="flex items-center gap-2 rounded-md border border-edge bg-panel px-3 py-2 text-sm transition hover:border-edge-2"
                  >
                    <span className="text-emerald-400">🎮</span>
                    <span className="truncate">{game?.title ?? play.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-ink-dim">
                      {relativeTime(play.at)}
                    </span>
                  </Link>
                )
              })}
          </div>
        </section>
      )}

      {/* Recent activity: their latest open requests */}
      {theirRequests.length > 0 && (
        <section className="mt-8">
          <SectionLabel>Dernières demandes</SectionLabel>
          <div className="space-y-1.5">
            {[...theirRequests]
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, 5)
              .map((r) => {
                const game = games.find((g) => g.id === r.gameId)
                const target = r.gameId === PORTAL_SCOPE ? 'le portail' : game?.title ?? '?'
                return (
                  <Link
                    key={`${r.gameId}/${r.id}`}
                    to={r.gameId === PORTAL_SCOPE ? '/forum' : `/game/${r.gameId}`}
                    className="flex items-center gap-2 rounded-md border border-edge bg-panel px-3 py-2 text-sm transition hover:border-edge-2"
                  >
                    <span className={r.type === 'bug' ? 'text-rose-400' : 'text-accent'}>
                      {r.type === 'bug' ? '●' : '◆'}
                    </span>
                    <span className="truncate">{r.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-ink-dim">
                      {target}
                      {isRequestClosed(r.status) ? ' · clos' : ''}
                    </span>
                  </Link>
                )
              })}
          </div>
        </section>
      )}

      {/* Publish-a-game pitch (own profile only) */}
      {isSelf && (
        <section className="mt-10">
          <div className="relative overflow-hidden rounded-lg border border-accent/30 bg-gradient-to-r from-accent/10 via-panel to-panel p-6">
            <p className="font-display text-xl font-bold">Tu as un jeu qui traîne ?</p>
            <p className="mt-1 max-w-xl text-sm text-ink-dim">
              Prototype de game jam, extension Chrome, projet du dimanche — s'il se
              lance, il a sa place ici. Publie-le, le groupe le teste, te remonte les
              bugs et vote pour tes prochaines features. C'est exactement pour ça
              qu'Epigames existe.
            </p>
            <button onClick={() => setPublishing(true)} className={`${btnPrimary} mt-4`}>
              🚀 Publier un jeu
            </button>
            <span className="pointer-events-none absolute -right-6 -bottom-8 text-8xl opacity-10">
              🕹️
            </span>
          </div>
        </section>
      )}

      {editing && <ProfileEditor onClose={() => setEditing(false)} />}
      {publishing && <GameFormModal onClose={() => setPublishing(false)} />}
    </div>
  )
}
