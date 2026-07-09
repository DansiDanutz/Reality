/**
 * Beta error telemetry — the client half of api/client-error.ts. Reports
 * uncaught errors and unhandled rejections, fire-and-forget. Hard rules:
 * never throw, never report more than MAX_REPORTS_PER_SESSION, never send
 * anything about the player (no ids, no coordinates, only the route path).
 */

const MAX_REPORTS_PER_SESSION = 5

let reportsSent = 0
const seenSignatures = new Set<string>()

export function reportClientError(message: string, stack?: string): void {
  try {
    if (reportsSent >= MAX_REPORTS_PER_SESSION) return
    const signature = `${message}`.slice(0, 200)
    if (seenSignatures.has(signature)) return
    seenSignatures.add(signature)
    reportsSent += 1
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message: `${message}`.slice(0, 500),
        stack: stack ? `${stack}`.slice(0, 2000) : undefined,
        path: typeof window !== 'undefined' ? window.location.pathname : '',
      }),
    }).catch(() => {})
  } catch {
    // Telemetry must never break the game.
  }
}

/** Wire the global listeners once, at app boot. */
export function installErrorReporter(): void {
  window.addEventListener('error', (event) => {
    reportClientError(event.message || 'Unknown error', event.error?.stack)
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection')
    reportClientError(`Unhandled rejection: ${message}`, reason instanceof Error ? reason.stack : undefined)
  })
}

/** Test hook — resets the per-session throttle state. */
export function resetErrorReporterForTest(): void {
  reportsSent = 0
  seenSignatures.clear()
}
