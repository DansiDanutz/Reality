import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installErrorReporter } from './lib/errorReporter'
import FunnelDashboard from './components/panels/FunnelDashboard'
import './styles/tokens.css'
import './styles/global.css'

// The funnel dashboard is a quiet, separate page (?funnel) — not part of the
// game shell. Branch before React mounts so App never runs its hooks here.
const isFunnel = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('funnel')

// Beta telemetry: report uncaught errors (throttled, anonymous) so broken
// sessions in the wild are visible — installed before React mounts so even
// mount crashes get reported.
installErrorReporter()

// Service worker: required for notifications on Android (page-created
// Notification() throws there) and for notification-tap to refocus the game.
// No caching — the app is always served fresh. Registration failure is fine;
// desktop notifications fall back to the page API.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isFunnel ? <FunnelDashboard /> : <App />}</StrictMode>,
)
