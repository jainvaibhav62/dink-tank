import {
  addDoc,
  collection,
  deleteDoc,
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
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { converter } from './firestore'
import type { Tournament, TournamentStatus, TournamentType } from '../types'
import { listMatchesForTournament } from './fixtures'
import { computeTournamentLeaderboard } from './leaderboard'
import { listRegistrationsForTournament } from './registrations'

const tournamentsRef = collection(db, 'tournaments').withConverter(converter<Tournament>())

export interface CreateTournamentInput {
  name: string
  date: Date
  type: TournamentType
  maxPlayers: number
  pointsTarget: number
  winBy: number
  locationId: string
  courtIds: string[]
  createdBy: string
  registrationOpensAt: Date
  registrationClosesAt: Date
}

export type RegistrationPhase = 'not_open' | 'open' | 'closed'

export function getRegistrationPhase(tournament: Tournament, now = new Date()): RegistrationPhase {
  if (!tournament.registrationOpensAt || !tournament.registrationClosesAt) return 'open'
  if (now < tournament.registrationOpensAt.toDate()) return 'not_open'
  if (now > tournament.registrationClosesAt.toDate()) return 'closed'
  return 'open'
}

export async function listTournaments(): Promise<Tournament[]> {
  const snapshot = await getDocs(query(tournamentsRef, orderBy('date', 'desc')))
  return snapshot.docs.map((d) => d.data())
}

/** Live subscription to all tournaments, newest first. Returns an unsubscribe fn. */
export function subscribeToTournaments(cb: (tournaments: Tournament[]) => void) {
  return onSnapshot(query(tournamentsRef, orderBy('date', 'desc')), (snap) => {
    cb(snap.docs.map((d) => d.data()))
  })
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const snapshot = await getDoc(doc(db, 'tournaments', id).withConverter(converter<Tournament>()))
  return snapshot.exists() ? snapshot.data() : null
}

/** Live subscription to a single tournament. Fires with null if it's deleted. */
export function subscribeToTournament(id: string, cb: (tournament: Tournament | null) => void) {
  return onSnapshot(doc(db, 'tournaments', id).withConverter(converter<Tournament>()), (snap) => {
    cb(snap.exists() ? snap.data() : null)
  })
}

export async function createTournament(input: CreateTournamentInput) {
  await addDoc(tournamentsRef, {
    id: '',
    name: input.name,
    date: Timestamp.fromDate(input.date),
    type: input.type,
    maxPlayers: input.maxPlayers,
    pointsTarget: input.pointsTarget,
    winBy: input.winBy,
    locationId: input.locationId,
    courtIds: input.courtIds,
    status: 'registration_open',
    registrationOpensAt: Timestamp.fromDate(input.registrationOpensAt),
    registrationClosesAt: Timestamp.fromDate(input.registrationClosesAt),
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
  } as unknown as Tournament)
}

export async function setTournamentStatus(id: string, status: TournamentStatus) {
  const updates: Record<string, unknown> = { status }

  // When marking as completed, compute and set the champion from the standings.
  if (status === 'completed') {
    const [matches, registrations] = await Promise.all([
      listMatchesForTournament(id),
      listRegistrationsForTournament(id),
    ])

    const confirmedPlayerIds = registrations
      .filter((r) => r.status === 'confirmed')
      .map((r) => r.userId)

    if (confirmedPlayerIds.length > 0 && matches.length > 0) {
      const leaderboard = computeTournamentLeaderboard(confirmedPlayerIds, matches)
      if (leaderboard.length > 0) {
        updates.champion = leaderboard[0].userId
        if (leaderboard.length > 1) updates.runnerUp = leaderboard[1].userId
      }
    }
  }

  await updateDoc(doc(db, 'tournaments', id), updates)
}

/** Delete a tournament and all its associated registrations and matches.
 * Returns { deletedRegistrations, deletedMatches } for confirmation display. */
export async function deleteTournament(
  id: string,
): Promise<{ deletedRegistrations: number; deletedMatches: number }> {
  const registrations = await getDocs(
    query(collection(db, 'registrations'), where('tournamentId', '==', id)),
  )
  const matches = await getDocs(query(collection(db, 'matches'), where('tournamentId', '==', id)))

  const regCount = registrations.size
  const matchCount = matches.size

  await Promise.all([
    ...registrations.docs.map((d) => deleteDoc(d.ref)),
    ...matches.docs.map((d) => deleteDoc(d.ref)),
  ])
  await deleteDoc(doc(db, 'tournaments', id))

  return { deletedRegistrations: regCount, deletedMatches: matchCount }
}
