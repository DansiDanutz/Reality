import { useState } from 'react'
import {
  AVATAR_LIMITS,
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  type AvatarParams,
} from '../../lib/avatarPrompt'
import { useGame } from '../../store/gameStore'

const DEFAULTS: Record<'male' | 'female', AvatarParams> = {
  male: { gender: 'male', age: 30, heightCm: 180, weightKg: 78, hairColor: 'dark brown', hairStyle: 'short', eyeColor: 'brown' },
  female: { gender: 'female', age: 28, heightCm: 168, weightKg: 60, hairColor: 'dark brown', hairStyle: 'long', eyeColor: 'brown' },
}

/**
 * The Avatar Studio — describe yourself, AI paints you.
 * Male or female base, then age, height, weight, hair, and eyes.
 */
export default function AvatarStudio() {
  const citizen = useGame((s) => s.citizen)
  const generateAvatar = useGame((s) => s.generateAvatar)
  const [params, setParams] = useState<AvatarParams>(DEFAULTS.male)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!citizen) return null

  const upd = (patch: Partial<AvatarParams>) => setParams((p) => ({ ...p, ...patch }))
  const pickBase = (gender: 'male' | 'female') => setParams((p) => ({ ...DEFAULTS[gender], age: p.age }))

  return (
    <section className="studio">
      <div className="studio-head">
        <div className={`studio-preview${busy ? ' busy' : ''}`}>
          {citizen.avatarUrl ? (
            <img src={citizen.avatarUrl} alt="Your avatar" width={96} height={96} />
          ) : (
            <span className="studio-silhouette" aria-hidden>{params.gender === 'male' ? '♂' : '♀'}</span>
          )}
          {busy && <span className="studio-spinner" aria-hidden />}
        </div>
        <p className="panel-sub">
          {citizen.avatarUrl
            ? 'This is you. Adjust the details and regenerate anytime (5 portraits a day).'
            : 'Describe yourself and the studio paints your avatar. This face is you in Reality.'}
        </p>
      </div>

      <div className="studio-base" role="radiogroup" aria-label="Avatar base">
        <button className={params.gender === 'male' ? 'tab active' : 'tab'} onClick={() => pickBase('male')} aria-pressed={params.gender === 'male'}>
          ♂ Male
        </button>
        <button className={params.gender === 'female' ? 'tab active' : 'tab'} onClick={() => pickBase('female')} aria-pressed={params.gender === 'female'}>
          ♀ Female
        </button>
      </div>

      <div className="studio-grid">
        <label className="studio-field">
          <span className="stat-label">age · {params.age}</span>
          <input type="range" min={AVATAR_LIMITS.age.min} max={AVATAR_LIMITS.age.max} value={params.age}
            onChange={(e) => upd({ age: Number(e.target.value) })} />
        </label>
        <label className="studio-field">
          <span className="stat-label">height · {params.heightCm} cm</span>
          <input type="range" min={AVATAR_LIMITS.heightCm.min} max={AVATAR_LIMITS.heightCm.max} value={params.heightCm}
            onChange={(e) => upd({ heightCm: Number(e.target.value) })} />
        </label>
        <label className="studio-field">
          <span className="stat-label">weight · {params.weightKg} kg</span>
          <input type="range" min={AVATAR_LIMITS.weightKg.min} max={AVATAR_LIMITS.weightKg.max} value={params.weightKg}
            onChange={(e) => upd({ weightKg: Number(e.target.value) })} />
        </label>
        <label className="studio-field">
          <span className="stat-label">hair color</span>
          <select value={params.hairColor} onChange={(e) => upd({ hairColor: e.target.value as AvatarParams['hairColor'] })}>
            {HAIR_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="studio-field">
          <span className="stat-label">hair style</span>
          <select value={params.hairStyle} onChange={(e) => upd({ hairStyle: e.target.value as AvatarParams['hairStyle'] })}>
            {HAIR_STYLES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="studio-field">
          <span className="stat-label">eyes</span>
          <select value={params.eyeColor} onChange={(e) => upd({ eyeColor: e.target.value as AvatarParams['eyeColor'] })}>
            {EYE_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <button
        className="btn primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError('')
          const problem = await generateAvatar(params)
          if (problem) setError(problem)
          setBusy(false)
        }}
      >
        {busy ? 'Painting your portrait…' : citizen.avatarUrl ? 'Regenerate my avatar' : 'Create my avatar'}
      </button>
      {error && <p className="waitlist-error" role="alert">{error}</p>}
    </section>
  )
}
