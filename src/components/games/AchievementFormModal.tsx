import { useState, type FormEvent } from 'react'
import { backend } from '../../lib/backend'
import type { GameAchievement } from '../../lib/types'
import { useAuthStore } from '../../stores/authStore'
import { Modal, btnPrimary, inputCls } from '../ui'

const ICONS = ['🏆', '🥇', '⭐', '🔥', '💎', '👑', '🎯', '⚡', '💀', '🧠', '🚀', '🎖️']

/** Propose (achievement undefined) or edit (achievement set) a game achievement. */
export function AchievementFormModal({
  gameId,
  achievement,
  onClose,
}: {
  gameId: string
  achievement?: GameAchievement
  onClose: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const [icon, setIcon] = useState(achievement?.icon ?? '🏆')
  const [title, setTitle] = useState(achievement?.title ?? '')
  const [description, setDescription] = useState(achievement?.description ?? '')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const input = { icon, title: title.trim(), description: description.trim() }
    setBusy(true)
    try {
      if (achievement) await backend.updateAchievementContent(gameId, achievement.id, input)
      else await backend.addAchievement(gameId, input, user.uid)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={achievement ? 'Modifier le succès' : 'Proposer un succès'}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {!achievement && (
          <p className="rounded-md border border-amber-500/25 px-3 py-2 text-xs text-amber-400/90">
            Ta proposition part en validation admin — vous en discutez dans le fil,
            tu peux la modifier, puis un admin l'approuve.
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm text-ink-dim">Icône</label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setIcon(ic)}
                className={`flex h-10 w-10 items-center justify-center rounded-md border text-xl transition ${
                  icon === ic
                    ? 'border-accent bg-accent/15'
                    : 'border-edge bg-panel-2 hover:border-edge-2'
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink-dim">Titre *</label>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={60}
            placeholder="Speedrunner"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink-dim">Description *</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={200}
            placeholder="Finir le jeu en moins de 10 minutes."
          />
        </div>
        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
          {achievement ? 'Enregistrer' : 'Proposer'}
        </button>
      </form>
    </Modal>
  )
}
