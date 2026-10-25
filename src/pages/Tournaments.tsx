import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  listRegistrationsForUser,
  registerForTournament,
  waitlistPosition,
  withdrawRegistration,
  subscribeToRegistrations,
} from '../services/registrations'
import { getRegistrationPhase, subscribeToTournaments } from '../services/tournaments'
import type { Registration, Tournament } from '../types'

const NOT_OPEN_MESSAGE = (opensAt: Date) =>
  `🥒 Hold your paddles! Registration opens ${opensAt.toLocaleString()}. The sign-up sheet is still warming up in the kitchen.`

function statusBadge(status: Tournament['status']) {
  const map: Record<Tournament['status'], string> = {
    draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    registration_open: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    live: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    archived: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  }
  return map[status]
}

export function TournamentsPage() {
  const { profile } = useAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [waitlistPositions, setWaitlistPositions] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Live tournament list.
  useEffect(() => {
    const unsub = subscribeToTournaments((list) => {
      setTournaments(list)
      setLoading(false)
    })
    return unsub
  }, [])

  // The signed-in player's own registrations (reloaded after register/withdraw).
  async function loadRegistrations() {
    if (!profile) return
    const myRegistrations = await listRegistrationsForUser(profile.uid)
    setRegistrations(myRegistrations)

    const positions: Record<string, number> = {}
    await Promise.all(
      myRegistrations
        .filter((r) => r.status === 'waitlisted')
        .map(
          (r) =>
            new Promise<void>((resolve) => {
              const unsub = subscribeToRegistrations(r.tournamentId, (regs) => {
                const pos = waitlistPosition(regs, r.userId)
                if (pos) positions[r.tournamentId] = pos
                unsub()
                resolve()
              })
            }),
        ),
    )
    setWaitlistPositions(positions)
  }

  useEffect(() => {
    loadRegistrations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid])

  async function handleRegister(tournamentId: string) {
    if (!profile) return
    setBusyId(tournamentId)
    await registerForTournament(tournamentId, profile.uid)
    await loadRegistrations()
    setBusyId(null)
  }

  async function handleWithdraw(registrationId: string, tournamentId: string) {
    setBusyId(tournamentId)
    await withdrawRegistration(registrationId)
    await loadRegistrations()
    setBusyId(null)
  }

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Loading tournaments…</p>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Tournaments</h1>
      {tournaments.length === 0 && <p className="text-slate-500 dark:text-slate-400">No tournaments yet.</p>}
      <ul className="space-y-3">
        {tournaments.map((tournament) => {
          const registration = registrations.find((r) => r.tournamentId === tournament.id)
          const isActive = registration?.status === 'confirmed' || registration?.status === 'waitlisted'
          const phase = getRegistrationPhase(tournament)
          const opensAt = tournament.registrationOpensAt?.toDate()

          return (
            <li
              key={tournament.id}
              className={`rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${
                phase === 'not_open' ? 'opacity-70' : ''
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/tournaments/${tournament.id}`}
                      className="font-semibold text-slate-900 hover:text-green-600 dark:text-slate-100 dark:hover:text-green-400"
                    >
                      {tournament.name}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(tournament.status)}`}>
                      {tournament.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {tournament.date?.toDate?.().toLocaleDateString() ?? ''} · {tournament.type} ·{' '}
                    {tournament.maxPlayers} players max · race to {tournament.pointsTarget}
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
                        {registration!.status === 'confirmed'
                          ? "You're confirmed! 🎉"
                          : `Waitlisted (#${waitlistPositions[tournament.id] ?? '?'})`}
                      </span>
                      {tournament.status !== 'completed' && (
                        <button
                          onClick={() => handleWithdraw(registration!.id, tournament.id)}
                          disabled={busyId === tournament.id || phase === 'closed'}
                          title={phase === 'closed' ? 'Registration deadline has passed' : ''}
                          className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  ) : phase === 'open' ? (
                    <button
                      onClick={() => handleRegister(tournament.id)}
                      disabled={busyId === tournament.id}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {busyId === tournament.id ? 'Registering…' : 'Register'}
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

              <div className="mt-3">
                <Link
                  to={`/tournaments/${tournament.id}`}
                  className="text-sm font-medium text-green-600 hover:underline dark:text-green-400"
                >
                  View fixtures & live scores →
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
