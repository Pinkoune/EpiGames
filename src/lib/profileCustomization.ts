/**
 * Steam-style profile personalization presets. Kept as curated, tasteful
 * options (not arbitrary CSS injection) — consistent with the "console
 * sombre épurée" direction: no rainbow-everywhere, opt-in flair only.
 */

/**
 * How a frame animates. Each value maps to a CSS class in index.css
 * (`.af-*`), except 'pulse' which reuses Tailwind's `animate-pulse`.
 *
 * - backdrop-driven (need `spinBg`): 'spin', 'spin-rev', 'hue', 'orbit'
 * - inner-box-driven (need `ringClass`): 'pulse', 'breathe', 'flicker'
 */
export type FrameAnimation =
  | 'spin'
  | 'spin-rev'
  | 'hue'
  | 'orbit'
  | 'pulse'
  | 'breathe'
  | 'flicker'

export interface AvatarFrame {
  label: string
  /** Extra classes applied to the avatar's inner (bordered) box. */
  ringClass: string
  animation?: FrameAnimation
  /**
   * Gradient painted on the rotating backdrop layer behind the avatar
   * ('spin' | 'spin-rev' | 'hue'). The inner box is opaque, so only the
   * few pixels sticking out around it read as a ring.
   */
  spinBg?: string
  /** Animation duration in seconds. Defaults to 3s. */
  speed?: number
  /** Color of the small orbiting dot (animation === 'orbit'). */
  orbitColor?: string
}

