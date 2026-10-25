import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** True only when the required Firebase env vars are present. When false we skip
 * `getAuth()` (which throws `auth/invalid-api-key` on an empty key and would
 * blank the whole page) and render a setup notice instead — see main.tsx. */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

export const app = initializeApp(firebaseConfig)
// `getAuth` validates the API key synchronously, so only call it once configured.
export const auth = isFirebaseConfigured ? getAuth(app) : (null as unknown as Auth)
// Several optional fields across the schema (address, champion, decidedAt, ...)
// are omitted via `undefined` rather than left out of the object entirely;
// Firestore rejects explicit `undefined` values unless this is set.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true })
export const functions = getFunctions(app)
export const googleProvider = new GoogleAuthProvider()
