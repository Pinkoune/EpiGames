import { useRef, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { canSeeGame, useGamesStore } from '../../stores/gamesStore'
import { computeMetaAchievements } from '../../lib/achievements'
import { useMetaProfile } from '../../lib/hooks'
import {
  AVATAR_FRAMES,
  PROFILE_ACCENTS,
  PROFILE_BACKGROUNDS,
  PROFILE_TITLES,
  isCustomBackground,
  resolveProfileBackground,
} from '../../lib/profileCustomization'
import { Avatar, Modal, btnGhost, btnPrimary, inputCls } from '../ui'

const AVATARS = ['🎮', '🕹️', '👾', '🤖', '🐉', '🦊', '🐸', '🧙', '🥷', '🚀', '⚔️', '🎲']

/**
 * Custom pictures are resized client-side to a small square JPEG data URL
 * and stored directly on the user doc — no file storage needed. The rules
 * cap the avatar field size, so oversized payloads are rejected server-side.
 */
const AVATAR_PX = 128
const MAX_DATA_URL_CHARS = 40_000

async function fileToAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_PX
  canvas.height = AVATAR_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponible.')
  // Center-crop to a square, then downscale.
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_PX,
    AVATAR_PX,
  )
  let quality = 0.85
  let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.3) {
    quality -= 0.15
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    throw new Error('Image trop lourde même compressée — essaie une autre.')
  }
  return dataUrl
}

