// Fixture generation (Stage A: fair match pool), court scheduling (Stage B:
// round-based court assignment), and pickleball score entry.
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { converter } from './firestore'
import { listRegistrationsForTournament } from './registrations'
import { getTournament } from './tournaments'
import type { Match, TournamentType } from '../types'

const matchesRef = collection(db, 'matches').withConverter(converter<Match>())

interface Candidate {
  teamA: string[]
  teamB: string[]
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join('|')
}

/** Fisher–Yates, returns a new array — doesn't mutate the input. */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Stage A: build a fair set of matches — balanced match counts, minimized repeat
 * opponents/partners — via randomized weighted-candidate sampling. */
export function buildMatchPool(playerIds: string[], type: TournamentType): Candidate[] {
  const result: Candidate[] = []
  const playedMatches = new Set<string>()

  if (type === 'singles') {
    // Round-robin: every player plays every other player once
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const matchKey = pairKey(playerIds[i], playerIds[j])
        if (!playedMatches.has(matchKey)) {
          result.push({ teamA: [playerIds[i]], teamB: [playerIds[j]] })
          playedMatches.add(matchKey)
        }
      }
    }
  } else {
    // Doubles: each unique pair plays other unique pairs, no player partners twice.
    const pairs: string[][] = []
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        pairs.push([playerIds[i], playerIds[j]])
      }
    }

    const usedPartners = new Map<string, Set<string>>()

    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const teamA = pairs[i]
        const teamB = pairs[j]
        const allPlayers = [...teamA, ...teamB]
        if (new Set(allPlayers).size === 4) {
          const teamAKey = pairKey(teamA[0], teamA[1])
          if (usedPartners.has(teamAKey)) continue

          const teamBKey = pairKey(teamB[0], teamB[1])
          if (usedPartners.has(teamBKey)) continue

          const matchKey = `${teamAKey}|${teamBKey}`
          if (!playedMatches.has(matchKey)) {
            result.push({ teamA, teamB })
            playedMatches.add(matchKey)
            usedPartners.set(teamAKey, new Set([teamA[0], teamA[1]]))
            usedPartners.set(teamBKey, new Set([teamB[0], teamB[1]]))
          }
        }
      }
    }
  }

  return result
}

export interface ScheduledMatch extends Candidate {
  courtId: string
  round: number
  matchNumber: number
}

function candidatePlayers(m: Candidate): string[] {
  return [...m.teamA, ...m.teamB]
}

/** Singles: builds a match pool where every player plays exactly `n` matches,
 * via a circulant construction. Feasible iff 0 <= n <= playerIds.length - 1 and
 * playerIds.length * n is even; returns null otherwise. Deterministic and instant. */
function exactSinglesMatchPool(playerIds: string[], n: number): Candidate[] | null {
  const count = playerIds.length
  if (n < 0 || n > count - 1 || (count * n) % 2 !== 0) return null

  const order = shuffle(playerIds)
  const seen = new Set<string>()
  const result: Candidate[] = []
  const addEdge = (i: number, j: number) => {
    const a = order[i]
    const b = order[j]
    const key = pairKey(a, b)
    if (seen.has(key)) return
    seen.add(key)
    result.push({ teamA: [a], teamB: [b] })
  }

  let remaining = n
  let offset = 1
  while (remaining >= 2) {
    for (let i = 0; i < count; i++) addEdge(i, (i + offset) % count)
    remaining -= 2
    offset++
  }
  if (remaining === 1) {
    // count is guaranteed even here by the feasibility check above.
    for (let i = 0; i < count / 2; i++) addEdge(i, i + count / 2)
  }
  return result
}

/** Doubles: searches for a pool where every player plays exactly `n` matches —
 * regenerate from a freshly shuffled order, greedily keep whichever candidate's
 * players are currently furthest below target, retry on failure. */
function tryExactMatchPool(
  playerIds: string[],
  type: TournamentType,
  n: number,
  attempts: number,
): Candidate[] | null {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const pool = shuffle(buildMatchPool(shuffle(playerIds), type))
    const counts = new Map<string, number>()
    const kept: Candidate[] = []
    const remaining = [...pool]
    let progress = true
    while (progress) {
      progress = false
      remaining.sort((a, b) => {
        const load = (m: Candidate) => Math.max(...candidatePlayers(m).map((p) => counts.get(p) ?? 0))
        return load(a) - load(b)
      })
      for (let i = 0; i < remaining.length; i++) {
        const players = candidatePlayers(remaining[i])
        if (players.every((p) => (counts.get(p) ?? 0) < n)) {
          kept.push(remaining[i])
          players.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1))
          remaining.splice(i, 1)
          progress = true
          break
        }
      }
    }
    if (playerIds.every((p) => (counts.get(p) ?? 0) === n)) return kept
  }
  return null
}

