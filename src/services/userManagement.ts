import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'

/** Client-side cascade delete of a user's data. Matches live in a top-level
 * `matches` collection keyed by `tournamentId`, so a couple of array-contains
 * queries cover every match the player appeared in. The Firebase Auth account
 * itself is removed separately (admin via the Console or the deleteUser function). */
export async function deleteUserDataDirectly(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid))
  await deleteDoc(doc(db, 'publicProfiles', uid))

  const registrationDocs = await getDocs(
    query(collection(db, 'registrations'), where('userId', '==', uid)),
  )
  await Promise.all(registrationDocs.docs.map((regDoc) => deleteDoc(regDoc.ref)))

  const matchesA = await getDocs(
    query(collection(db, 'matches'), where('teamA', 'array-contains', uid)),
  )
  const matchesB = await getDocs(
    query(collection(db, 'matches'), where('teamB', 'array-contains', uid)),
  )
  const matchRefs = new Set([...matchesA.docs, ...matchesB.docs].map((d) => d.ref))
  await Promise.all([...matchRefs].map((ref) => deleteDoc(ref)))
}
