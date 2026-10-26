import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FirebaseSetupNotice } from './components/FirebaseSetupNotice'
import { isFirebaseConfigured } from './lib/firebase'

// Build/runtime diagnostic — confirms whether the loaded build received its
// Firebase config. Visible in the browser console on every load.
console.log(
  `%c[Dink Tank] build 2026-10-25b · Firebase configured: ${isFirebaseConfigured}`,
  'color:#16a34a;font-weight:bold',
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{isFirebaseConfigured ? <App /> : <FirebaseSetupNotice />}</ErrorBoundary>
  </StrictMode>,
)
