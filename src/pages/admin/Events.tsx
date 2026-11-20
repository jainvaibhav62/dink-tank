import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { DEFAULT_ROSTER } from '../../data/roster'
import { createEvent, deleteEvent, subscribeToEvents } from '../../services/events'
import type { PickleEvent } from '../../types'

export function AdminEventsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<PickleEvent[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('Dink Tank Live')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [courtCount, setCourtCount] = useState(5)
  const [pointsTarget, setPointsTarget] = useState(11)
  const [winBy, setWinBy] = useState(2)
  const [roster, setRoster] = useState(DEFAULT_ROSTER.join('\n'))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeToEvents((list) => {
      setEvents(list)
      setLoading(false)
    })
    return unsub
  }, [])

  const names = useMemo(() => roster.split('\n').map((n) => n.trim()).filter(Boolean), [roster])
  const perRound = Math.min(courtCount * 4, Math.floor(names.length / 4) * 4)
  const resting = Math.max(0, names.length - perRound)
  const waitWarning = names.length > courtCount * 4 * 2

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError('')
    if (names.length < 4) {
      setError('Add at least 4 players.')
      return
    }
    setSubmitting(true)
    try {
      const id = await createEvent({
        name: name.trim(),
        date: new Date(date),
        courtCount,
        pointsTarget,
        winBy,
        names,
        createdBy: profile.uid,
      })
      navigate(`/events/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create event.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy(ev: PickleEvent) {
    const url = `${window.location.origin}${window.location.pathname}#/events/${ev.id}`
    await navigator.clipboard.writeText(url)
    setCopiedId(ev.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleDelete(ev: PickleEvent) {
    if (!window.confirm(`Delete "${ev.name}" and all its matches? This cannot be undone.`)) return
    await deleteEvent(ev.id)
  }

  const inputClass =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Live events</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Run an open-play session with a fixed roster — no sign-ups. Players rotate across courts and nobody
          waits more than one round.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900"
      >
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Event name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Courts</span>
          <input
            type="number"
            min={1}
            max={12}
            value={courtCount}
            onChange={(e) => setCourtCount(Math.max(1, Number(e.target.value)))}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Game to</span>
          <select value={pointsTarget} onChange={(e) => setPointsTarget(Number(e.target.value))} className={inputClass}>
            <option value={11}>11 (standard)</option>
            <option value={15}>15</option>
            <option value={21}>21</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Win by</span>
          <select value={winBy} onChange={(e) => setWinBy(Number(e.target.value))} className={inputClass}>
            <option value={2}>2 (standard)</option>
            <option value={1}>1</option>
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Players — one name per line
          </span>
          <textarea
            value={roster}
            onChange={(e) => setRoster(e.target.value)}
            rows={10}
            className={`${inputClass} font-mono`}
          />
        </label>

        <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50 sm:col-span-2">
          <p className="text-slate-700 dark:text-slate-200">
            <strong>{names.length}</strong> players · <strong>{courtCount}</strong> courts → <strong>{perRound}</strong>{' '}
            play and <strong>{resting}</strong> rest each round.
          </p>
          {waitWarning && (
            <p className="mt-1 text-amber-600 dark:text-amber-400">
              ⚠️ With this many players vs courts, some may occasionally wait two rounds. Add courts or reduce the roster
              to guarantee the one-round rule (roster ≤ courts × 8 = {courtCount * 8}).
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 sm:col-span-2"
        >
          {submitting ? 'Creating…' : 'Create event & open live view'}
        </button>
      </form>

      <div>
        <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-slate-100">All events</h2>
        {loading ? (
          <p className="text-slate-500 dark:text-slate-400">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">No events yet.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <Link
                    to={`/events/${ev.id}`}
                    className="font-medium text-slate-900 hover:text-green-600 dark:text-slate-100 dark:hover:text-green-400"
                  >
                    {ev.name}
                  </Link>
                  <p className="text-sm capitalize text-slate-500 dark:text-slate-400">
                    {ev.status} · {ev.participants.length} players ·{' '}
                    {ev.currentRound > 0 ? `round ${ev.currentRound}` : 'not started'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleCopy(ev)}
                    className="rounded-md bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    {copiedId === ev.id ? '✓ Copied!' : '🔗 Watch link'}
                  </button>
                  <Link
                    to={`/events/${ev.id}`}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => handleDelete(ev)}
                    className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
