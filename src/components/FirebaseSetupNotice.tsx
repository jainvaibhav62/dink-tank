/** Shown when the VITE_FIREBASE_* env vars are missing, instead of letting
 * Firebase throw and blank the page. Purely informational — no Firebase calls. */
export function FirebaseSetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 text-4xl">🥒</div>
        <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
          Dink Tank needs a Firebase config
        </h1>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          The app loaded, but no Firebase credentials were found — so sign-in and the database
          can't work yet. Add them, then restart the dev server.
        </p>
        <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
          <li>
            Create a project at{' '}
            <a
              href="https://console.firebase.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-green-600 hover:underline dark:text-green-400"
            >
              console.firebase.google.com
            </a>{' '}
            → enable <strong>Authentication</strong> (Google + Email/Password) and{' '}
            <strong>Firestore</strong>.
          </li>
          <li>
            Project settings → Your apps → Web app → copy the <code>firebaseConfig</code> values.
          </li>
          <li>
            Copy <code>.env.example</code> to <code>.env</code> and fill in each{' '}
            <code>VITE_FIREBASE_*</code> value.
          </li>
          <li>
            Restart the dev server (<code>npm run dev</code>) — Vite only reads{' '}
            <code>.env</code> at startup.
          </li>
        </ol>
        <pre className="overflow-x-auto rounded-md bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
{`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...`}
        </pre>
      </div>
    </div>
  )
}
