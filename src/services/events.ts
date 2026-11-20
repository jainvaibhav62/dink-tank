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
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { converter } from './firestore'
import { initialsOf } from '../data/roster'
import { buildNextRound } from './eventSchedule'
import { validatePickleballScore } from './fixtures'
import type { EventMatch, EventParticipant, PickleEvent } from '../types'

const eventsRef = collection(db, 'events').withConverter(converter<PickleEvent>())
const eventMatchesRef = collection(db, 'eventMatches').withConverter(converter<EventMatch>())

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

  const ids = event.participants.map((p) => p.id)
  const { matches } = buildNextRound(ids, event.courtCount, existing)
  if (matches.length === 0) throw new Error('Not enough players to form a court.')

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
