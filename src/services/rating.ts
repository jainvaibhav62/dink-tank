// "Dink Rating" — a dynamic, DUPR-style skill rating (scale 2.00–8.00) computed
// live from match results. Like DUPR/Elo: beating a stronger opponent moves you
// more than beating a weaker one, and winning margins nudge it too. Pure and
// Firestore-free so it's trivially testable and recomputes instantly client-side.
import type { Match } from '../types'

export const RATING_BASE = 3.0
export const RATING_MIN = 2.0
export const RATING_MAX = 8.0
const K = 0.12 // max rating swing per match (before margin bonus)
const SENSITIVITY = 1.5 // how steeply the expected-result curve reacts to a rating gap

export interface PlayerRating {
  userId: string
  rating: number
  startRating: number
  peak: number
  matches: number
  /** Rating change from this player's most recent match — drives the ↑/↓ movement arrow. */
  lastDelta: number
  /** Rating after each of the player's matches, oldest → newest (for the sparkline). */
  history: number[]
}

function clamp(r: number) {
  return Math.max(RATING_MIN, Math.min(RATING_MAX, r))
}

function expectedScore(mine: number, opponent: number) {
  return 1 / (1 + Math.pow(10, (opponent - mine) / SENSITIVITY))
}

function avg(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** Completed matches in the order they were actually played. */
function chronological(matches: Match[]) {
  return matches
    .filter((m) => m.status === 'completed' && m.winner !== null && m.scoreA !== null && m.scoreB !== null)
    .sort(
      (a, b) =>
        (a.completedAt?.toMillis() ?? 0) - (b.completedAt?.toMillis() ?? 0) || a.matchNumber - b.matchNumber,
    )
}

export function computeRatings(matches: Match[]): Record<string, PlayerRating> {
  const ratings: Record<string, PlayerRating> = {}
  const ensure = (id: string): PlayerRating =>
    (ratings[id] ??= {
      userId: id,
      rating: RATING_BASE,
      startRating: RATING_BASE,
      peak: RATING_BASE,
      matches: 0,
      lastDelta: 0,
      history: [],
    })

  for (const m of chronological(matches)) {
    const aPlayers = m.teamA
    const bPlayers = m.teamB
    aPlayers.forEach(ensure)
    bPlayers.forEach(ensure)

    const aTeam = avg(aPlayers.map((p) => ratings[p].rating))
    const bTeam = avg(bPlayers.map((p) => ratings[p].rating))
    const aWon = m.winner === 'A'

    // Margin bonus: a blowout shifts a touch more than a nailbiter (capped).
    const margin = Math.abs((m.scoreA ?? 0) - (m.scoreB ?? 0))
    const marginMult = 1 + Math.min(margin, 11) / 22 // 1.0 → 1.5

    const deltaA = K * marginMult * ((aWon ? 1 : 0) - expectedScore(aTeam, bTeam))
    const apply = (players: string[], delta: number) => {
      for (const id of players) {
        const r = ratings[id]
        r.rating = clamp(r.rating + delta)
        r.peak = Math.max(r.peak, r.rating)
        r.lastDelta = delta
        r.matches++
        r.history.push(r.rating)
      }
    }
    apply(aPlayers, deltaA)
    apply(bPlayers, -deltaA)
  }

  return ratings
}

export function getRating(userId: string, ratings: Record<string, PlayerRating>): PlayerRating {
  return (
    ratings[userId] ?? {
      userId,
      rating: RATING_BASE,
      startRating: RATING_BASE,
      peak: RATING_BASE,
      matches: 0,
      lastDelta: 0,
      history: [],
    }
  )
}

export interface RatingTier {
  label: string
  /** Tailwind text/bg classes for the tier chip. */
  chip: string
}

/** Human tier + chip styling for a numeric rating. Reserved status-style colors. */
export function tierForRating(rating: number): RatingTier {
  if (rating >= 5.0) return { label: 'Pro', chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' }
  if (rating >= 4.0) return { label: 'Advanced', chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' }
  if (rating >= 3.0) return { label: 'Intermediate', chip: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' }
  return { label: 'Beginner', chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }
}

/** Last `n` results for a player, newest first: true = win. */
export function recentForm(userId: string, matches: Match[], n = 5): boolean[] {
  return chronological(matches)
    .filter((m) => m.teamA.includes(userId) || m.teamB.includes(userId))
    .slice(-n)
    .reverse()
    .map((m) => (m.teamA.includes(userId) ? m.winner === 'A' : m.winner === 'B'))
}

/** Current win (or loss) streak for a player, as a signed count: +3 = won last 3. */
export function currentStreak(userId: string, matches: Match[]): number {
  const results = chronological(matches)
    .filter((m) => m.teamA.includes(userId) || m.teamB.includes(userId))
    .map((m) => (m.teamA.includes(userId) ? m.winner === 'A' : m.winner === 'B'))
  let streak = 0
  for (let i = results.length - 1; i >= 0; i--) {
    if (i === results.length - 1) {
      streak = results[i] ? 1 : -1
    } else if (results[i] === results[results.length - 1]) {
      streak += results[i] ? 1 : -1
    } else break
  }
  return streak
}
