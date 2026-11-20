import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { subscribeToEvents } from '../services/events'
import type { PickleEvent } from '../types'

/** Public banner that surfaces any in-progress event so anyone visiting the site
 * (no sign-in) can jump straight to watching the courts + leaderboard. */
export function LiveEventsCallout() {
  const [events, setEvents] = useState<PickleEvent[]>([])

  useEffect(() => subscribeToEvents(setEvents), [])

  const ongoing = events.filter((e) => e.status !== 'completed')
  if (ongoing.length === 0) return null

  return (
    <div className="space-y-2">
      {ongoing.map((e) => {
        const live = e.status === 'live' && e.currentRound > 0
        return (
          <Link
            key={e.id}
            to={`/events/${e.id}`}
            className="dt-lift flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-green-400 bg-gradient-to-r from-lime-50 to-green-50 p-4 dark:border-green-600/60 dark:from-green-950/30 dark:to-slate-900"
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                  live
                    ? 'bg-red-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {live && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
                {live ? 'Live now' : 'Starting soon'}
              </span>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">🥒 {e.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {e.participants.length} players · {e.courtCount} courts ·{' '}
                  {e.currentRound > 0 ? `Round ${e.currentRound}` : 'Check-in open'}
                </p>
              </div>
            </div>
            <span className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white">
              {live ? 'Watch live →' : 'Check in →'}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
