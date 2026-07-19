/** Deterministic gradient per game when no cover URL is set. */
export function coverFallback(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360
  return `linear-gradient(160deg, hsl(${h} 30% 16%), hsl(${(h + 40) % 360} 45% 30%))`
}