export const AVATAR_FRAMES: Record<string, AvatarFrame> = {
  none: { label: 'Aucun', ringClass: '' },

  // ---- static rings ----
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
  cyan: {
    label: 'Cyan',
    ringClass:
      'ring-2 ring-cyan-400 ring-offset-2 ring-offset-abyss shadow-[0_0_10px_rgba(34,211,238,0.55)]',
  },
  steel: {
    label: 'Acier',
    ringClass: 'ring-2 ring-zinc-400/80 ring-offset-2 ring-offset-abyss',
  },

  // ---- animated: rotating gradient ring ----
  prisma: {
    label: 'Prisma',
    ringClass: '',
    animation: 'spin',
    spinBg: 'conic-gradient(from 0deg, #3d9cff, #a78bfa, #34d399, #fbbf24, #3d9cff)',
  },
  aurora: {
    label: 'Aurore',
    ringClass: '',
    animation: 'spin',
    spinBg: 'conic-gradient(from 0deg, #3d9cff, #22d3ee, #34d399, #3d9cff)',
  },
  inferno: {
    label: 'Brasier',
    ringClass: '',
    animation: 'spin',
    spinBg: 'conic-gradient(from 0deg, #fbbf24, #f97316, #ef4444, #fbbf24)',
  },
  goldshine: {
    label: 'Or royal',
    ringClass: '',
    animation: 'spin',
    spinBg: 'conic-gradient(from 0deg, #fde68a, #f59e0b, #fffbeb, #f59e0b, #fde68a)',
  },
  neon: {
    label: 'Néon',
    ringClass: '',
    animation: 'spin',
    spinBg: 'conic-gradient(from 0deg, #a855f7, #ec4899, #22d3ee, #a855f7)',
  },
  ice: {
    label: 'Glace',
    ringClass: '',
    animation: 'spin',
    speed: 5,
    spinBg: 'conic-gradient(from 0deg, #e0f2fe, #38bdf8, #0ea5e9, #e0f2fe)',
  },
  toxic: {
    label: 'Toxique',
    ringClass: '',
    animation: 'spin',
    speed: 2.4,
    spinBg: 'conic-gradient(from 0deg, #a3e635, #22c55e, #065f46, #a3e635)',
  },
  sakura: {
    label: 'Sakura',
    ringClass: '',
    animation: 'spin',
    speed: 4.5,
    spinBg: 'conic-gradient(from 0deg, #fce7f3, #f9a8d4, #ec4899, #fce7f3)',
  },
  monochrome: {
    label: 'Argent',
    ringClass: '',
    animation: 'spin',
    speed: 4,
    spinBg: 'conic-gradient(from 0deg, #ffffff, #94a3b8, #1e293b, #94a3b8, #ffffff)',
  },

  // ---- animated: reverse rotation (synthwave feel) ----
  retrowave: {
    label: 'Retrowave',
    ringClass: '',
    animation: 'spin-rev',
    speed: 3.5,
    spinBg: 'conic-gradient(from 0deg, #f0abfc, #d946ef, #22d3ee, #f0abfc)',
  },

  // ---- animated: segmented "reticle" ring (console/loading look) ----
  reticle: {
    label: 'Réticule',
    ringClass: '',
    animation: 'spin',
    speed: 6,
    spinBg: 'repeating-conic-gradient(#3d9cff 0deg 14deg, transparent 14deg 45deg)',
  },
  reticleGold: {
    label: 'Réticule or',
    ringClass: '',
    animation: 'spin-rev',
    speed: 7,
    spinBg: 'repeating-conic-gradient(#fbbf24 0deg 10deg, transparent 10deg 36deg)',
  },

  // ---- animated: single sweeping comet head ----
  comet: {
    label: 'Comète',
    ringClass: '',
    animation: 'spin',
    speed: 2.2,
    spinBg:
      'conic-gradient(from 0deg, transparent 0deg 260deg, rgba(61,156,255,0.25) 310deg, #3d9cff 348deg, #ffffff 360deg)',
  },
  cometRose: {
    label: 'Comète rose',
    ringClass: '',
    animation: 'spin-rev',
    speed: 2.6,
    spinBg:
      'conic-gradient(from 0deg, transparent 0deg 260deg, rgba(244,114,182,0.25) 310deg, #f472b6 348deg, #ffffff 360deg)',
  },

  // ---- animated: full-spectrum hue cycling ----
  spectrum: {
    label: 'Spectre',
    ringClass: '',
    animation: 'hue',
    speed: 3,
    spinBg: 'conic-gradient(from 0deg, #ff0060, #ff8a00, #ffe600, #00d4ff, #7b2ff7, #ff0060)',
  },

  // ---- animated: orbiting satellite dot ----
  orbitAccent: {
    label: 'Satellite',
    ringClass: 'ring-1 ring-accent/40',
    animation: 'orbit',
    speed: 3.5,
    orbitColor: '#3d9cff',
  },
  orbitGold: {
    label: 'Satellite or',
    ringClass: 'ring-1 ring-amber-400/40',
    animation: 'orbit',
    speed: 5,
    orbitColor: '#fbbf24',
  },
  orbitEmerald: {
    label: 'Satellite vert',
    ringClass: 'ring-1 ring-emerald-400/40',
    animation: 'orbit',
    speed: 2.6,
    orbitColor: '#34d399',
  },

  // ---- animated: glow effects on the box itself ----
  pulseAccent: {
    label: 'Pulsation',
    ringClass: 'ring-2 ring-accent shadow-[0_0_14px_rgba(61,156,255,0.8)]',
    animation: 'pulse',
  },
  pulseEmerald: {
    label: 'Battement',
    ringClass: 'ring-2 ring-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.8)]',
    animation: 'pulse',
  },
  breatheViolet: {
    label: 'Respiration',
    ringClass: 'ring-2 ring-violet-400 shadow-[0_0_16px_rgba(167,139,250,0.85)]',
    animation: 'breathe',
    speed: 3.2,
  },
  breatheAmber: {
    label: 'Braise',
    ringClass: 'ring-2 ring-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.85)]',
    animation: 'breathe',
    speed: 2.2,
  },
  flickerNeon: {
    label: 'Néon fatigué',
    ringClass: 'ring-2 ring-fuchsia-400 shadow-[0_0_16px_rgba(232,121,249,0.9)]',
    animation: 'flicker',
    speed: 4,
  },
  flickerGhost: {
    label: 'Fantôme',
    ringClass: 'ring-2 ring-cyan-300/80 shadow-[0_0_16px_rgba(103,232,249,0.8)]',
    animation: 'flicker',
    speed: 6,
  },
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
  midnight: {
    label: 'Minuit',
    css: 'linear-gradient(135deg, #05060a 0%, #131826 55%, #253150 100%)',
  },
  synthwave: {
    label: 'Synthwave',
    css: 'linear-gradient(160deg, #1b0733 0%, #5b1668 45%, #b93a7a 78%, #f07a4d 100%)',
  },
  toxic: {
    label: 'Toxique',
    css: 'linear-gradient(135deg, #0b1a05 0%, #1f3d0c 50%, #4d7c0f 100%)',
  },
  // Subtle, non-flat presets: a soft glow instead of a plain gradient sweep.
  nebula: {
    label: 'Nébuleuse',
    css: 'radial-gradient(120% 90% at 20% 0%, #3b1d6e 0%, transparent 60%), radial-gradient(100% 80% at 90% 20%, #1d4e6b 0%, transparent 55%), #0c0d11',
  },
  crimson: {
    label: 'Cramoisi',
    css: 'radial-gradient(120% 90% at 80% 0%, #6b1220 0%, transparent 60%), #0c0d11',
  },
}

