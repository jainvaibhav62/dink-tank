// Live-event standings and Dink Ratings, computed from EventMatch results.
// Pure and Firestore-free. Ratings reuse the same Elo model as the main app's
// rating service, ordered by round → court since event matches carry no timestamp.
import type { EventMatch, EventParticipant } from '../types'
import { RATING_BASE, RATING_MIN, RATING_MAX } from './rating'

export interface EventRow {
  id: string
  name: string
  wins: number
  losses: number
  gamesPlayed: number
  pointsFor: number
  pointsAgainst: number
  pointDiff: number
  winPct: number
  rating: number
  lastDelta: number
}

const K = 0.12
const SENSITIVITY = 1.5
const clamp = (r: number) => Math.max(RATING_MIN, Math.min(RATING_MAX, r))
const expected = (mine: number, opp: number) => 1 / (1 + Math.pow(10, (opp - mine) / SENSITIVITY))
const avg = (n: number[]) => n.reduce((a, b) => a + b, 0) / n.length

function completedInOrder(matches: EventMatch[]): EventMatch[] {
  return matches
    .filter((m) => m.status === 'completed' && m.winner && m.scoreA !== null && m.scoreB !== null)
    .sort((a, b) => a.round - b.round || a.courtIndex - b.courtIndex)
}

export function computeEventLeaderboard(
  participants: EventParticipant[],
  matches: EventMatch[],
): EventRow[] {
  const byId = new Map(participants.map((p) => [p.id, p]))
  const rows = new Map<string, EventRow>()
  const ensure = (id: string): EventRow =>
    rows.get(id) ??
    rows
      .set(id, {
        id,
        name: byId.get(id)?.name ?? 'Unknown',
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
        winPct: 0,
        rating: RATING_BASE,
        lastDelta: 0,
      })
      .get(id)!
  participants.forEach((p) => ensure(p.id))

  for (const m of completedInOrder(matches)) {
    const aRows = m.teamA.map(ensure)
    const bRows = m.teamB.map(ensure)
    const aWon = m.winner === 'A'

    // Record stats.
    const sides: Array<[EventRow[], number, number, boolean]> = [
      [aRows, m.scoreA!, m.scoreB!, aWon],
      [bRows, m.scoreB!, m.scoreA!, !aWon],
    ]
    for (const [side, ownScore, oppScore, won] of sides) {
      for (const row of side) {
        row.gamesPlayed++
        row.pointsFor += ownScore
        row.pointsAgainst += oppScore
        row.pointDiff = row.pointsFor - row.pointsAgainst
        if (won) row.wins++
        else row.losses++
        row.winPct = row.gamesPlayed > 0 ? row.wins / row.gamesPlayed : 0
      }
    }

    // Update Elo ratings.
    const aTeam = avg(aRows.map((r) => r.rating))
    const bTeam = avg(bRows.map((r) => r.rating))
    const margin = Math.abs(m.scoreA! - m.scoreB!)
    const marginMult = 1 + Math.min(margin, 11) / 22
    const deltaA = K * marginMult * ((aWon ? 1 : 0) - expected(aTeam, bTeam))
    aRows.forEach((r) => {
      r.rating = clamp(r.rating + deltaA)
      r.lastDelta = deltaA
    })
    bRows.forEach((r) => {
      r.rating = clamp(r.rating - deltaA)
      r.lastDelta = -deltaA
    })
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.wins - a.wins ||
      b.pointDiff - a.pointDiff ||
      b.pointsFor - a.pointsFor ||
      b.winPct - a.winPct ||
      a.name.localeCompare(b.name),
  )
}
