import { useEffect, useMemo, useState } from 'react'
import { TournamentStandings } from '../components/TournamentStandings'
import { Podium } from '../components/Podium'
import { StatTile } from '../components/StatTile'
import { fetchPublicProfiles } from '../services/auth'
import { computeAllTimeLeaderboard, subscribeToAllCompletedMatches } from '../services/leaderboard'
import { computeRatings } from '../services/rating'
import { subscribeToTournaments } from '../services/tournaments'
import type { Match, PublicProfile, Tournament } from '../types'

export function LeaderboardPage() {
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({})
  const [matches, setMatches] = useState<Match[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => subscribeToAllCompletedMatches(setMatches), [])
  useEffect(() => subscribeToTournaments(setTournaments), [])

  const publishedMatches = useMemo(() => {
    const publishedIds = new Set(tournaments.filter((t) => t.status === 'completed').map((t) => t.id))
    return matches.filter((m) => publishedIds.has(m.tournamentId))
  }, [matches, tournaments])

  const rows = useMemo(() => computeAllTimeLeaderboard(publishedMatches), [publishedMatches])
  const ratings = useMemo(() => computeRatings(publishedMatches), [publishedMatches])

  useEffect(() => {
    fetchPublicProfiles(rows.map((r) => r.userId)).then((p) => {
      setProfiles(p)
      setReady(true)
    })
  }, [rows])

  if (!ready && rows.length === 0) {
    return <p className="text-slate-500 dark:text-slate-400">Loading leaderboard…</p>
  }

  const totalMatches = publishedMatches.length
  const totalPlayers = rows.length
  const topRating = rows.length
    ? Math.max(...rows.map((r) => ratings[r.userId]?.rating ?? 3))
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold dt-gradient-text">All-time leaderboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Live Dink Ratings update after every match — beat stronger players to climb faster.
        </p>
      </div>

      {rows.length >= 3 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <Podium
            entries={rows.map((r) => ({ userId: r.userId, wins: r.wins }))}
            profiles={profiles}
            ratings={ratings}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Players ranked" value={totalPlayers} accent="green" />
        <StatTile label="Matches played" value={totalMatches} accent="blue" />
        <StatTile label="Top rating" value={topRating.toFixed(2)} accent="violet" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <TournamentStandings rows={rows} profiles={profiles} ratings={ratings} matches={publishedMatches} />
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Dink Rating scale 2.00–8.00 · everyone starts at 3.00 · Beginner · Intermediate (3.0+) · Advanced (4.0+) · Pro (5.0+)
      </p>
    </div>
  )
}
