import { useState } from 'react'
import type { EventMatch, EventParticipant } from '../types'

const TEAM_A = { ring: 'ring-blue-500', bg: 'bg-blue-600', text: 'text-blue-600 dark:text-blue-400' }
const TEAM_B = { ring: 'ring-amber-500', bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' }

function PlayerChip({
  p,
  team,
  dim,
}: {
  p: EventParticipant | undefined
  team: typeof TEAM_A
  dim: boolean
}) {
  return (
    <div className={`flex flex-col items-center gap-1 transition ${dim ? 'opacity-40' : ''}`}>
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full ${team.bg} text-sm font-bold text-white ring-2 ${team.ring} ring-offset-2 ring-offset-transparent shadow-lg`}
      >
        {p?.initials ?? '?'}
      </div>
      <span className="max-w-[72px] truncate text-center text-[11px] font-semibold text-white drop-shadow sm:max-w-[90px] sm:text-xs">
        {p?.name ?? '—'}
      </span>
    </div>
  )
}

export function CourtView({
  match,
  participants,
  courtName,
  pointsTarget,
  winBy,
  editable = false,
  onScore,
  onClear,
}: {
  match: EventMatch
  participants: Map<string, EventParticipant>
  courtName: string
  pointsTarget: number
  winBy: number
  editable?: boolean
  onScore?: (match: EventMatch, a: number, b: number) => Promise<void>
  onClear?: (matchId: string) => Promise<void>
}) {
  const [a, setA] = useState(match.scoreA?.toString() ?? '')
  const [b, setB] = useState(match.scoreB?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const done = match.status === 'completed'
  const aWon = done && match.winner === 'A'
  const bWon = done && match.winner === 'B'
  const showForm = editable && (!done || editing)

  async function save() {
    if (!onScore) return
    const na = Number(a)
    const nb = Number(b)
    setSaving(true)
    setError('')
    try {
      await onScore(match, na, nb)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save score.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-dt-rise overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
      {/* Scoreboard header */}
      <div className="flex items-center justify-between gap-2 bg-slate-950/80 px-3 py-2">
        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-300">
          {courtName}
        </span>
        <div className="flex items-center gap-2 font-mono text-2xl font-black tabular-nums">
          <span className={aWon ? 'text-blue-400' : done ? 'text-slate-500' : 'text-blue-300'}>
            {match.scoreA ?? 0}
          </span>
          <span className="text-slate-600">:</span>
          <span className={bWon ? 'text-amber-400' : done ? 'text-slate-500' : 'text-amber-300'}>
            {match.scoreB ?? 0}
          </span>
        </div>
        {done ? (
          <span className="rounded-full bg-green-600/20 px-2 py-0.5 text-[10px] font-bold uppercase text-green-400">
            Final
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600/20 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            Live
          </span>
        )}
      </div>

      {/* The court */}
      <div className="relative bg-gradient-to-b from-emerald-700 to-emerald-800 p-3">
        <div className="relative flex h-32 items-stretch overflow-hidden rounded-lg bg-blue-600 ring-2 ring-white/80 sm:h-36">
          {/* kitchen (non-volley zones) flanking the net */}
          <div className="absolute inset-y-0 left-1/2 w-[18%] -translate-x-full bg-blue-500/60" />
          <div className="absolute inset-y-0 left-1/2 w-[18%] bg-blue-500/60" />
          {/* net */}
          <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/90" />
          <div className="absolute inset-y-[-2px] left-1/2 w-[3px] -translate-x-1/2 border-x border-dashed border-white/50" />
          {/* centerline halves */}
          <div className="absolute left-0 top-1/2 h-0.5 w-[32%] -translate-y-1/2 bg-white/40" />
          <div className="absolute right-0 top-1/2 h-0.5 w-[32%] -translate-y-1/2 bg-white/40" />

          {/* Team A (left) */}
          <div
            className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-l-lg transition sm:gap-4 ${
              aWon ? 'bg-green-500/15' : ''
            }`}
          >
            <PlayerChip p={participants.get(match.teamA[0])} team={TEAM_A} dim={bWon} />
            <PlayerChip p={participants.get(match.teamA[1])} team={TEAM_A} dim={bWon} />
          </div>
          {/* Team B (right) */}
          <div
            className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-r-lg transition sm:gap-4 ${
              bWon ? 'bg-green-500/15' : ''
            }`}
          >
            <PlayerChip p={participants.get(match.teamB[0])} team={TEAM_B} dim={aWon} />
            <PlayerChip p={participants.get(match.teamB[1])} team={TEAM_B} dim={aWon} />
          </div>
        </div>
      </div>

      {/* Admin score entry */}
      {showForm && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 bg-slate-950/60 px-3 py-2">
          <input
            type="number"
            min={0}
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="A"
            className="w-14 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-center text-sm text-white"
          />
          <span className="text-slate-500">–</span>
          <input
            type="number"
            min={0}
            value={b}
            onChange={(e) => setB(e.target.value)}
            placeholder="B"
            className="w-14 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-center text-sm text-white"
          />
          <span className="text-[11px] text-slate-500">
            to {pointsTarget}
            {winBy > 1 ? ` · win by ${winBy}` : ''}
          </span>
          <button
            onClick={save}
            disabled={saving || a === '' || b === ''}
            className="rounded-md bg-green-600 px-3 py-1 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {error && <span className="w-full text-xs text-red-400">{error}</span>}
        </div>
      )}
      {editable && done && !editing && (
        <div className="flex justify-end gap-3 border-t border-slate-800 bg-slate-950/60 px-3 py-1.5">
          <button onClick={() => setEditing(true)} className="text-xs font-medium text-slate-400 hover:text-white">
            Edit score
          </button>
          {onClear && (
            <button
              onClick={() => onClear(match.id)}
              className="text-xs font-medium text-red-400 hover:text-red-300"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
