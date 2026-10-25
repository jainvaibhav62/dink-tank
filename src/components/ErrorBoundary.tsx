import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Top-level safety net: if a render throws, show a recovery screen instead of a
 * blank white page. Production hygiene for an app serving a whole club. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
          <div className="max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 text-4xl">🥒</div>
            <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">
              That didn't go to plan
            </h1>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              Something broke while loading this page. Reloading usually sorts it out.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
