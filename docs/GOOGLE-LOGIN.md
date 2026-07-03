# Enabling Google sign-in

Google login powers **cloud saves**: a citizen links their Google account in the
Profile panel, their save backs up automatically, and they can continue the same
life on any device via "Continue with Google" on the welcome screen.

The code ships fully working but stays dormant until the deployment provides a
Google OAuth client id. One-time setup (~5 minutes):

## 1. Create the OAuth client

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create (or pick) a project
2. **APIs & Services → OAuth consent screen** — External, app name "Reality", add your email
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `https://reality-gamma.vercel.app` (and any custom domain later)
     - `http://localhost:5173` and `http://localhost:5199` (local dev)
   - No redirect URIs needed (Google Identity Services uses the origin)
4. Copy the client id (`xxxxx.apps.googleusercontent.com`)

## 2. Configure the deployment

```bash
# same value for both — the client renders the button, the server verifies tokens
vercel env add VITE_GOOGLE_CLIENT_ID   # paste client id, select all environments
vercel env add GOOGLE_CLIENT_ID        # paste client id, select all environments
vercel deploy --prod
```

For local dev, add to `.env.local` (gitignored): `VITE_GOOGLE_CLIENT_ID=...`

## How it works

- Client: Google Identity Services button → returns a signed ID token (JWT)
- `/api/auth-google` verifies the token against `GOOGLE_CLIENT_ID` via Google's
  tokeninfo endpoint, then either **links** the account to the calling citizen
  (`accounts/{sub}.json`) or **restores** the linked citizen's save (`saves/{citizenId}.json`)
- `/api/cloud-save` uploads the citizen's save every 2 minutes (citizen-token auth)
- No passwords, no sessions, nothing stored beyond the account↔citizen link and the save
