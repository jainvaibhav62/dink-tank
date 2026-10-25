import type { LeaderboardRow, Match, PublicProfile } from '../types'
import type { PlayerRating } from '../services/rating'
import { recentForm } from '../services/rating'
import { RatingBadge } from './RatingBadge'
import { FormPills } from './FormPills'

export function TournamentStandings({
  rows,
  profiles,
  ratings,
  matches,
}: {
  rows: LeaderboardRow[]
  profiles: Record<string, PublicProfile>
  /** When provided, a live Dink Rating column (with movement) is shown. */
  ratings?: Record<string, PlayerRating>
  /** When provided (with ratings), a recent-form column is shown. */
  matches?: Match[]
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No standings yet.</p>
  }
  const showRating = !!ratings

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <th className="py-1.5 pr-3 font-medium">#</th>
            <th className="py-1.5 pr-3 font-medium">Player</th>
            {showRating && <th className="py-1.5 pr-3 text-right font-medium">Rating</th>}
            <th className="py-1.5 pr-3 text-right font-medium">W</th>
            <th className="py-1.5 pr-3 text-right font-medium">L</th>
            <th className="py-1.5 pr-3 text-right font-medium">Win%</th>
            <th className="py-1.5 pr-3 text-right font-medium">Diff</th>
            {showRating && matches && <th className="py-1.5 text-right font-medium">Form</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const r = ratings?.[row.userId]
            return (
              <tr key={row.userId} className="border-b border-slate-100 last:border-0 dark:border-slate-900">
                <td className="py-1.5 pr-3 text-slate-500 dark:text-slate-400">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td className="py-1.5 pr-3 font-medium text-slate-900 dark:text-slate-100">
                  {profiles[row.userId]?.displayName ?? 'Unknown player'}
                </td>
                {showRating && (
                  <td className="py-1.5 pr-3 text-right">
                    <RatingBadge rating={r?.rating ?? 3} delta={r?.lastDelta} size="sm" />
                  </td>
                )}
                <td className="py-1.5 pr-3 text-right">{row.wins}</td>
                <td className="py-1.5 pr-3 text-right">{row.losses}</td>
                <td className="py-1.5 pr-3 text-right">
                  {row.matchesPlayed > 0 ? `${Math.round(row.winPct * 100)}%` : '–'}
                </td>
                <td className="py-1.5 pr-3 text-right">
                  {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                </td>
                {showRating && matches && (
                  <td className="py-1.5 text-right">
                    <div className="flex justify-end">
                      <FormPills form={recentForm(row.userId, matches, 5)} />
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
