import { useState, type FormEvent } from 'react'
import { backend } from '../../lib/backend'
import type { GameRequest, RequestType } from '../../lib/types'
import { useAuthStore } from '../../stores/authStore'
import { Modal, btnPrimary, inputCls } from '../ui'

/** Create (request undefined) or edit (request set) a bug report / feature ask. */
export function RequestForm({
  gameId,
  request,
  onClose,
}: {
  gameId: string
  request?: GameRequest
  onClose: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const [type, setType] = useState<RequestType>(request?.type ?? 'bug')
  const [title, setTitle] = useState(request?.title ?? '')
  const [description, setDescription] = useState(request?.description ?? '')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    try {
      if (request) {
        await backend.updateRequestContent(gameId, request.id, {
          title: title.trim(),
          description: description.trim(),
        })
      } else {
        await backend.addRequest(
          gameId,
          { type, title: title.trim(), description: description.trim() },
          user.uid,
        )
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={request ? 'Modifier la demande' : 'Nouvelle demande'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!request && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-panel-2 p-1">
            {(
              [
                ['bug', '🐛 Bug'],
                ['feature', '✨ Feature'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`rounded-md py-1.5 text-sm font-semibold transition ${
                  type === value ? 'bg-accent text-white' : 'text-ink-dim hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm text-ink-dim">Titre *</label>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            placeholder={type === 'bug' ? 'Le boss du niveau 3 traverse le mur' : 'Mode co-op local'}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink-dim">Description</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder={'Contexte, étapes pour reproduire, idée d\'implémentation…\nMarkdown supporté.'}
          />
        </div>
        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
          {request ? 'Enregistrer' : 'Envoyer'}
        </button>
      </form>
    </Modal>
  )
}
