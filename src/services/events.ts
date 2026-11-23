import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { converter } from './firestore'
import { initialsOf } from '../data/roster'
import { buildNextRound, bestPairing, pairKey } from './eventSchedule'
import { validatePickleballScore } from './fixtures'
import type { EventCheckin, EventMatch, EventParticipant, PickleEvent } from '../types'

const eventsRef = collection(db, 'events').withConverter(converter<PickleEvent>())
const eventMatchesRef = collection(db, 'eventMatches').withConverter(converter<EventMatch>())
const checkinsRef = collection(db, 'eventCheckins').withConverter(converter<EventCheckin>())

function checkinDocId(eventId: string, participantId: string) {
  return `${eventId}_${participantId}`
}

/** Public: a player checks themselves in (or out). No auth required. */
export async function setCheckin(eventId: string, participantId: string, checkedIn: boolean) {
  await setDoc(doc(db, 'eventCheckins', checkinDocId(eventId, participantId)), {
    eventId,
    participantId,
    checkedIn,
  })
}

/** Live set of checked-in participant ids. */
export function subscribeToCheckins(eventId: string, cb: (ids: Set<string>) => void) {
  return onSnapshot(query(checkinsRef, where('eventId', '==', eventId)), (snap) => {
    const ids = new Set<string>()
    snap.docs.forEach((d) => {
      const c = d.data()
      if (c.checkedIn) ids.add(c.participantId)
    })
    cb(ids)
  })
}

async function listCheckedInIds(eventId: string): Promise<Set<string>> {
  const snap = await getDocs(query(checkinsRef, where('eventId', '==', eventId)))
  const ids = new Set<string>()
  snap.docs.forEach((d) => {
    const c = d.data()
    if (c.checkedIn) ids.add(c.participantId)
  })
  return ids
}

/** Admin: append a new player to an event's roster mid-session. */
export async function addParticipant(eventId: string, name: string) {
  const event = await getEvent(eventId)
  if (!event) throw new Error('Event not found.')
  const trimmed = name.trim()
  if (!trimmed) return
  // Ids must stay unique even after removals, so key off the max existing id.
  const maxNum = event.participants.reduce((max, p) => {
    const n = parseInt(p.id.replace(/^p/, ''), 10)
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)
  const participant: EventParticipant = { id: `p${maxNum + 1}`, name: trimmed, initials: initialsOf(trimmed) }
  await updateDoc(doc(db, 'events', eventId), { participants: [...event.participants, participant] })
}

/** Admin: remove a player from the roster. Blocked once they appear in any
 * match (would orphan results); check them out and finish/undo first. */
export async function removeParticipant(eventId: string, participantId: string) {
  const event = await getEvent(eventId)
  if (!event) throw new Error('Event not found.')
  const matches = await listEventMatches(eventId)
  if (matches.some((m) => [...m.teamA, ...m.teamB].includes(participantId))) {
    throw new Error('That player is already in a match — undo the round or finish the event before removing them.')
  }
  await updateDoc(doc(db, 'events', eventId), {
    participants: event.participants.filter((p) => p.id !== participantId),
  })
  // Clear any check-in so stale state can't linger.
  await setDoc(doc(db, 'eventCheckins', checkinDocId(eventId, participantId)), {
    eventId,
    participantId,
    checkedIn: false,
  })
}

export interface CreateEventInput {
  name: string
  date: Date
  courtCount: number
  pointsTarget: number
  winBy: number
  names: string[]
  createdBy: string
}

function buildParticipants(names: string[]): EventParticipant[] {
  return names
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name, i) => ({ id: `p${i + 1}`, name, initials: initialsOf(name) }))
}

export async function createEvent(input: CreateEventInput): Promise<string> {
  const participants = buildParticipants(input.names)
  if (participants.length < 4) throw new Error('Need at least 4 players to run an event.')
  const ref = await addDoc(eventsRef, {
    id: '',
    name: input.name,
    date: Timestamp.fromDate(input.date),
    courtCount: input.courtCount,
    pointsTarget: input.pointsTarget,
    winBy: input.winBy,
    participants,
    status: 'setup',
    currentRound: 0,
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
  } as unknown as PickleEvent)
  return ref.id
}

