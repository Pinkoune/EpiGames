import { useState, type FormEvent } from 'react'
import type { Game } from '../../lib/types'
import { useGamesStore } from '../../stores/gamesStore'
import { Modal, btnDanger, btnPrimary, inputCls } from '../ui'

/**
 * Owner tool: announce (or replace / withdraw) the game's update note.
 * One announcement at a time — publishing replaces the previous one and
 * re-notifies everyone (fresh publishedAt).
 */
export function GameUpdateModal({ game, onClose }: { game: Game; onClose: () => void }) {
  const updateGame = useGamesStore((s) => s.updateGame)
  const [version, setVersion] = useState(game.update?.version ?? '')
  const [text, setText] = useState(game.update?.text ?? '')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await updateGame(game.id, {
        update: {
          version: version.trim(),
          text: text.trim(),
          publishedAt: Date.now(),
        },
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  async function withdraw() {
    setBusy(true)
    try {
      await updateGame(game.id, { update: null })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Annoncer une mise à jour" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-ink-dim">
          L'annonce s'affiche en haut de la page du jeu et signale la mise à jour
          à tout le monde (badge « MAJ ») jusqu'à ce que chacun clique « J'ai vu ».
          Publier remplace l'annonce précédente.
        </p>
        <div>
          <label className="mb-1 block text-sm text-ink-dim">Version</label>
          <input
            className={inputCls}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="v1.2.0"
            maxLength={20}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink-dim">Notes de mise à jour *</label>
          <textarea
            className={`${inputCls} resize-y`}
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            maxLength={3000}
            placeholder={'- Nouveau niveau\n- Fix du crash en salle pleine\n\nMarkdown supporté.'}
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={`${btnPrimary} flex-1`}>
            Publier l'annonce
          </button>
          {game.update && (
            <button type="button" onClick={() => void withdraw()} disabled={busy} className={btnDanger}>
              Retirer l'annonce
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
