import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportClientError } from '../lib/errorReporter'

interface Props {
  children: ReactNode
  /** What broke, for the player ("The map", "This panel"); the whole game when omitted. */
  area?: string
  /** Inline fallback for a contained area (a panel); the full-screen card otherwise. */
  inline?: boolean
}

interface State {
  error: Error | null
}

/**
 * Without a boundary, one render throw anywhere unmounted the whole tree to a
 * black starfield. The save lives in localStorage and the simulation runs on
 * real time, so nothing is lost by a reload — the fallback says exactly that.
 * Errors still reach the beta error reporter.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError(`${this.props.area ?? 'App'}: ${error.message}`, `${error.stack ?? ''}\n${info.componentStack ?? ''}`)
  }

  private retry = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    const area = this.props.area ?? 'Reality'
    if (this.props.inline) {
      return (
        <div className="error-fallback inline" role="alert">
          <p>{area} hit a problem. Your life and your save are safe.</p>
          <button type="button" className="btn small" onClick={this.retry}>Try again</button>
        </div>
      )
    }
    return (
      <div className="error-fallback" role="alert">
        <h1>{area} hit a problem</h1>
        <p>Your save is safe — it lives on this device, and your life kept running on real time.</p>
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    )
  }
}
