import { create } from 'zustand'

/**
 * Transient "console" notifications (PS5-style bubbles): they announce an
 * event as it happens, then vanish. Deliberately NOT persisted — the bell
 * stays the durable digest, this is just the in-the-moment nudge.
 */
export interface Toast {
  id: string
  /** Render the member's avatar when set, otherwise `icon`. */
  avatarUid?: string
  icon?: string
  title: string
  body?: string
  /** Route opened when the bubble is clicked. */
  to?: string
}

/** How long a bubble stays on screen. */
const TOAST_MS = 6000
/** Never stack more than this — older ones drop off the top. */
const MAX_VISIBLE = 3

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }].slice(-MAX_VISIBLE) }))
    setTimeout(() => get().dismiss(id), TOAST_MS)
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
