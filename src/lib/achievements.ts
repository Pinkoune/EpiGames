/**
 * Meta-achievements (Steam-badge style): awarded automatically from data the
 * portal already has — no gameplay hook needed, so they can't be cheated and
 * cost devs nothing. Computed on the fly (like the notifications digest),
 * never stored: a member's badges are always an exact function of their data.
 */

export interface AchievementStat {
  /** How far the member is toward the goal (for the progress bar / locked state). */
  value: number
}

export interface MetaAchievement {
  id: string
  icon: string
  title: string
  description: string
  /** Threshold on `pick(stats)` to earn it. */
  goal: number
  pick: (s: MetaStats) => number
}

export interface MetaStats {
  publishedGames: number
  bugsReported: number
  featuresReported: number
  upvotesReceived: number
  friends: number
  messages: number
  distinctGamesPlayed: number
  totalPlays: number
}

export const META_ACHIEVEMENTS: MetaAchievement[] = [
  { id: 'first-game', icon: '🚀', title: 'Premier jeu', description: 'Publier un jeu sur le portail.', goal: 1, pick: (s) => s.publishedGames },
  { id: 'studio', icon: '🏛️', title: 'Studio', description: 'Publier 3 jeux.', goal: 3, pick: (s) => s.publishedGames },
  { id: 'bug-hunter', icon: '🐛', title: 'Chasseur de bugs', description: 'Signaler 5 bugs.', goal: 5, pick: (s) => s.bugsReported },
  { id: 'visionary', icon: '💡', title: 'Visionnaire', description: 'Proposer 5 features.', goal: 5, pick: (s) => s.featuresReported },
  { id: 'popular', icon: '⭐', title: 'Populaire', description: 'Recevoir 10 upvotes sur tes demandes.', goal: 10, pick: (s) => s.upvotesReceived },
  { id: 'social', icon: '🤝', title: 'Sociable', description: 'Avoir 3 amis.', goal: 3, pick: (s) => s.friends },
  { id: 'chatty', icon: '💬', title: 'Bavard', description: 'Envoyer 20 messages.', goal: 20, pick: (s) => s.messages },
  { id: 'explorer', icon: '🧭', title: 'Explorateur', description: 'Jouer à 5 jeux différents.', goal: 5, pick: (s) => s.distinctGamesPlayed },
  { id: 'regular', icon: '🎯', title: 'Habitué', description: 'Lancer 20 parties.', goal: 20, pick: (s) => s.totalPlays },
]

export interface EarnedAchievement {
  def: MetaAchievement
  value: number
  earned: boolean
}

/** Resolve every meta-achievement to earned/locked + progress for a member. */
export function computeMetaAchievements(stats: MetaStats): EarnedAchievement[] {
  return META_ACHIEVEMENTS.map((def) => {
    const value = def.pick(stats)
    return { def, value, earned: value >= def.goal }
  })
}
