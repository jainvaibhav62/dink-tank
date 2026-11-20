import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CourtView } from '../components/CourtView'
import { RatingBadge } from '../components/RatingBadge'
import {
  addParticipant,
  clearEventScore,
  generateNextRound,
  recordEventScore,
  seatRound1Arrivals,
  setCheckin,
  setEventStatus,
  subscribeToCheckins,
  subscribeToEvent,
  subscribeToEventMatches,
  undoLastRound,
} from '../services/events'
import { computeEventLeaderboard } from '../services/eventLeaderboard'
import { burstConfetti } from '../lib/confetti'
import type { EventMatch, PickleEvent } from '../types'

type Tab = 'checkin' | 'courts' | 'leaderboard'

export function LiveEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAdmin } = useAuth()
  const [event, setEvent] = useState<PickleEvent | null>(null)
  const [matches, setMatches] = useState<EventMatch[]>([])
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')

  useEffect(() => {
    if (!eventId) return
    const u1 = subscribeToEvent(eventId, (e) => {
      setEvent(e)
      setLoading(false)
    })
    const u2 = subscribeToEventMatches(eventId, setMatches)
    const u3 = subscribeToCheckins(eventId, setCheckedIn)
    return () => {
      u1()
      u2()
      u3()
    }
  }, [eventId])

  const participantMap = useMemo(
    () => new Map((event?.participants ?? []).map((p) => [p.id, p])),
    [event],
  )
  const currentMatches = useMemo(
    () => matches.filter((m) => m.round === event?.currentRound).sort((a, b) => a.courtIndex - b.courtIndex),
    [matches, event?.currentRound],
  )
  const restingIds = useMemo(() => {
    if (!event) return []
    const playing = new Set(currentMatches.flatMap((m) => [...m.teamA, ...m.teamB]))
    return event.participants.filter((p) => checkedIn.has(p.id) && !playing.has(p.id)).map((p) => p.id)
  }, [event, currentMatches, checkedIn])
  const leaderboard = useMemo(
    () => (event ? computeEventLeaderboard(event.participants, matches) : []),
    [event, matches],
  )

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Loading event…</p>
  if (!event) return <p className="text-slate-500 dark:text-slate-400">Event not found.</p>

  const effectiveTab: Tab = tab ?? (event.currentRound > 0 ? 'courts' : 'checkin')
  const roundScored = currentMatches.length > 0 && currentMatches.every((m) => m.status === 'completed')
  const checkedInCount = event.participants.filter((p) => checkedIn.has(p.id)).length

  // Round 1 is dynamic: courts fill as players are checked in.
  const round1 = matches.filter((m) => m.round === 1)
  const seatedRound1 = new Set(round1.flatMap((m) => [...m.teamA, ...m.teamB]))
  const waitingToSeat = event.participants.filter((p) => checkedIn.has(p.id) && !seatedRound1.has(p.id)).length
  const canSeatRound1 = event.currentRound <= 1 && round1.length < event.courtCount
  const seatableCourts = Math.min(event.courtCount - round1.length, Math.floor(waitingToSeat / 4))

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleScore(match: EventMatch, a: number, b: number) {
    await recordEventScore(match, a, b, event!.pointsTarget, event!.winBy)
    burstConfetti(900)
  }

  async function handleCheckin(participantId: string, next: boolean) {
    setError('')
    // Don't let a player be checked out while they're on a court this round.
    if (!next && currentMatches.some((m) => [...m.teamA, ...m.teamB].includes(participantId))) {
      setError('That player is on a court this round — you can’t check them out yet.')
      return
    }
    await setCheckin(event!.id, participantId, next)
    // Dynamic round 1: seat a court as soon as four are ready.
    if (next && event!.currentRound <= 1) {
      await seatRound1Arrivals(event!.id)
    }
  }

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`rounded-md px-3 py-1 font-medium ${effectiveTab === id ? 'bg-green-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black dt-gradient-text sm:text-3xl">🥒 {event.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {checkedInCount}/{event.participants.length} checked in · {event.courtCount} courts · race to{' '}
            {event.pointsTarget}
            {event.winBy > 1 ? ` (win by ${event.winBy})` : ''} ·{' '}
            {event.currentRound > 0 ? `Round ${event.currentRound}` : 'Not started'}
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm dark:border-slate-800 dark:bg-slate-900">
          <TabBtn id="checkin" label="Check-in" />
          <TabBtn id="courts" label="Courts" />
          <TabBtn id="leaderboard" label="Leaderboard" />
        </div>
      </div>

      {/* Admin round controls */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          {/* Round 1 — seat checked-in players onto courts as they arrive */}
          {canSeatRound1 && (
            <button
              onClick={() => run(() => seatRound1Arrivals(event.id))}
              disabled={busy || seatableCourts < 1}
              title={seatableCourts < 1 ? 'Check in 4 players not yet on a court' : ''}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {busy
                ? 'Working…'
                : `▶ Seat ${Math.max(seatableCourts, 0)} court${seatableCourts === 1 ? '' : 's'}${waitingToSeat > 0 ? ` · ${waitingToSeat} waiting` : ''}`}
            </button>
          )}
          {/* Round 2+ — randomized rotation */}
          {event.currentRound >= 1 && (
            <button
              onClick={() => run(() => generateNextRound(event.id))}
              disabled={busy || !roundScored || checkedInCount < 4}
              title={
                checkedInCount < 4
                  ? 'Need at least 4 checked-in players'
                  : !roundScored
                    ? 'Finish scoring this round first'
                    : ''
              }
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Working…' : `▶ Start Round ${event.currentRound + 1}`}
            </button>
          )}
          {event.currentRound > 0 && (
            <button
              onClick={() => run(() => undoLastRound(event.id))}
              disabled={busy}
              className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
            >
              Undo round
            </button>
          )}
          {event.status !== 'completed' ? (
            <button
              onClick={() => run(() => setEventStatus(event.id, 'completed'))}
              disabled={busy}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              End event
            </button>
          ) : (
            <button
              onClick={() => run(() => setEventStatus(event.id, 'live'))}
              disabled={busy}
              className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
            >
              Reopen
            </button>
          )}
          {roundScored && event.status !== 'completed' && (
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              ✓ Round {event.currentRound} complete — start the next one
            </span>
          )}
          {error && <span className="w-full text-sm text-red-600 dark:text-red-400">{error}</span>}
        </div>
      )}

      {effectiveTab === 'checkin' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-200">
            {isAdmin
              ? '👋 Tap a player to check them in — their tile turns green and they enter the rotation.'
              : '👀 Players shown in green are checked in and playing. The organizer manages check-in.'}
          </div>

          {isAdmin && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (newName.trim()) run(() => addParticipant(event.id, newName)).then(() => setNewName(''))
              }}
              className="flex gap-2"
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Add a new player…"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                disabled={busy || !newName.trim()}
                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700"
              >
                Add player
              </button>
            </form>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {event.participants.map((p) => {
              const isIn = checkedIn.has(p.id)
              return (
                <button
                  key={p.id}
                  onClick={isAdmin ? () => handleCheckin(p.id, !isIn) : undefined}
                  disabled={!isAdmin}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                    isAdmin ? 'cursor-pointer active:scale-95' : 'cursor-default'
                  } ${
                    isIn
                      ? 'border-green-500 bg-green-500 text-white shadow-md'
                      : `border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${isAdmin ? 'hover:border-green-400' : ''}`
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isIn ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {p.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className={`text-xs ${isIn ? 'text-white/90' : 'text-slate-400 dark:text-slate-500'}`}>
                      {isIn ? '✓ Playing' : isAdmin ? 'Tap to check in' : 'Not checked in'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {effectiveTab === 'courts' &&
        (currentMatches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-4xl">🎾</div>
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {event.currentRound === 0 ? 'Waiting for the first round to start.' : 'No matches this round.'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isAdmin ? 'Check players in, then hit “Start Round 1”.' : 'Hang tight — play starts soon. Check in on the Check-in tab!'}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-slate-950 p-3 sm:p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {currentMatches.map((m) => (
                  <CourtView
                    key={m.id}
                    match={m}
                    participants={participantMap}
                    courtName={`Court ${m.courtIndex + 1}`}
                    pointsTarget={event.pointsTarget}
                    winBy={event.winBy}
                    editable={event.status !== 'completed'}
                    canCorrect={isAdmin}
                    onScore={handleScore}
                    onClear={(id) => clearEventScore(id)}
                  />
                ))}
              </div>
            </div>

            {restingIds.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    🪑 On the bench — up next ({restingIds.length})
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500">Nobody waits more than one round</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {restingIds.map((id) => {
                    const p = participantMap.get(id)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-3 text-sm dark:bg-slate-800"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 text-[10px] font-bold text-white dark:bg-slate-600">
                          {p?.initials}
                        </span>
                        {p?.name}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ))}

      {effectiveTab === 'leaderboard' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {leaderboard.every((r) => r.gamesPlayed === 0) ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No results yet — the leaderboard fills in as matches are scored.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-1.5 pr-3 font-medium">#</th>
                    <th className="py-1.5 pr-3 font-medium">Player</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Rating</th>
                    <th className="py-1.5 pr-3 text-right font-medium">W</th>
                    <th className="py-1.5 pr-3 text-right font-medium">L</th>
                    <th className="py-1.5 pr-3 text-right font-medium">GP</th>
                    <th className="py-1.5 text-right font-medium">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((r, i) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-900">
                      <td className="py-1.5 pr-3 text-slate-500 dark:text-slate-400">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td className="py-1.5 pr-3 font-medium text-slate-900 dark:text-slate-100">{r.name}</td>
                      <td className="py-1.5 pr-3 text-right">
                        <RatingBadge rating={r.rating} delta={r.lastDelta} size="sm" />
                      </td>
                      <td className="py-1.5 pr-3 text-right">{r.wins}</td>
                      <td className="py-1.5 pr-3 text-right">{r.losses}</td>
                      <td className="py-1.5 pr-3 text-right">{r.gamesPlayed}</td>
                      <td className="py-1.5 text-right">{r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
