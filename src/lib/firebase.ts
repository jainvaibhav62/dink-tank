import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

// Firebase *web* config is not secret — it ships in the client bundle of every
// Firebase app and is safe to commit. Real security comes from Firestore rules
// and the authorized-domains list, not from hiding these values. We read env
// vars when present (so forks can point at their own project) and fall back to
// this project's values so the build always works without CI secrets.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDXrN5vHLSOqmSJbKM2X11g3-qRqC1c4f4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'dink-tank-3c6d2.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dink-tank-3c6d2',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'dink-tank-3c6d2.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '80410398908',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:80410398908:web:20b2a7fbecad843ddd80b9',
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
