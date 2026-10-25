import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FixturesList } from '../components/FixturesList'
import { TournamentStandings } from '../components/TournamentStandings'
import { fetchPublicProfiles } from '../services/auth'
import { subscribeToMatches, submitOwnMatchScore } from '../services/fixtures'
import { computeTournamentLeaderboard } from '../services/leaderboard'
import { getCourtsByIds } from '../services/locations'
import {
  registerForTournament,
  waitlistPosition,
  withdrawRegistration,
  subscribeToRegistrations,
} from '../services/registrations'
import { getRegistrationPhase, subscribeToTournament } from '../services/tournaments'
import { burstConfetti } from '../lib/confetti'
import type { Court, Match, PublicProfile, Registration, Tournament } from '../types'

const NOT_OPEN_MESSAGE = (opensAt: Date) =>
  `🥒 Hold your paddles! Registration opens ${opensAt.toLocaleString()}.`

export function TournamentDetailPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const { profile } = useAuth()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [courts, setCourts] = useState<Court[]>([])
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  // Live tournament doc.
  useEffect(() => {
    if (!tournamentId) return
    const unsub = subscribeToTournament(tournamentId, (t) => {
      if (!t) setNotFound(true)
      setTournament(t)
      setLoading(false)
    })
    return unsub
  }, [tournamentId])

  // Live matches + registrations — the heart of the real-time scoreboard.
  useEffect(() => {
    if (!tournamentId) return
    const unsubMatches = subscribeToMatches(tournamentId, setMatches)
    const unsubRegs = subscribeToRegistrations(tournamentId, setRegistrations)
    return () => {
      unsubMatches()
      unsubRegs()
    }
  }, [tournamentId])

  // Courts for the tournament (static once set).
  useEffect(() => {
    if (!tournament) return
    getCourtsByIds(tournament.courtIds).then(setCourts)
  }, [tournament])

  const confirmedPlayerIds = useMemo(
    () => registrations.filter((r) => r.status === 'confirmed').map((r) => r.userId),
    [registrations],
  )

  // Resolve display names for everyone involved (participants + confirmed players).
  useEffect(() => {
    const involvedIds = [...matches.flatMap((m) => [...m.teamA, ...m.teamB]), ...confirmedPlayerIds]
    if (involvedIds.length === 0) return
    fetchPublicProfiles(involvedIds).then(setProfiles)
  }, [matches, confirmedPlayerIds])

  async function handleRegister() {
    if (!profile || !tournamentId) return
    setBusy(true)
    setError('')
    try {
      await registerForTournament(tournamentId, profile.uid)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register.')
    } finally {
      setBusy(false)
    }
  }

  const myRegistration = registrations.find((r) => r.userId === profile?.uid) ?? null

  async function handleWithdraw() {
    if (!myRegistration) return
    setBusy(true)
    setError('')
    try {
      await withdrawRegistration(myRegistration.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmitScore(matchId: string, scoreA: number, scoreB: number) {
    if (!profile || !tournament) return
    const match = matches.find((m) => m.id === matchId)
    if (!match) return
    await submitOwnMatchScore(match, scoreA, scoreB, profile.uid, tournament.pointsTarget, tournament.winBy)
    // Celebrate if the submitting player's team won.
    const onTeamA = match.teamA.includes(profile.uid)
    const won = (onTeamA && scoreA > scoreB) || (!onTeamA && scoreB > scoreA)
    if (won) burstConfetti()
  }

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Loading tournament…</p>
  if (notFound || !tournament) return <p className="text-slate-500 dark:text-slate-400">Tournament not found.</p>

  const isActive = myRegistration?.status === 'confirmed' || myRegistration?.status === 'waitlisted'
  const phase = getRegistrationPhase(tournament)
  const opensAt = tournament.registrationOpensAt?.toDate()
  const waitlistPos =
    myRegistration?.status === 'waitlisted' ? waitlistPosition(registrations, myRegistration.userId) : null
  const hasScores = matches.some((m) => m.status === 'completed')

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{tournament.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {tournament.date?.toDate?.().toLocaleDateString() ?? ''} · {tournament.type} ·{' '}
              {tournament.maxPlayers} players max · race to {tournament.pointsTarget}
              {tournament.winBy > 1 ? `, win by ${tournament.winBy}` : ''}
            </p>
          </div>

          {phase === 'not_open' && !isActive && (
            <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Not open yet
            </span>
          )}

          {phase !== 'not_open' &&
            (isActive ? (
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {myRegistration!.status === 'confirmed'
                    ? "You're confirmed! 🎉"
                    : `Waitlisted (#${waitlistPos ?? '?'})`}
                </span>
                {tournament.status !== 'completed' && (
                  <button
                    onClick={handleWithdraw}
                    disabled={busy || phase === 'closed'}
                    title={phase === 'closed' ? 'Registration deadline has passed' : ''}
                    className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            ) : phase === 'open' ? (
              <button
                onClick={handleRegister}
                disabled={busy}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {busy ? 'Registering…' : 'Register'}
              </button>
            ) : (
              <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Registration closed
              </span>
            ))}
        </div>

        {phase === 'not_open' && opensAt && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{NOT_OPEN_MESSAGE(opensAt)}</p>
        )}
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {matches.length > 0 && (
        <div className="space-y-4">
          {hasScores ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {tournament.status === 'completed' ? 'Final standings' : 'Live standings'}
              </h3>
              <TournamentStandings
                rows={computeTournamentLeaderboard(confirmedPlayerIds, matches)}
                profiles={profiles}
              />
            </div>
          ) : (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              🍲 Standings are still marinating — check back once a match has been scored!
            </div>
          )}
          <FixturesList
            matches={matches}
            courts={courts}
            profiles={profiles}
            currentUserId={tournament.status === 'completed' ? undefined : profile?.uid}
            pointsTarget={tournament.pointsTarget}
            winBy={tournament.winBy}
            onSubmitScore={tournament.status === 'completed' ? undefined : handleSubmitScore}
          />
        </div>
      )}
    </div>
  )
}
