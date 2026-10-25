import type { ReactNode } from 'react'

/** A single headline number — the form you reach for before a chart. */
export function StatTile({
  label,
  value,
  sub,
  accent = 'slate',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  accent?: 'slate' | 'green' | 'blue' | 'amber' | 'violet'
}) {
  const accents: Record<string, string> = {
    slate: 'text-slate-900 dark:text-slate-100',
    green: 'text-green-600 dark:text-green-400',
    blue: 'text-blue-600 dark:text-blue-400',
    amber: 'text-amber-600 dark:text-amber-400',
    violet: 'text-violet-600 dark:text-violet-400',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accents[accent]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  )
}