/** Builds a match pool where every player plays exactly `n` matches, or null. */
function exactMatchPool(playerIds: string[], type: TournamentType, n: number): Candidate[] | null {
  if (type === 'singles') return exactSinglesMatchPool(playerIds, n)
  return tryExactMatchPool(playerIds, type, n, 200)
}

/** When the requested exact count isn't achievable, finds nearby counts that are. */
function suggestAchievableExactCounts(playerIds: string[], type: TournamentType, requested: number): number[] {
  const max = playerIds.length - 1
  const suggestions: number[] = []
  for (let delta = 1; delta <= max && suggestions.length < 4; delta++) {
    for (const candidate of [requested - delta, requested + delta]) {
      if (candidate < 1 || candidate > max) continue
      if (type === 'singles' ? exactSinglesMatchPool(playerIds, candidate) : tryExactMatchPool(playerIds, type, candidate, 60)) {
        suggestions.push(candidate)
        if (suggestions.length >= 4) break
      }
    }
  }
  return suggestions.sort((a, b) => a - b)
}

/** Stage B (round-based): groups matches into rounds where no player is double-booked,
 * rotating the starting court each round. Enforces fairness (prefer whoever's played
 * fewest) and a hard rest rule: nobody plays more than 3 rounds in a row without a break. */
export function scheduleCourts(matches: Candidate[], courtIds: string[]): ScheduledMatch[] {
  const scheduled: ScheduledMatch[] = []
  const remaining = [...matches]
  const matchesPlayed = new Map<string, number>()
  const streak = new Map<string, number>() // consecutive rounds played without a rest
  let round = 0
  let matchNumber = 1

  while (remaining.length > 0) {
    const busy = new Set<string>()
    const roundMatches: Candidate[] = []
    const mustRest = new Set(
      [...streak.entries()].filter(([, n]) => n >= 3).map(([playerId]) => playerId),
    )

    const eligible = remaining.filter((m) => !candidatePlayers(m).some((p) => mustRest.has(p)))
    const ordered = eligible.sort((a, b) => {
      const load = (m: Candidate) => Math.min(...candidatePlayers(m).map((p) => matchesPlayed.get(p) ?? 0))
      return load(a) - load(b)
    })

    for (const m of ordered) {
      if (roundMatches.length >= courtIds.length) break
      const players = candidatePlayers(m)
      if (players.some((p) => busy.has(p))) continue
      roundMatches.push(m)
      players.forEach((p) => busy.add(p))
    }

    if (roundMatches.length === 0) {
      if (mustRest.size === 0) break // safety valve, shouldn't happen
      // Every remaining match needs a rest-due player: give everyone on a streak a bye.
      streak.forEach((_, p) => streak.set(p, 0))
      round++
      continue
    }

    roundMatches.forEach((m) => {
      remaining.splice(remaining.indexOf(m), 1)
    })

    roundMatches.forEach((m, idx) => {
      const courtId = courtIds[(round + idx) % courtIds.length]
      scheduled.push({ ...m, courtId, round, matchNumber })
      matchNumber++
    })

    const playedThisRound = new Set(roundMatches.flatMap(candidatePlayers))
    playedThisRound.forEach((p) => {
      matchesPlayed.set(p, (matchesPlayed.get(p) ?? 0) + 1)
      streak.set(p, (streak.get(p) ?? 0) + 1)
    })
    streak.forEach((_, p) => {
      if (!playedThisRound.has(p)) streak.set(p, 0)
    })

    round++
  }

  return scheduled
}

export async function listMatchesForTournament(tournamentId: string): Promise<Match[]> {
  const snapshot = await getDocs(query(matchesRef, where('tournamentId', '==', tournamentId)))
  return snapshot.docs.map((d) => d.data()).sort((a, b) => a.matchNumber - b.matchNumber)
}

/** Live subscription to a tournament's matches, sorted by match number.
 * This is what makes scoring show up instantly on every open device. */
export function subscribeToMatches(tournamentId: string, cb: (matches: Match[]) => void) {
  return onSnapshot(query(matchesRef, where('tournamentId', '==', tournamentId)), (snap) => {
    cb(snap.docs.map((d) => d.data()).sort((a, b) => a.matchNumber - b.matchNumber))
  })
}

