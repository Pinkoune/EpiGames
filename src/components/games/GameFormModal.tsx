import { useMemo, useState, type FormEvent } from 'react'
import type { NewGameInput } from '../../lib/backend/types'
import type { Game, GameKind, GameStatus } from '../../lib/types'
import { GAME_KIND_LABELS, GAME_STATUS_LABELS } from '../../lib/types'
import { useAuthStore } from '../../stores/authStore'
import { useGamesStore } from '../../stores/gamesStore'
import { useUsersStore } from '../../stores/usersStore'
import { Modal, btnPrimary, inputCls } from '../ui'

/** Add (game undefined) or edit (game set) a game. */
export function GameFormModal({ game, onClose }: { game?: Game; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const users = useUsersStore((s) => s.users)
  const games = useGamesStore((s) => s.games)
  const { addGame, updateGame } = useGamesStore()

  const [title, setTitle] = useState(game?.title ?? '')
  const [tagline, setTagline] = useState(game?.tagline ?? '')
  const [description, setDescription] = useState(game?.description ?? '')
  const [kind, setKind] = useState<GameKind>(game?.kind ?? 'web')
  const [coverUrl, setCoverUrl] = useState(game?.coverUrl ?? '')
  const [screenshotsRaw, setScreenshotsRaw] = useState(game?.screenshots.join('\n') ?? '')
  const [launchUrl, setLaunchUrl] = useState(game?.launchUrl ?? '')
  const [repoUrl, setRepoUrl] = useState(game?.repoUrl ?? '')
  const [status, setStatus] = useState<GameStatus>(game?.status ?? 'dev')
  const [tagsRaw, setTagsRaw] = useState(game?.tags.join(', ') ?? '')
  const [ownerUids, setOwnerUids] = useState<string[]>(
    game?.ownerUids ?? (user ? [user.uid] : []),
  )
  const [busy, setBusy] = useState(false)

  const knownTags = useMemo(
    () => [...new Set(games.flatMap((g) => g.tags))].sort(),
    [games],
  )

  if (!user) return null

  function toggleOwner(uid: string) {
    setOwnerUids((prev) =>
      prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid],
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const owners = ownerUids.length > 0 ? ownerUids : [user.uid]
    const input: NewGameInput = {
      title: title.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      kind,
      coverUrl: coverUrl.trim(),
      screenshots: screenshotsRaw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      launchUrl: launchUrl.trim(),
      repoUrl: repoUrl.trim(),
      status,
      tags: tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      ownerUids: owners,
    }
    setBusy(true)
    try {
      if (game) await updateGame(game.id, input)
      // Admin publishes directly; dev submissions await admin approval.
      else await addGame(input, user.uid, user.isAdmin)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={game ? 'Modifier le jeu' : 'Ajouter un jeu'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {!game && !user.isAdmin && (
          <p className="rounded-md border border-amber-500/25 px-3 py-2 text-xs text-amber-400/90">
            Ta soumission sera envoyée aux admins pour validation — en attendant,
            seuls toi et les co-propriétaires la verront dans la bibliothèque.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-ink-dim">Titre *</label>
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={60}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-dim">Type</label>
            <select
              className={inputCls}
              value={kind}
              onChange={(e) => setKind(e.target.value as GameKind)}
            >
              {Object.entries(GAME_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-dim">Tagline</label>
          <input
            className={inputCls}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={120}
            placeholder="Une phrase d'accroche"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-dim">Description</label>
          <textarea
            className={`${inputCls} resize-y`}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            placeholder={'Présentation complète du jeu, façon page itch.io.\nMarkdown supporté : titres, **gras**, listes, liens, images…'}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-ink-dim">
              {kind === 'download' ? 'URL de téléchargement *' : 'URL de lancement'}
            </label>
            <input
              className={inputCls}
              type="url"
              value={launchUrl}
              onChange={(e) => setLaunchUrl(e.target.value)}
              required={kind === 'download'}
              placeholder={
                kind === 'download'
                  ? 'https://github.com/…/releases'
                  : 'https://mon-jeu.example.com'
              }
            />
            {kind === 'download' && (
              <p className="mt-1 text-xs text-ink-dim/70">
                Ex. la page releases GitHub d'une extension Chrome.
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-dim">Repo (optionnel)</label>
            <input
              className={inputCls}
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/…"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-ink-dim">Cover (URL image)</label>
            <input
              className={inputCls}
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="Vide = visuel généré"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-dim">Statut</label>
            <select
              className={inputCls}
              value={status}
              onChange={(e) => setStatus(e.target.value as GameStatus)}
            >
              {Object.entries(GAME_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-dim">
            Screenshots (une URL par ligne)
          </label>
          <textarea
            className={`${inputCls} resize-y`}
            rows={3}
            value={screenshotsRaw}
            onChange={(e) => setScreenshotsRaw(e.target.value)}
            placeholder={'https://…/screen1.png\nhttps://…/screen2.png'}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-dim">Tags (virgules)</label>
          <input
            className={inputCls}
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="multi, puzzle, extension…"
            list="known-tags"
          />
          {knownTags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {knownTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    const current = tagsRaw
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean)
                    if (!current.includes(t)) setTagsRaw([...current, t].join(', '))
                  }}
                  className="rounded bg-panel-2 px-1.5 py-0.5 text-[11px] text-ink-dim transition hover:text-ink"
                >
                  + {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-dim">Propriétaires (devs)</label>
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {Object.values(users).map((u) => (
              <button
                key={u.uid}
                type="button"
                onClick={() => toggleOwner(u.uid)}
                className={`rounded-md border px-3 py-1 text-sm transition ${
                  ownerUids.includes(u.uid)
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-edge text-ink-dim hover:border-edge-2'
                }`}
              >
                {u.avatar} {u.displayName}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
          {game ? 'Enregistrer' : user.isAdmin ? 'Publier' : 'Soumettre pour validation'}
        </button>
      </form>
    </Modal>
  )
}
