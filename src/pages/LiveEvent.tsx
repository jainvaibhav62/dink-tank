import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CourtView } from '../components/CourtView'
import { RatingBadge } from '../components/RatingBadge'
import {
  clearEventScore,
  generateNextRound,
  recordEventScore,
  setEventStatus,
  subscribeToEvent,
  subscribeToEventMatches,
  undoLastRound,
} from '../services/events'
import { computeEventLeaderboard } from '../services/eventLeaderboard'
import { burstConfetti } from '../lib/confetti'
import type { EventMatch, PickleEvent } from '../types'

type Tab = 'courts' | 'leaderboard'

export function LiveEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAdmin } = useAuth()
  const [event, setEvent] = useState<PickleEvent | null>(null)
  const [matches, setMatches] = useState<EventMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('courts')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!eventId) return
    const u1 = subscribeToEvent(eventId, (e) => {
      setEvent(e)
      setLoading(false)
    })
    const u2 = subscribeToEventMatches(eventId, setMatches)
    return () => {
      u1()
      u2()
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
    return event.participants.filter((p) => !playing.has(p.id)).map((p) => p.id)
  }, [event, currentMatches])

  const leaderboard = useMemo(
    () => (event ? computeEventLeaderboard(event.participants, matches) : []),
    [event, matches],
  )

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Loading event…</p>
  if (!event) return <p className="text-slate-500 dark:text-slate-400">Event not found.</p>

  const roundScored = currentMatches.length > 0 && currentMatches.every((m) => m.status === 'completed')

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black dt-gradient-text sm:text-3xl">🥒 {event.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {event.participants.length} players · {event.courtCount} courts · race to {event.pointsTarget}
            {event.winBy > 1 ? ` (win by ${event.winBy})` : ''} ·{' '}
            {event.currentRound > 0 ? `Round ${event.currentRound}` : 'Not started'}
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setTab('courts')}
            className={`rounded-md px-3 py-1 font-medium ${tab === 'courts' ? 'bg-green-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
          >
            Courts
          </button>
          <button
            onClick={() => setTab('leaderboard')}
            className={`rounded-md px-3 py-1 font-medium ${tab === 'leaderboard' ? 'bg-green-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
          >
            Leaderboard
          </button>
        </div>
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => run(() => generateNextRound(event.id))}
            disabled={busy || (event.currentRound > 0 && !roundScored)}
            title={event.currentRound > 0 && !roundScored ? 'Finish scoring this round first' : ''}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? 'Working…' : event.currentRound === 0 ? '▶ Start Round 1' : `▶ Start Round ${event.currentRound + 1}`}
          </button>
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

      {tab === 'courts' ? (
        <>
          {currentMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-2 text-4xl">🎾</div>
              <p className="font-medium text-slate-700 dark:text-slate-200">
                {event.currentRound === 0 ? 'Waiting for the first round to start.' : 'No matches this round.'}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isAdmin ? 'Hit “Start Round 1” above to begin.' : 'Hang tight — the organizer will start play shortly.'}
              </p>
            </div>
          ) : (
            <>
              {/* The stadium */}
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
                      editable={isAdmin && event.status !== 'completed'}
                      onScore={handleScore}
                      onClear={(id) => clearEventScore(id)}
                    />
                  ))}
                </div>
              </div>

              {/* Bench */}
              {restingIds.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      🪑 On the bench — up next ({restingIds.length})
                    </h3>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      Nobody waits more than one round
                    </span>
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
          )}
        </>
      ) : (
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
