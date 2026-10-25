import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FirebaseSetupNotice } from './components/FirebaseSetupNotice'
import { isFirebaseConfigured } from './lib/firebase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{isFirebaseConfigured ? <App /> : <FirebaseSetupNotice />}</ErrorBoundary>
  </StrictMode>,
)
