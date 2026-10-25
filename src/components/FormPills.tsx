/** Recent form as W/L pills (newest first). Carries a letter + color, never
 * color alone, so it reads without relying on hue. */
export function FormPills({ form }: { form: boolean[] }) {
  if (form.length === 0) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
  }
  return (
    <span className="inline-flex gap-1">
      {form.map((won, i) => (
        <span
          key={i}
          title={won ? 'Win' : 'Loss'}
          className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
            won
              ? 'bg-green-600 text-white'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          {won ? 'W' : 'L'}
        </span>
      ))}
    </span>
  )
}
