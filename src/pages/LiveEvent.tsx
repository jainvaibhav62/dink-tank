import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CourtView } from '../components/CourtView'
import { RatingBadge } from '../components/RatingBadge'
import {
  addParticipant,
  clearEventScore,
  recordEventScore,
  removeParticipant,
  seatFreeCourts,
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
  const [search, setSearch] = useState('')

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
  // Continuous play: each court shows its in-progress game, or — until the next
  // foursome is seated — the last completed game played on it (with its score).
  const courtMatches = useMemo(() => {
    if (!event) return []
    const out = []
    for (let c = 0; c < event.courtCount; c++) {
      const onCourt = matches.filter((m) => m.courtIndex === c)
      const active = onCourt.find((m) => m.status === 'scheduled')
      if (active) {
        out.push(active)
        continue
      }
      const lastDone = onCourt.filter((m) => m.status === 'completed').sort((a, b) => b.round - a.round)[0]
      if (lastDone) out.push(lastDone)
    }
    return out
  }, [event, matches])
  // The queue: checked-in players not currently on a court. Fewest-games-first
  // seating means these go on next — nobody is left waiting while others play on.
  const restingIds = useMemo(() => {
    if (!event) return []
    const onCourt = new Set(
      matches.filter((m) => m.status === 'scheduled').flatMap((m) => [...m.teamA, ...m.teamB]),
    )
    return event.participants.filter((p) => checkedIn.has(p.id) && !onCourt.has(p.id)).map((p) => p.id)
  }, [event, matches, checkedIn])
  const leaderboard = useMemo(
    () => (event ? computeEventLeaderboard(event.participants, matches) : []),
    [event, matches],
  )
  // How many courts could be refilled right now (free courts × available 4s).
  const seatInfo = useMemo(() => {
    if (!event) return { seatableCourts: 0, waiting: 0, liveCourts: 0 }
    const active = matches.filter((m) => m.status === 'scheduled')
    const busy = new Set(active.flatMap((m) => [...m.teamA, ...m.teamB]))
    const waiting = event.participants.filter((p) => checkedIn.has(p.id) && !busy.has(p.id)).length
    const freeCourts = event.courtCount - new Set(active.map((m) => m.courtIndex)).size
    return { waiting, liveCourts: active.length, seatableCourts: Math.min(freeCourts, Math.floor(waiting / 4)) }
  }, [event, matches, checkedIn])

  // Auto-refill: on the admin's screen (the stadium/TV view), the moment a court
  // frees up or new players check in, seat the next foursome — no manual step.
  const seatingRef = useRef(false)
  useEffect(() => {
    if (!isAdmin || !event || event.status === 'completed') return
    if (seatInfo.seatableCourts < 1 || seatingRef.current) return
    seatingRef.current = true
    seatFreeCourts(event.id).finally(() => {
      seatingRef.current = false
    })
  }, [isAdmin, event, seatInfo.seatableCourts])

  if (loading) return <p className="text-slate-500 dark:text-slate-400">Loading event…</p>
  if (!event) return <p className="text-slate-500 dark:text-slate-400">Event not found.</p>

  const effectiveTab: Tab = tab ?? (event.currentRound > 0 ? 'courts' : 'checkin')
  const checkedInCount = event.participants.filter((p) => checkedIn.has(p.id)).length

  const q = search.trim().toLowerCase()
  const visibleParticipants = q
    ? event.participants.filter(
        (p) => p.name.toLowerCase().includes(q) || p.initials.toLowerCase().includes(q),
      )
    : event.participants

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
    // Don't let a player be checked out while they're mid-game on a court.
    if (
      !next &&
      matches.some((m) => m.status === 'scheduled' && [...m.teamA, ...m.teamB].includes(participantId))
    ) {
      setError('That player is in a live game — you can’t check them out yet.')
      return
    }
    await setCheckin(event!.id, participantId, next)
    // The auto-refill effect seats any now-available court the moment state updates.
  }

  async function handleRemove(participantId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this event?`)) return
    await run(() => removeParticipant(event!.id, participantId))
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
            {seatInfo.liveCourts > 0 ? `${seatInfo.liveCourts} court${seatInfo.liveCourts === 1 ? '' : 's'} live` : 'Not started'}
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
          {/* Continuous play: courts auto-refill on this screen. This is a manual
              nudge for when 4+ are waiting and a court is open. */}
          {event.status !== 'completed' && (
            <button
              onClick={() => run(() => seatFreeCourts(event.id))}
              disabled={busy || seatInfo.seatableCourts < 1}
              title={seatInfo.seatableCourts < 1 ? 'Courts auto-fill — nothing waiting to seat right now' : ''}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {busy
                ? 'Working…'
                : seatInfo.seatableCourts >= 1
                  ? `▶ Seat ${seatInfo.seatableCourts} court${seatInfo.seatableCourts === 1 ? '' : 's'}`
                  : '▶ Courts auto-fill'}
            </button>
          )}
          {event.status !== 'completed' && (
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {seatInfo.liveCourts} live · {seatInfo.waiting} on the bench
            </span>
          )}
          {event.currentRound > 0 && (
            <button
              onClick={() => run(() => undoLastRound(event.id))}
              disabled={busy}
              title="Removes the most recent seating wave"
              className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
            >
              Undo seating
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

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${event.participants.length} players…`}
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-9 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                ✕
              </button>
            )}
          </div>

          {visibleParticipants.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No players match “{search}”.
            </p>
          ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {visibleParticipants.map((p) => {
              const isIn = checkedIn.has(p.id)
              return (
                <div key={p.id} className="relative">
                  <button
                    onClick={isAdmin ? () => handleCheckin(p.id, !isIn) : undefined}
                    disabled={!isAdmin}
                    className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left transition ${
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
                  {isAdmin && (
                    <button
                      onClick={() => handleRemove(p.id, p.name)}
                      title="Remove player"
                      aria-label={`Remove ${p.name}`}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white shadow hover:bg-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          )}
        </div>
      )}

      {effectiveTab === 'courts' &&
        (courtMatches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-4xl">🎾</div>
            <p className="font-medium text-slate-700 dark:text-slate-200">Waiting for the first games to start.</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isAdmin
                ? 'Check players in — courts fill automatically as soon as 4 are ready.'
                : 'Hang tight — play starts soon. Check in on the Check-in tab!'}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-slate-950 p-3 sm:p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {courtMatches.map((m) => (
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
                  <span className="text-xs text-slate-400 dark:text-slate-500">Fewest games play next — seated the moment a court frees</span>
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
