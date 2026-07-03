/** Google Identity Services loader. Enabled when the deployment sets VITE_GOOGLE_CLIENT_ID. */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

interface GsiApi {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void
      renderButton: (el: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}

declare global {
  interface Window {
    google?: GsiApi
  }
}

let gisLoading: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  if (gisLoading) return gisLoading
  gisLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google sign-in.'))
    document.head.appendChild(script)
  })
  return gisLoading
}

/** Render the official Google button into `el`; resolves credentials via callback */
export async function mountGoogleButton(el: HTMLElement, onCredential: (credential: string) => void): Promise<void> {
  if (!GOOGLE_CLIENT_ID) return
  await loadGis()
  const gsi = window.google
  if (!gsi) return
  gsi.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => onCredential(r.credential) })
  gsi.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 280 })
}
