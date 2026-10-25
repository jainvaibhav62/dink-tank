import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PlayerStatsCard } from '../components/PlayerStatsCard'
import { LandingPage } from './Landing'
import {
  computePlayerStats,
  computeRecentMatches,
  computeTopRivals,
  subscribeToAllCompletedMatches,
} from '../services/leaderboard'
import { computeRatings, currentStreak, getRating, recentForm } from '../services/rating'
import { computeAchievements } from '../services/achievements'
import { subscribeToTournaments } from '../services/tournaments'
import { fetchPublicProfiles } from '../services/auth'
import type { LeaderboardRow, Match, PublicProfile, RecentMatch, Tournament, TopRival } from '../types'

export function HomePage() {
  const { profile, firebaseUser, isAdmin } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [stats, setStats] = useState<LeaderboardRow | null>(null)
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([])
  const [topRivals, setTopRivals] = useState<TopRival[]>([])
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({})

  const isUnverifiedEmailUser =
    firebaseUser && firebaseUser.email && !firebaseUser.emailVerified && !profile

  useEffect(() => subscribeToAllCompletedMatches(setMatches), [])
  useEffect(() => subscribeToTournaments(setTournaments), [])

  const uid = profile?.uid
  const rating = useMemo(() => (uid ? getRating(uid, computeRatings(matches)) : undefined), [uid, matches])
  const achievements = useMemo(
    () => (uid ? computeAchievements(uid, matches, tournaments) : undefined),
    [uid, matches, tournaments],
  )
  const form = useMemo(() => (uid ? recentForm(uid, matches, 5) : []), [uid, matches])
  const streak = useMemo(() => (uid ? currentStreak(uid, matches) : 0), [uid, matches])

  // Stats + resolved names for recent opponents / rivals.
  useEffect(() => {
    if (!uid) return
    const playerStats = computePlayerStats(uid, matches)
    const rivals = computeTopRivals(uid, matches, 3)

    const recentCompleted = matches
      .filter((m) => m.completedAt && (m.teamA.includes(uid) || m.teamB.includes(uid)))
      .sort((a, b) => (b.completedAt?.toMillis() ?? 0) - (a.completedAt?.toMillis() ?? 0))
      .slice(0, 5)
    const opponentIds = new Set<string>()
    recentCompleted.forEach((m) => {
      const opponents = m.teamA.includes(uid) ? m.teamB : m.teamA
      opponents.forEach((id) => opponentIds.add(id))
    })

    const allIds = [...new Set([...opponentIds, ...rivals.map((r) => r.userId)])]
    fetchPublicProfiles(allIds).then((fetched) => {
      setStats(playerStats)
      setRecentMatches(computeRecentMatches(uid, matches, fetched, 5))
      setTopRivals(rivals)
      setProfiles(fetched)
    })
  }, [uid, matches])

  if (isUnverifiedEmailUser) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-orange-200 bg-orange-50 p-6 dark:border-orange-900 dark:bg-orange-950/30">
        <div className="mb-4 text-center">
          <div className="mb-3 text-4xl">📧</div>
          <h1 className="mb-2 text-xl font-bold text-orange-900 dark:text-orange-100">
            Verify your email to continue
          </h1>
          <p className="text-sm text-orange-800 dark:text-orange-200">
            We sent a verification code to <strong>{firebaseUser.email}</strong>
          </p>
        </div>
        <div className="space-y-3 rounded-md bg-white p-3 dark:bg-slate-800">
          <p className="text-sm text-slate-700 dark:text-slate-200">1️⃣ Check your inbox (and spam folder)</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">2️⃣ Enter the code on the verification page</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">3️⃣ Sign back in to access your account</p>
        </div>
      </div>
    )
  }

  if (!profile) return <LandingPage />

  return (
    <div className="space-y-6">
      <div className="animate-dt-rise">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome, {profile.displayName}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {isAdmin ? 'Manage locations, tournaments, and registrations.' : 'Find and join upcoming tournaments.'}
        </p>
      </div>

      {stats && (
        <div className="animate-dt-rise">
          <PlayerStatsCard
            stats={stats}
            rating={rating}
            form={form}
            streak={streak}
            achievements={achievements}
            recentMatches={recentMatches}
            topRivals={topRivals}
            profiles={profiles}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/tournaments"
          className="dt-lift rounded-2xl border border-slate-200 bg-white p-5 hover:border-green-400 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">🎾 Tournaments</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Browse open tournaments and register.</p>
        </Link>

        {isAdmin && (
          <>
            <Link
              to="/admin/locations"
              className="dt-lift rounded-2xl border border-slate-200 bg-white p-5 hover:border-green-400 dark:border-slate-800 dark:bg-slate-900"
            >
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">📍 Locations & courts</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Manage venues and their courts.</p>
            </Link>
            <Link
              to="/admin/tournaments"
              className="dt-lift rounded-2xl border border-slate-200 bg-white p-5 hover:border-green-400 dark:border-slate-800 dark:bg-slate-900"
            >
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">🏗️ Manage tournaments</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Create tournaments and review registrations.</p>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
