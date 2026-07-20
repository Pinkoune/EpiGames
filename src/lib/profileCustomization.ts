/**
 * Steam-style profile personalization presets. Kept as curated, tasteful
 * options (not arbitrary CSS injection) — consistent with the "console
 * sombre épurée" direction: no rainbow-everywhere, opt-in flair only.
 */

export interface AvatarFrame {
  label: string
  /** Extra classes applied to the avatar's inner (bordered) box. */
  ringClass: string
  /** True for the one animated frame (spinning conic-gradient backdrop). */
  animated?: boolean
}

export const AVATAR_FRAMES: Record<string, AvatarFrame> = {
  none: { label: 'Aucun', ringClass: '' },
  accent: { label: 'Accent', ringClass: 'ring-2 ring-accent ring-offset-2 ring-offset-abyss' },
  amber: {
    label: 'Or',
    ringClass:
      'ring-2 ring-amber-400 ring-offset-2 ring-offset-abyss shadow-[0_0_10px_rgba(251,191,36,0.55)]',
  },
  emerald: {
    label: 'Émeraude',
    ringClass:
      'ring-2 ring-emerald-400 ring-offset-2 ring-offset-abyss shadow-[0_0_10px_rgba(52,211,153,0.55)]',
  },
  violet: {
    label: 'Violet',
    ringClass:
      'ring-2 ring-violet-400 ring-offset-2 ring-offset-abyss shadow-[0_0_10px_rgba(167,139,250,0.55)]',
  },
  rose: {
    label: 'Rose',
    ringClass:
      'ring-2 ring-rose-400 ring-offset-2 ring-offset-abyss shadow-[0_0_10px_rgba(251,113,133,0.55)]',
  },
  prisma: { label: 'Prisma (animé)', ringClass: '', animated: true },
}

export interface ProfileBackground {
  label: string
  /** CSS `background` shorthand value for the preset. */
  css: string
}

export const PROFILE_BACKGROUNDS: Record<string, ProfileBackground> = {
  none: { label: 'Aucun', css: '' },
  aurora: {
    label: 'Aurore',
    css: 'linear-gradient(135deg, #142a4a 0%, #1d4e6b 45%, #2f7a63 100%)',
  },
  sunset: {
    label: 'Coucher de soleil',
    css: 'linear-gradient(135deg, #3a1740 0%, #7a2f4d 50%, #c9622f 100%)',
  },
  ember: {
    label: 'Braise',
    css: 'linear-gradient(135deg, #1a0f0f 0%, #5c1f1f 55%, #c9502f 100%)',
  },
  ocean: {
    label: 'Océan',
    css: 'linear-gradient(135deg, #071a2b 0%, #0e3a5c 50%, #14708f 100%)',
  },
  matrix: {
    label: 'Matrix',
    css: 'linear-gradient(160deg, #05130a 0%, #0c2b17 55%, #16512a 100%)',
  },
  royal: {
    label: 'Royal',
    css: 'linear-gradient(135deg, #170b3a 0%, #3a1d6e 50%, #6b2fa0 100%)',
  },
}

/** A profile background is a custom URL, not a preset id. */
export function isCustomBackground(value: string): boolean {
  return value.startsWith('http') || value.startsWith('data:image/')
}

/** Resolve a stored `profileBackground` value to a CSS `background` value, or '' for none. */
export function resolveProfileBackground(value: string): string {
  if (!value || value === 'none') return ''
  if (isCustomBackground(value)) return `center / cover no-repeat url(${value})`
  return PROFILE_BACKGROUNDS[value]?.css ?? ''
}
