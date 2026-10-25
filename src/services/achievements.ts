// Gamification: achievement badges computed purely from a player's match
// history (+ tournaments they won). No schema, no writes — just derived state,
// so they light up the instant a qualifying result is recorded.
import type { Match, Tournament } from '../types'

export interface Achievement {
  id: string
  label: string
  emoji: string
  description: string
  earned: boolean
}

function playerMatches(userId: string, matches: Match[]) {
  return matches
    .filter(
      (m) =>
        m.status === 'completed' &&
        m.winner !== null &&
        (m.teamA.includes(userId) || m.teamB.includes(userId)),
    )
    .sort(
      (a, b) =>
        (a.completedAt?.toMillis() ?? 0) - (b.completedAt?.toMillis() ?? 0) || a.matchNumber - b.matchNumber,
    )
}

function wonMatch(userId: string, m: Match) {
  return m.teamA.includes(userId) ? m.winner === 'A' : m.winner === 'B'
}

export function computeAchievements(
  userId: string,
  matches: Match[],
  tournaments: Tournament[],
): Achievement[] {
  const mine = playerMatches(userId, matches)
  const wins = mine.filter((m) => wonMatch(userId, m))

  // Longest win streak.
  let longest = 0
  let run = 0
  for (const m of mine) {
    if (wonMatch(userId, m)) run++
    else run = 0
    longest = Math.max(longest, run)
  }

  const pointsFor = mine.reduce(
    (sum, m) => sum + (m.teamA.includes(userId) ? (m.scoreA ?? 0) : (m.scoreB ?? 0)),
    0,
  )

  // Won a game where the opponent scored zero.
  const shutout = wins.some((m) => (m.teamA.includes(userId) ? m.scoreB : m.scoreA) === 0)

  const winPct = mine.length > 0 ? wins.length / mine.length : 0
  const titles = tournaments.filter((t) => t.champion === userId).length

  const defs: Array<Omit<Achievement, 'earned'> & { earned: boolean }> = [
    { id: 'first_win', emoji: '🎉', label: 'First Blood', description: 'Win your first match', earned: wins.length >= 1 },
    { id: 'hat_trick', emoji: '🎩', label: 'Hat Trick', description: 'Win 3 matches in a row', earned: longest >= 3 },
    { id: 'on_fire', emoji: '🔥', label: 'On Fire', description: 'Win 5 matches in a row', earned: longest >= 5 },
    { id: 'shutout', emoji: '🧱', label: 'Kitchen Lockdown', description: 'Win a game to zero', earned: shutout },
    { id: 'century', emoji: '💯', label: 'Century Club', description: 'Score 100 total points', earned: pointsFor >= 100 },
    { id: 'iron', emoji: '🛡️', label: 'Iron Paddle', description: 'Play 10 matches', earned: mine.length >= 10 },
    { id: 'sharpshooter', emoji: '🎯', label: 'Sharpshooter', description: '70%+ win rate (min 5 matches)', earned: mine.length >= 5 && winPct >= 0.7 },
    { id: 'veteran', emoji: '⭐', label: 'Veteran', description: 'Play 25 matches', earned: mine.length >= 25 },
    { id: 'champion', emoji: '🏆', label: 'Champion', description: 'Win a tournament', earned: titles >= 1 },
  ]

  return defs
}

export function earnedCount(achievements: Achievement[]) {
  return achievements.filter((a) => a.earned).length
}
