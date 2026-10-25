import type { Achievement } from '../services/achievements'

/** Badge wall. Earned badges pop in colour; locked ones are dimmed + desaturated
 * with their unlock condition as the tooltip. */
export function Achievements({ achievements }: { achievements: Achievement[] }) {
  const earned = achievements.filter((a) => a.earned).length
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Achievements</h3>
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          {earned}/{achievements.length} unlocked
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {achievements.map((a) => (
          <div
            key={a.id}
            title={`${a.label} — ${a.description}`}
            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition ${
              a.earned
                ? 'animate-dt-pop border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20'
                : 'border-slate-200 bg-slate-50 opacity-50 grayscale dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <span className="text-2xl leading-none">{a.emoji}</span>
            <span className="text-[10px] font-medium leading-tight text-slate-600 dark:text-slate-300">
              {a.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
