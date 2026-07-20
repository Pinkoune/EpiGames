/**
 * Portal-ring + play-triangle mark: a hexagonal "portal" outline (the hub)
 * with a play glyph at its center (the games). Pure SVG, no gradients,
 * matches the "console sombre épurée" direction.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M16 3 L27 9.5 L27 22.5 L16 29 L5 22.5 L5 9.5 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M13 11 L13 21 L22 16 Z" fill="var(--color-accent)" />
    </svg>
  )
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconSizes = { sm: 'h-6 w-6', md: 'h-8 w-8', lg: 'h-14 w-14' }
  const textSizes = { sm: 'text-lg', md: 'text-xl', lg: 'text-5xl' }
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className={`${iconSizes[size]} text-ink`} />
      <span className={`font-display font-bold tracking-tight ${textSizes[size]}`}>
        EPI<span className="text-accent">GAMES</span>
      </span>
    </span>
  )
}