export function ProfileEditor({ onClose }: { onClose: () => void }) {
  const { user, updateProfile } = useAuthStore()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [avatar, setAvatar] = useState(user?.avatar ?? '🎮')
  const [avatarUrl, setAvatarUrl] = useState(
    user?.avatar?.startsWith('http') ? user.avatar : '',
  )
  const [bio, setBio] = useState(user?.bio ?? '')
  const [frame, setFrame] = useState(user?.profileFrame ?? 'none')
  const [background, setBackground] = useState(user?.profileBackground ?? 'none')
  const [backgroundUrl, setBackgroundUrl] = useState(
    user?.profileBackground && isCustomBackground(user.profileBackground)
      ? user.profileBackground
      : '',
  )
  const [title, setTitle] = useState(user?.profileTitle ?? 'none')
  const [accent, setAccent] = useState(user?.profileAccent ?? 'default')
  const [favoriteGameId, setFavoriteGameId] = useState(user?.favoriteGameId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const games = useGamesStore((s) => s.games)
  // Titles are gated on meta-achievements — same computation the profile page
  // uses, so what's unlocked here always matches the badges shown there.
  const { stats } = useMetaProfile(user?.uid, games)
  const earnedIds = new Set(
    computeMetaAchievements(stats)
      .filter((a) => a.earned)
      .map((a) => a.def.id),
  )
  const showcaseGames = games.filter((g) => !g.archived && canSeeGame(user, g))

  // Split the (now long) frame list so animated options are easy to find.
  const frameEntries = Object.entries(AVATAR_FRAMES)
  const staticFrames = frameEntries.filter(([, f]) => !f.animation)
  const animatedFrames = frameEntries.filter(([, f]) => f.animation)

  async function pickFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      setAvatar(await fileToAvatar(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await updateProfile({
        displayName: displayName.trim(),
        avatar,
        bio: bio.trim(),
        profileFrame: frame,
        // A custom URL always wins over the preset picker below it.
        profileBackground: backgroundUrl.trim() || background,
        profileTitle: title,
        profileAccent: accent,
        favoriteGameId,
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Mon profil" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-ink-dim">Pseudo</label>
          <input
            className={inputCls}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={30}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-dim">Photo de profil</label>
          <div className="flex items-center gap-3">
            <Avatar user={{ avatar, displayName }} size="lg" />
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className={`${btnGhost} px-3 py-1.5 text-xs`}
              >
                Importer une image…
              </button>
              <p className="text-xs text-ink-dim/70">
                Recadrée en carré, {AVATAR_PX}px — ou choisis un emoji :
              </p>
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAvatar(a)}
                className={`flex h-10 w-10 items-center justify-center rounded-md border text-xl transition ${
                  avatar === a
                    ? 'border-accent bg-accent/15'
                    : 'border-edge bg-panel-2 hover:border-edge-2'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className={`${inputCls} text-sm`}
              type="url"
              placeholder="…ou une URL d'image / GIF animé"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
            <button
              type="button"
              onClick={() => avatarUrl.trim() && setAvatar(avatarUrl.trim())}
              className={`${btnGhost} shrink-0 px-3 py-1.5 text-xs`}
            >
              Utiliser
            </button>
          </div>
          {error && <p className="mt-1 text-sm text-rose-400">{error}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-dim">
            Contour de l'avatar
            <span className="ml-2 text-xs text-ink-dim/70">
              {AVATAR_FRAMES[frame]?.label ?? 'Aucun'}
            </span>
          </label>
          {(
            [
              ['Simples', staticFrames],
              ['Animés', animatedFrames],
            ] as const
          ).map(([groupLabel, list]) => (
            <div key={groupLabel} className="mt-2">
              <p className="mb-1.5 text-[11px] tracking-[0.15em] text-ink-dim/70 uppercase">
                {groupLabel}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {list.map(([id, f]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFrame(id)}
                    title={f.label}
                    className={`rounded-md p-1.5 transition ${
                      frame === id
                        ? 'bg-accent/15 outline outline-1 outline-accent'
                        : 'hover:bg-panel-2'
                    }`}
                  >
                    <Avatar user={{ avatar, displayName, profileFrame: id }} size="sm" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-dim">Titre affiché</label>
          <select
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          >
            {Object.entries(PROFILE_TITLES).map(([id, t]) => {
              const locked = t.requires !== null && !earnedIds.has(t.requires)
              return (
                <option key={id} value={id} disabled={locked}>
                  {t.label}
                  {locked ? ' 🔒 (succès à débloquer)' : ''}
                </option>
              )
            })}
          </select>
          <p className="mt-1 text-xs text-ink-dim/70">
            Les titres verrouillés s'obtiennent en décrochant le succès correspondant
            sur ton profil.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-dim">
            Couleur du profil
            <span className="ml-2 text-xs text-ink-dim/70">
              {PROFILE_ACCENTS[accent]?.label ?? ''}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PROFILE_ACCENTS).map(([id, a]) => (
              <button
                key={id}
                type="button"
                title={a.label}
                onClick={() => setAccent(id)}
                className={`h-8 w-8 rounded-full border-2 transition ${
                  accent === id ? 'border-ink' : 'border-edge hover:border-edge-2'
                }`}
                style={{ background: a.color || 'var(--color-accent)' }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-dim">Jeu vitrine</label>
          <select
            className={inputCls}
            value={favoriteGameId}
            onChange={(e) => setFavoriteGameId(e.target.value)}
          >
            <option value="">Aucun</option>
            {showcaseGames.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-dim/70">
            Épinglé en haut de ton profil — ton coup de cœur du moment.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-dim">Fond de profil</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PROFILE_BACKGROUNDS).map(([id, b]) => (
              <button
                key={id}
                type="button"
                title={b.label}
                onClick={() => {
                  setBackground(id)
                  setBackgroundUrl('')
                }}
                className={`h-10 w-14 rounded-md border transition ${
                  background === id && !backgroundUrl
                    ? 'border-accent'
                    : 'border-edge hover:border-edge-2'
                }`}
                style={{ background: b.css || 'var(--color-panel-2)' }}
              />
            ))}
          </div>
          <input
            className={`${inputCls} mt-2 text-sm`}
            type="url"
            placeholder="…ou une image personnalisée (URL)"
            value={backgroundUrl}
            onChange={(e) => setBackgroundUrl(e.target.value)}
          />
          {(backgroundUrl.trim() || background !== 'none') && (
            <div
              className="mt-2 h-16 rounded-md border border-edge"
              style={{ background: resolveProfileBackground(backgroundUrl.trim() || background) }}
            />
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-dim">Bio courte</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={140}
            placeholder="140 caractères max"
          />
        </div>
        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
          Enregistrer
        </button>
      </form>
    </Modal>
  )
}
