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

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isFunnel ? <FunnelDashboard /> : <App />}</StrictMode>,
)
