/** A tiny single-series rating trend line. One series → no legend; the context
 * around it names what it is. Thin 2px stroke, last point marked. */
export function Sparkline({
  values,
  width = 120,
  height = 32,
}: {
  values: number[]
  width?: number
  height?: number
}) {
  if (values.length < 2) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">Not enough data yet</span>
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = 3
  const stepX = (width - pad * 2) / (values.length - 1)
  const y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2)
  const points = values.map((v, i) => [pad + i * stepX, y(v)] as const)
  const path = points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const rising = values[values.length - 1] >= values[0]
  const stroke = rising ? '#16a34a' : '#dc2626'
  const [lx, ly] = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={3} fill={stroke} />
    </svg>
  )
}
