import { useRef, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../stores/authStore'
import {
  AVATAR_FRAMES,
  PROFILE_BACKGROUNDS,
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

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
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Mon profil" onClose={onClose}>
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
          <label className="mb-1 block text-sm text-ink-dim">Contour de l'avatar</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(AVATAR_FRAMES).map(([id, f]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFrame(id)}
                title={f.label}
                className={`rounded-md p-1 transition ${
                  frame === id ? 'bg-accent/15 outline outline-1 outline-accent' : 'hover:bg-panel-2'
                }`}
              >
                <Avatar user={{ avatar, displayName, profileFrame: id }} size="sm" />
              </button>
            ))}
          </div>
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