export async function generateFixtures(
  tournamentId: string,
  exactMatchesPerPlayer?: number,
): Promise<{ matchCount: number; roundCount: number }> {
  const tournament = await getTournament(tournamentId)
  if (!tournament) throw new Error('Tournament not found.')
  if (tournament.courtIds.length === 0) {
    throw new Error('This tournament has no courts assigned — pick courts when editing it.')
  }
  if (exactMatchesPerPlayer !== undefined && (!Number.isInteger(exactMatchesPerPlayer) || exactMatchesPerPlayer < 1)) {
    throw new Error('Matches per player must be a whole number of at least 1.')
  }

  const registrations = await listRegistrationsForTournament(tournamentId)
  const confirmedPlayerIds = registrations.filter((r) => r.status === 'confirmed').map((r) => r.userId)
  const minPlayers = tournament.type === 'doubles' ? 4 : 2
  if (confirmedPlayerIds.length < minPlayers) {
    throw new Error(`Need at least ${minPlayers} confirmed players to generate fixtures.`)
  }

  const existingMatches = await listMatchesForTournament(tournamentId)
  if (existingMatches.some((m) => m.status === 'completed' || m.status === 'locked')) {
    throw new Error('Some matches already have recorded results, so fixtures can’t be regenerated.')
  }

  let pool: Candidate[]
  if (exactMatchesPerPlayer) {
    const exact = exactMatchPool(confirmedPlayerIds, tournament.type, exactMatchesPerPlayer)
    if (!exact) {
      const suggestions = suggestAchievableExactCounts(confirmedPlayerIds, tournament.type, exactMatchesPerPlayer)
      const suggestionText = suggestions.length > 0 ? ` Try: ${suggestions.join(', ')}.` : ''
      throw new Error(
        `Can't give every one of the ${confirmedPlayerIds.length} confirmed players exactly ${exactMatchesPerPlayer} matches.${suggestionText}`,
      )
    }
    pool = exact
  } else {
    pool = shuffle(buildMatchPool(confirmedPlayerIds, tournament.type))
  }
  const scheduled = scheduleCourts(pool, tournament.courtIds)

  const batch = writeBatch(db)
  existingMatches.forEach((m) => batch.delete(doc(db, 'matches', m.id)))
  scheduled.forEach((m) => {
    const ref = doc(matchesRef)
    batch.set(ref, {
      id: ref.id,
      tournamentId,
      teamA: m.teamA,
      teamB: m.teamB,
      courtId: m.courtId,
      status: 'scheduled',
      scoreA: null,
      scoreB: null,
      winner: null,
      queuePriority: m.matchNumber,
      round: m.round,
      matchNumber: m.matchNumber,
    } as unknown as Match)
  })
  await batch.commit()

  const roundCount = scheduled.length > 0 ? Math.max(...scheduled.map((m) => m.round)) + 1 : 0
  return { matchCount: scheduled.length, roundCount }
}

/** Validates a pickleball game score and returns the winning side.
 * Standard pickleball: race to `pointsTarget`, must win by `winBy` (2 by default).
 * Throws a friendly error otherwise. Kept pure so both the player and admin
 * score flows share exactly one source of truth for what a legal score is. */
export function validatePickleballScore(
  scoreA: number,
  scoreB: number,
  pointsTarget = 11,
  winBy = 2,
): 'A' | 'B' {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    throw new Error('Scores must be non-negative whole numbers.')
  }
  if (scoreA > 99 || scoreB > 99) {
    throw new Error('That score looks too high — please double-check it.')
  }
  if (scoreA === scoreB) {
    throw new Error('Scores cannot be tied — there must be a winner.')
  }
  const winnerScore = Math.max(scoreA, scoreB)
  const loserScore = Math.min(scoreA, scoreB)
  if (winnerScore < pointsTarget) {
    throw new Error(`The winning score must reach at least ${pointsTarget}.`)
  }
  if (winnerScore - loserScore < winBy) {
    throw new Error(`The winner must lead by at least ${winBy} point${winBy === 1 ? '' : 's'}.`)
  }
  return scoreA > scoreB ? 'A' : 'B'
}

/** Records or corrects a match's score (admin path, and shared internals).
 * Works whether scoring for the first time or overwriting a completed match. */
export async function recordMatchScore(
  matchId: string,
  scoreA: number,
  scoreB: number,
  pointsTarget = 11,
  winBy = 2,
) {
  const winner = validatePickleballScore(scoreA, scoreB, pointsTarget, winBy)
  await updateDoc(doc(db, 'matches', matchId), {
    status: 'completed',
    scoreA,
    scoreB,
    winner,
    completedAt: serverTimestamp(),
  })
}

/** Lets one of the players in a match submit its score, once. Firestore rules
 * are the real enforcement; these are friendlier pre-flight errors for the UI. */
export async function submitOwnMatchScore(
  match: Match,
  scoreA: number,
  scoreB: number,
  userId: string,
  pointsTarget = 11,
  winBy = 2,
) {
  if (!match.teamA.includes(userId) && !match.teamB.includes(userId)) {
    throw new Error("You're not one of the players in this match.")
  }
  if (match.status === 'completed' || match.status === 'locked') {
    throw new Error('This score was already submitted — ask an admin to correct it.')
  }
  await recordMatchScore(match.id, scoreA, scoreB, pointsTarget, winBy)
}

/** Deletes all fixtures (matches) for a tournament. */
export async function deleteFixtures(tournamentId: string): Promise<void> {
  const matches = await listMatchesForTournament(tournamentId)
  if (matches.length === 0) return

  const batch = writeBatch(db)
  matches.forEach((m) => batch.delete(doc(db, 'matches', m.id)))
  await batch.commit()
}
