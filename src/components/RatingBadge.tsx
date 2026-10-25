import { tierForRating } from '../services/rating'

/** The Dink Rating number + optional tier chip + movement arrow. */
export function RatingBadge({
  rating,
  delta,
  showTier = false,
  size = 'md',
}: {
  rating: number
  delta?: number
  showTier?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const tier = tierForRating(rating)
  const numClass = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-sm' : 'text-base'

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`font-bold tabular-nums text-slate-900 dark:text-slate-100 ${numClass}`}>
        {rating.toFixed(2)}
      </span>
      {delta !== undefined && Math.abs(delta) >= 0.005 && (
        <span
          className={`inline-flex items-center text-xs font-semibold tabular-nums ${
            delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}
          title="Change from last match"
        >
          {delta > 0 ? '▲' : '▼'}
          {Math.abs(delta).toFixed(2)}
        </span>
      )}
      {showTier && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tier.chip}`}>{tier.label}</span>
      )}
    </span>
  )
}