export async function listEvents(): Promise<PickleEvent[]> {
  const snap = await getDocs(query(eventsRef, orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => d.data())
}

export function subscribeToEvents(cb: (events: PickleEvent[]) => void) {
  return onSnapshot(query(eventsRef, orderBy('createdAt', 'desc')), (snap) =>
    cb(snap.docs.map((d) => d.data())),
  )
}

export async function getEvent(id: string): Promise<PickleEvent | null> {
  const snap = await getDoc(doc(db, 'events', id).withConverter(converter<PickleEvent>()))
  return snap.exists() ? snap.data() : null
}

export function subscribeToEvent(id: string, cb: (event: PickleEvent | null) => void) {
  return onSnapshot(doc(db, 'events', id).withConverter(converter<PickleEvent>()), (snap) =>
    cb(snap.exists() ? snap.data() : null),
  )
}

export async function listEventMatches(eventId: string): Promise<EventMatch[]> {
  const snap = await getDocs(query(eventMatchesRef, where('eventId', '==', eventId)))
  return snap.docs.map((d) => d.data()).sort((a, b) => a.round - b.round || a.courtIndex - b.courtIndex)
}

export function subscribeToEventMatches(eventId: string, cb: (matches: EventMatch[]) => void) {
  return onSnapshot(query(eventMatchesRef, where('eventId', '==', eventId)), (snap) =>
    cb(snap.docs.map((d) => d.data()).sort((a, b) => a.round - b.round || a.courtIndex - b.courtIndex)),
  )
}

/** Generates and writes the next round. Blocks if the current round still has
 * unscored matches (finish scoring first). */
export async function generateNextRound(eventId: string): Promise<{ round: number; courts: number }> {
  const event = await getEvent(eventId)
  if (!event) throw new Error('Event not found.')
  const existing = await listEventMatches(eventId)

  if (event.currentRound > 0) {
    const thisRound = existing.filter((m) => m.round === event.currentRound)
    if (thisRound.some((m) => m.status !== 'completed')) {
      throw new Error('Finish scoring the current round before starting the next one.')
    }
  }

  // Only checked-in players enter the rotation.
  const checkedIn = await listCheckedInIds(eventId)
  const ids = event.participants.map((p) => p.id).filter((id) => checkedIn.has(id))
  if (ids.length < 4) throw new Error('Need at least 4 checked-in players to start a round.')
  const { matches } = buildNextRound(ids, event.courtCount, existing)
  if (matches.length === 0) throw new Error('Not enough checked-in players to form a court.')

  const round = event.currentRound + 1
  const batch = writeBatch(db)
  matches.forEach((m) => {
    const ref = doc(eventMatchesRef)
    batch.set(ref, {
      id: ref.id,
      eventId,
      round,
      courtIndex: m.courtIndex,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: null,
      scoreB: null,
      winner: null,
      status: 'scheduled',
    } as unknown as EventMatch)
  })
  batch.update(doc(db, 'events', eventId), { currentRound: round, status: 'live' })
  await batch.commit()
  return { round, courts: matches.length }
}

function shuffle<T>(arr: T[]): T[] {
  const r = [...arr]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

/** Round 1 is dynamic: as players check in, seat each full group of 4 onto the
 * next free court immediately (no waiting for everyone). Does nothing once the
 * event is past round 1 or all courts are already filled. Idempotent. */
export async function seatRound1Arrivals(eventId: string): Promise<number> {
  const event = await getEvent(eventId)
  if (!event || event.currentRound > 1) return 0

  const existing = await listEventMatches(eventId)
  const round1 = existing.filter((m) => m.round === 1)
  if (round1.length >= event.courtCount) return 0

  const checkedIn = await listCheckedInIds(eventId)
  const assigned = new Set(round1.flatMap((m) => [...m.teamA, ...m.teamB]))
  const unassigned = shuffle(
    event.participants.map((p) => p.id).filter((id) => checkedIn.has(id) && !assigned.has(id)),
  )

  let free = event.courtCount - round1.length
  let courtIndex = round1.length
  let created = 0
  const batch = writeBatch(db)
  while (free > 0 && unassigned.length >= 4) {
    const four = unassigned.splice(0, 4)
    const ref = doc(eventMatchesRef)
    batch.set(ref, {
      id: ref.id,
      eventId,
      round: 1,
      courtIndex,
      teamA: [four[0], four[1]],
      teamB: [four[2], four[3]],
      scoreA: null,
      scoreB: null,
      winner: null,
      status: 'scheduled',
    } as unknown as EventMatch)
    courtIndex++
    free--
    created++
  }
  if (created === 0) return 0
  if (event.currentRound === 0) {
    batch.update(doc(db, 'events', eventId), { currentRound: 1, status: 'live' })
  }
  await batch.commit()
  return created
}

/** Continuous play: fill every currently-free court with the next waiting
 * players — no waiting for a whole "round" to finish. A court is free when it
 * has no in-progress (scheduled) match. Players are seated fewest-games-first
 * so whoever has sat out longest goes on next, and teams avoid recent partners.
 * Admin-only (creates matches). Idempotent: returns 0 when nothing to seat.
 * Replaces both seatRound1Arrivals and generateNextRound for the live flow. */
export async function seatFreeCourts(eventId: string): Promise<number> {
  const event = await getEvent(eventId)
  if (!event || event.status === 'completed') return 0

  const existing = await listEventMatches(eventId)
  const active = existing.filter((m) => m.status === 'scheduled')
  const occupied = new Set(active.map((m) => m.courtIndex))
  const freeCourts: number[] = []
  for (let c = 0; c < event.courtCount; c++) if (!occupied.has(c)) freeCourts.push(c)
  if (freeCourts.length === 0) return 0

  const checkedIn = await listCheckedInIds(eventId)
  const busy = new Set(active.flatMap((m) => [...m.teamA, ...m.teamB]))
  const available = event.participants.map((p) => p.id).filter((id) => checkedIn.has(id) && !busy.has(id))
  if (available.length < 4) return 0

  // Games played across every match (completed + in-progress) drives fairness;
  // fewest first. Track partnerships so pairings stay varied.
  const games: Record<string, number> = {}
  const partnered = new Set<string>()
  for (const m of existing) {
    for (const id of [...m.teamA, ...m.teamB]) games[id] = (games[id] ?? 0) + 1
    if (m.teamA.length === 2) partnered.add(pairKey(m.teamA[0], m.teamA[1]))
    if (m.teamB.length === 2) partnered.add(pairKey(m.teamB[0], m.teamB[1]))
  }
  const queue = shuffle(available).sort((a, b) => (games[a] ?? 0) - (games[b] ?? 0))

  // Each seating wave bumps the round counter (used loosely for ordering/history).
  const round = event.currentRound + 1
  const batch = writeBatch(db)
  let created = 0
  for (const courtIndex of freeCourts) {
    if (queue.length < 4) break
    const four = queue.splice(0, 4)
    const { teamA, teamB } = bestPairing(four, partnered)
    // Reserve these partnerships so two courts seated in the same wave differ.
    partnered.add(pairKey(teamA[0], teamA[1]))
    partnered.add(pairKey(teamB[0], teamB[1]))
    const ref = doc(eventMatchesRef)
    batch.set(ref, {
      id: ref.id,
      eventId,
      round,
      courtIndex,
      teamA,
      teamB,
      scoreA: null,
      scoreB: null,
      winner: null,
      status: 'scheduled',
    } as unknown as EventMatch)
    created++
  }
  if (created === 0) return 0
  batch.update(doc(db, 'events', eventId), { currentRound: round, status: 'live' })
  await batch.commit()
  return created
}

export async function recordEventScore(
  match: EventMatch,
  scoreA: number,
  scoreB: number,
  pointsTarget: number,
  winBy: number,
) {
  const winner = validatePickleballScore(scoreA, scoreB, pointsTarget, winBy)
  await updateDoc(doc(db, 'eventMatches', match.id), { scoreA, scoreB, winner, status: 'completed' })
}

/** Reopen a completed match for correction. */
export async function clearEventScore(matchId: string) {
  await updateDoc(doc(db, 'eventMatches', matchId), {
    scoreA: null,
    scoreB: null,
    winner: null,
    status: 'scheduled',
  })
}

export async function setEventStatus(eventId: string, status: PickleEvent['status']) {
  await updateDoc(doc(db, 'events', eventId), { status })
}

/** Deletes the latest round's matches and steps the round counter back. */
export async function undoLastRound(eventId: string) {
  const event = await getEvent(eventId)
  if (!event || event.currentRound === 0) return
  const matches = await listEventMatches(eventId)
  const last = matches.filter((m) => m.round === event.currentRound)
  const batch = writeBatch(db)
  last.forEach((m) => batch.delete(doc(db, 'eventMatches', m.id)))
  batch.update(doc(db, 'events', eventId), { currentRound: event.currentRound - 1 })
  await batch.commit()
}

export async function deleteEvent(eventId: string): Promise<number> {
  const matches = await listEventMatches(eventId)
  const batch = writeBatch(db)
  matches.forEach((m) => batch.delete(doc(db, 'eventMatches', m.id)))
  batch.delete(doc(db, 'events', eventId))
  await batch.commit()
  return matches.length
}
