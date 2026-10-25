import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 text-4xl">🥒</div>
      <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">Out of bounds</h1>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        That page doesn't exist — looks like the ball went long.
      </p>
      <Link
        to="/"
        className="inline-block rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
      >
        Back to home
      </Link>
    </div>
  )
}
