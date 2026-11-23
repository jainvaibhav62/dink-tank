// Round scheduler for live events. Pure (no Firestore) so it's testable and
// deterministic given its inputs.
//
// Guarantee: no player ever rests two rounds in a row — anyone who sat out the
// previous round is forced to play this round. Among the rest, we prefer whoever
// has played the fewest games (fairness), and we pick team pairings that avoid
// repeating recent partners (variety → a meaningful leaderboard). This holds as
// long as the roster is at most twice the court capacity (courts × 4 × 2); past
// that it's mathematically impossible, and the scheduler degrades gracefully by
// resting whoever has played the most.
import type { EventMatch } from '../types'

export interface RoundMatch {
  courtIndex: number
  teamA: string[]
  teamB: string[]
}

export interface NextRound {
  matches: RoundMatch[]
  resting: string[]
}

function shuffle<T>(arr: T[]): T[] {
  const r = [...arr]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

export function pairKey(a: string, b: string) {
  return [a, b].sort().join('|')
}

/** Games played per participant, and who sat out the latest round, from history. */
export function analyzeHistory(
  participantIds: string[],
  matches: EventMatch[],
): { gamesPlayed: Record<string, number>; restedLastRound: Set<string>; partnered: Set<string> } {
  const gamesPlayed: Record<string, number> = {}
  participantIds.forEach((id) => (gamesPlayed[id] = 0))
  const partnered = new Set<string>()

  let maxRound = 0
  const playedInRound = new Map<number, Set<string>>()

  for (const m of matches) {
    maxRound = Math.max(maxRound, m.round)
    const set = playedInRound.get(m.round) ?? new Set<string>()
    for (const id of [...m.teamA, ...m.teamB]) {
      gamesPlayed[id] = (gamesPlayed[id] ?? 0) + 1
      set.add(id)
    }
    if (m.teamA.length === 2) partnered.add(pairKey(m.teamA[0], m.teamA[1]))
    if (m.teamB.length === 2) partnered.add(pairKey(m.teamB[0], m.teamB[1]))
    playedInRound.set(m.round, set)
  }

  const restedLastRound = new Set<string>()
  if (maxRound > 0) {
    const played = playedInRound.get(maxRound) ?? new Set<string>()
    for (const id of participantIds) if (!played.has(id)) restedLastRound.add(id)
  }
  return { gamesPlayed, restedLastRound, partnered }
}

/** Split 4 players into two teams, preferring the pairing with the fewest
 * previously-seen partnerships (for variety across rounds). */
export function bestPairing(four: string[], partnered: Set<string>): { teamA: string[]; teamB: string[] } {
  const [a, b, c, d] = four
  const options: Array<[string[], string[]]> = [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ]
  let best = options[0]
  let bestCost = Infinity
  for (const [t1, t2] of options) {
    const cost = (partnered.has(pairKey(t1[0], t1[1])) ? 1 : 0) + (partnered.has(pairKey(t2[0], t2[1])) ? 1 : 0)
    if (cost < bestCost) {
      bestCost = cost
      best = [t1, t2]
    }
  }
  return { teamA: best[0], teamB: best[1] }
}

/** Builds the next round of matches for the given roster and history. */
export function buildNextRound(
  participantIds: string[],
  courtCount: number,
  matches: EventMatch[],
): NextRound {
  const { gamesPlayed, restedLastRound, partnered } = analyzeHistory(participantIds, matches)
  const capacity = courtCount * 4
  // How many we can actually seat (a multiple of 4, capped at capacity & roster).
  const playingCount = Math.min(capacity, Math.floor(participantIds.length / 4) * 4)

  const must = participantIds.filter((id) => restedLastRound.has(id))
  let playing: string[]

  if (must.length >= playingCount) {
    // Roster too big to honor the no-wait rule — seat whoever is most overdue
    // (rested last round first, then fewest games), rest the rest.
    playing = shuffle(must)
      .sort((a, b) => (gamesPlayed[a] ?? 0) - (gamesPlayed[b] ?? 0))
      .slice(0, playingCount)
  } else {
    // Everyone who rested must play; fill the rest with the fewest-games players.
    const pool = shuffle(participantIds.filter((id) => !restedLastRound.has(id))).sort(
      (a, b) => (gamesPlayed[a] ?? 0) - (gamesPlayed[b] ?? 0),
    )
    playing = [...must, ...pool.slice(0, playingCount - must.length)]
  }

  const resting = participantIds.filter((id) => !playing.includes(id))

  // Shuffle the seated players, then chunk into courts of 4 and pick teams.
  const seated = shuffle(playing)
  const roundMatches: RoundMatch[] = []
  for (let i = 0; i + 4 <= seated.length; i += 4) {
    const four = seated.slice(i, i + 4)
    const { teamA, teamB } = bestPairing(four, partnered)
    roundMatches.push({ courtIndex: roundMatches.length, teamA, teamB })
  }

  return { matches: roundMatches, resting }
}
