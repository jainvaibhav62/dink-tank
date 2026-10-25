import { Avatar } from './Avatar'
import type { PublicProfile } from '../types'
import type { PlayerRating } from '../services/rating'

interface PodiumEntry {
  userId: string
  wins: number
}

/** Top-3 podium — magnitude by bar height, identity by avatar + name. The three
 * places are intrinsically ordered, so a graded gold/silver/bronze is correct
 * here (it's not arbitrary category color). */
export function Podium({
  entries,
  profiles,
  ratings,
}: {
  entries: PodiumEntry[]
  profiles: Record<string, PublicProfile>
  ratings?: Record<string, PlayerRating>
}) {
  if (entries.length === 0) return null
  const top = entries.slice(0, 3)
  // Render order: 2nd, 1st, 3rd so the winner sits centre and tallest.
  const order = [top[1], top[0], top[2]].filter(Boolean)
  const heights: Record<string, string> = { '0': 'h-28', '1': 'h-20', '2': 'h-14' }
  const medals = ['🥇', '🥈', '🥉']
  const barTints: Record<number, string> = {
    0: 'from-amber-300 to-amber-500',
    1: 'from-slate-300 to-slate-400',
    2: 'from-orange-300 to-orange-500',
  }

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6">
      {order.map((entry) => {
        const place = top.indexOf(entry) // 0,1,2
        return (
          <div key={entry.userId} className="animate-dt-rise flex w-24 flex-col items-center sm:w-28">
            <div className="text-2xl">{medals[place]}</div>
            <Avatar
              src={profiles[entry.userId]?.photoURL}
              name={profiles[entry.userId]?.displayName ?? '?'}
              size={place === 0 ? 56 : 44}
              className="ring-2 ring-white dark:ring-slate-900"
            />
            <p className="mt-1 max-w-full truncate text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
              {profiles[entry.userId]?.displayName ?? 'Unknown'}
            </p>
            {ratings && (
              <p className="text-xs font-bold tabular-nums text-green-600 dark:text-green-400">
                {(ratings[entry.userId]?.rating ?? 3).toFixed(2)}
              </p>
            )}
            <div
              className={`mt-2 flex w-full items-start justify-center rounded-t-lg bg-gradient-to-b ${barTints[place]} ${heights[String(place)]} pt-2 text-xs font-bold text-white/90`}
            >
              {entry.wins}W
            </div>
          </div>
        )
      })}
    </div>
  )
}
