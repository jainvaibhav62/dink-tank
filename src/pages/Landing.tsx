import { useEffect, useMemo, useState } from 'react'
import { TournamentStandings } from '../components/TournamentStandings'
import { AnnouncementBanner } from '../components/AnnouncementBanner'
import { Podium } from '../components/Podium'
import { StatTile } from '../components/StatTile'
import { fetchPublicProfiles } from '../services/auth'
import { computeAllTimeLeaderboard, subscribeToAllCompletedMatches } from '../services/leaderboard'
import { computeRatings } from '../services/rating'
import { subscribeToTournaments } from '../services/tournaments'
import { subscribeToActiveAnnouncements } from '../services/announcements'
import type { Announcement, Match, PublicProfile, Tournament } from '../types'

export function LandingPage() {
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({})
  const [matches, setMatches] = useState<Match[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [championNames, setChampionNames] = useState<Record<string, string>>({})
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => subscribeToAllCompletedMatches(setMatches), [])
  useEffect(() => subscribeToActiveAnnouncements(setAnnouncements), [])
  useEffect(() => {
    const unsub = subscribeToTournaments(async (list) => {
      setTournaments(list)
      const championIds = list.filter((t) => t.champion).map((t) => t.champion!)
      if (championIds.length > 0) {
        const championProfiles = await fetchPublicProfiles(championIds)
        const names: Record<string, string> = {}
        championIds.forEach((id) => {
          names[id] = championProfiles[id]?.displayName ?? 'Unknown'
        })
        setChampionNames(names)
      }
    })
    return unsub
  }, [])

  const leaderboardRows = useMemo(() => computeAllTimeLeaderboard(matches), [matches])
  const ratings = useMemo(() => computeRatings(matches), [matches])

  useEffect(() => {
    fetchPublicProfiles(leaderboardRows.map((r) => r.userId)).then(setProfiles)
  }, [leaderboardRows])

  const now = Date.now()
  const upcomingTournaments = tournaments
    .filter((t) => (t.date?.toDate().getTime() ?? 0) > now && t.status !== 'completed')
    .sort((a, b) => (a.date?.toMillis() ?? 0) - (b.date?.toMillis() ?? 0))
    .slice(0, 5)

  const pastTournaments = tournaments
    .filter((t) => t.status === 'completed')
    .sort((a, b) => (b.date?.toMillis() ?? 0) - (a.date?.toMillis() ?? 0))
    .slice(0, 5)

  return (
    <div className="space-y-12">
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map((ann) => (
            <AnnouncementBanner key={ann.id} announcement={ann} />
          ))}
        </div>
      )}

      {/* Hero */}
      <div className="dt-hero-gradient relative overflow-hidden rounded-3xl p-10 text-white shadow-xl sm:p-16">
        <div className="absolute -right-10 -top-10 text-[160px] opacity-20 dt-float">🥒</div>
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
          <div className="relative z-10 animate-dt-rise">
            <h1 className="mb-2 text-4xl font-black tracking-tight sm:text-6xl">🥒 Dink Tank</h1>
            <p className="mb-3 text-lg font-medium sm:text-2xl">Where dinks are deadly and rivalries rally on ⚡</p>
            <p className="max-w-md text-sm opacity-90">
              Join the club to register for pickleball tournaments, earn your live Dink Rating, unlock
              achievements, and climb the ladder — all in real time.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
              <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">📈 Live Dink Rating</span>
              <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">🏅 Achievements</span>
              <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">⚡ Real-time scoring</span>
            </div>
          </div>
          <div className="relative z-10 hidden md:flex md:justify-center">
            <svg viewBox="0 0 300 300" className="h-64 w-full dt-float">
              <rect x="120" y="150" width="18" height="110" rx="8" fill="white" opacity="0.92" />
              <ellipse cx="129" cy="110" rx="70" ry="80" fill="white" opacity="0.95" />
              <circle cx="220" cy="190" r="34" fill="#d9f99d" />
              <g fill="#15803d">
                <circle cx="220" cy="172" r="4" />
                <circle cx="206" cy="184" r="4" />
                <circle cx="234" cy="184" r="4" />
                <circle cx="210" cy="200" r="4" />
                <circle cx="230" cy="200" r="4" />
                <circle cx="220" cy="210" r="4" />
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Podium + stats */}
      {leaderboardRows.length >= 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold dt-gradient-text">Club leaders</h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <Podium
              entries={leaderboardRows.map((r) => ({ userId: r.userId, wins: r.wins }))}
              profiles={profiles}
              ratings={ratings}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Players" value={leaderboardRows.length} accent="green" />
            <StatTile label="Matches" value={matches.length} accent="blue" />
            <StatTile
              label="Top rating"
              value={Math.max(...leaderboardRows.map((r) => ratings[r.userId]?.rating ?? 3)).toFixed(2)}
              accent="violet"
            />
          </div>
        </div>
      )}

      {/* All-time leaderboard preview */}
      {leaderboardRows.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">All-time leaderboard</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Top performers across all completed matches</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <TournamentStandings
              rows={leaderboardRows.slice(0, 10)}
              profiles={profiles}
              ratings={ratings}
              matches={matches}
            />
          </div>
        </div>
      )}

      {/* Upcoming tournaments */}
      {upcomingTournaments.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Upcoming tournaments</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to register and compete</p>
          </div>
          <ul className="space-y-2">
            {upcomingTournaments.map((t) => (
              <li
                key={t.id}
                className="dt-lift flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{t.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t.date?.toDate().toLocaleDateString() ?? ''} · {t.type} · {t.maxPlayers} max
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Past tournaments */}
      {pastTournaments.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Past tournaments</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Champions and past results</p>
          </div>
          <ul className="space-y-2">
            {pastTournaments.map((t) => (
              <li
                key={t.id}
                className="dt-lift flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{t.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t.date?.toDate().toLocaleDateString() ?? ''} · {t.type}
                  </p>
                  {t.champion && (
                    <p className="mt-1 text-sm font-medium text-green-600 dark:text-green-400">
                      🏆 Champion: {championNames[t.champion] || 'Unknown'}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Call to action */}
      <div className="rounded-3xl border-2 border-green-300 bg-gradient-to-r from-lime-50 to-green-50 p-8 text-center dark:border-green-700/50 dark:from-lime-950/30 dark:to-green-950/30">
        <p className="mb-3 text-base font-medium text-slate-700 dark:text-slate-200">
          🎯 Ready to bring your A-game to the kitchen?
        </p>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Sign in to see your stats, register for tournaments, and prove you're the club's top dinker.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          👉 Look for <span className="font-semibold">Sign Up</span> or{' '}
          <span className="font-semibold">Log In</span> at the top right
        </p>
      </div>
    </div>
  )
}
