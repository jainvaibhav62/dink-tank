import type { LeaderboardRow, PublicProfile, RecentMatch, TopRival } from '../types'
import type { PlayerRating } from '../services/rating'
import { tierForRating } from '../services/rating'
import type { Achievement } from '../services/achievements'
import { RatingBadge } from './RatingBadge'
import { Sparkline } from './Sparkline'
import { FormPills } from './FormPills'
import { Achievements } from './Achievements'

export function PlayerStatsCard({
  stats,
  rating,
  form,
  streak,
  achievements,
  recentMatches,
  topRivals,
  profiles,
}: {
  stats: LeaderboardRow
  rating?: PlayerRating
  form?: boolean[]
  streak?: number
  achievements?: Achievement[]
  recentMatches: RecentMatch[]
  topRivals: TopRival[]
  profiles: Record<string, PublicProfile>
}) {
  const tier = rating ? tierForRating(rating.rating) : null

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      {/* Rating hero */}
      {rating && tier && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gradient-to-br from-lime-50 to-green-50 p-4 dark:from-green-950/20 dark:to-slate-900">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Dink Rating
            </p>
            <div className="mt-1 flex items-end gap-2">
              <RatingBadge rating={rating.rating} delta={rating.lastDelta} showTier size="lg" />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Peak {rating.peak.toFixed(2)}
              {streak && streak !== 0 ? ` · ${streak > 0 ? `${streak}-win streak 🔥` : `${Math.abs(streak)}-loss skid`}` : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Sparkline values={rating.history.length ? [rating.startRating, ...rating.history] : [rating.rating]} />
            {form && form.length > 0 && <FormPills form={form} />}
          </div>
        </div>
      )}

      {/* Overall record */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Your record</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.wins}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Wins</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.losses}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Losses</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.matchesPlayed > 0 ? `${Math.round(stats.winPct * 100)}%` : '–'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Win rate</p>
          </div>
          <div>
            <p
              className={`text-2xl font-bold ${
                stats.pointDiff > 0
                  ? 'text-green-600 dark:text-green-400'
                  : stats.pointDiff < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {stats.pointDiff > 0 ? '+' : ''}
              {stats.pointDiff}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Point diff</p>
          </div>
        </div>
      </div>

      {achievements && achievements.length > 0 && <Achievements achievements={achievements} />}

      {/* Recent matches */}
      {recentMatches.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Recent matches</h3>
          <ul className="space-y-2">
            {recentMatches.map((m) => (
              <li
                key={m.matchId}
                className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-800"
              >
                <span className="text-slate-600 dark:text-slate-300">vs {m.opponentNames}</span>
                <span className="font-medium">
                  <span className={m.won ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-300'}>
                    {m.won ? 'W' : 'L'}
                  </span>{' '}
                  <span className="text-slate-500 dark:text-slate-400">
                    {m.scoreFor}–{m.scoreAgainst}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top rivals */}
      {topRivals.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Top rivals</h3>
          <ul className="space-y-2">
            {topRivals.map((rival) => (
              <li
                key={rival.userId}
                className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-800"
              >
                <span className="text-slate-600 dark:text-slate-300">
                  {profiles[rival.userId]?.displayName ?? 'Unknown player'}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {rival.headToHeadWins}–{rival.headToHeadLosses}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.matchesPlayed === 0 && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          🥒 Fresh start! No completed matches yet. Sign up for a tournament and start stacking dinks.
        </p>
      )}
    </div>
  )
}