/**
 * Profile accent color. Applied by overriding the `--color-accent` custom
 * property on the profile page container, so every `text-accent` /
 * `bg-accent` inside it re-themes with zero per-element changes.
 */
export const PROFILE_ACCENTS: Record<string, { label: string; color: string }> = {
  default: { label: 'Bleu (défaut)', color: '' },
  emerald: { label: 'Émeraude', color: '#34d399' },
  amber: { label: 'Or', color: '#fbbf24' },
  violet: { label: 'Violet', color: '#a78bfa' },
  rose: { label: 'Rose', color: '#fb7185' },
  cyan: { label: 'Cyan', color: '#22d3ee' },
  lime: { label: 'Citron', color: '#a3e635' },
  orange: { label: 'Orange', color: '#fb923c' },
}

/** Resolve a stored `profileAccent` to a CSS color, or '' to keep the default. */
export function resolveProfileAccent(value: string): string {
  return PROFILE_ACCENTS[value]?.color ?? ''
}

/**
 * Selectable profile titles, shown under the member's name. Most are EARNED:
 * `requires` names a meta-achievement id (lib/achievements.ts), so titles
 * inherit that system's "computed from real data, uncheatable" property
 * instead of adding storage of their own.
 */
export interface ProfileTitle {
  label: string
  /** Meta-achievement id needed to wear it, or null when free for everyone. */
  requires: string | null
}

export const PROFILE_TITLES: Record<string, ProfileTitle> = {
  none: { label: 'Aucun', requires: null },
  // Free — available from day one so a new member isn't left with nothing.
  rookie: { label: 'Nouvelle recrue', requires: null },
  sunday: { label: 'Joueur du dimanche', requires: null },
  lurker: { label: 'Observateur discret', requires: null },
  // Earned via meta-achievements.
  dev: { label: 'Développeur', requires: 'first-game' },
  studio: { label: 'Studio indé', requires: 'studio' },
  bugHunter: { label: 'Chasseur de bugs', requires: 'bug-hunter' },
  visionary: { label: 'Visionnaire', requires: 'visionary' },
  star: { label: 'Star du portail', requires: 'popular' },
  pillar: { label: 'Pilier du groupe', requires: 'social' },
  loudmouth: { label: 'Grande gueule', requires: 'chatty' },
  explorer: { label: 'Explorateur', requires: 'explorer' },
  veteran: { label: 'Vétéran', requires: 'regular' },
}

/** Label of a stored title id, or '' when unset/unknown. */
export function resolveProfileTitle(value: string): string {
  if (!value || value === 'none') return ''
  return PROFILE_TITLES[value]?.label ?? ''
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
