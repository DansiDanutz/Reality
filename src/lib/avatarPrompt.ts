/**
 * Avatar Creator — players describe themselves (base, age, height, weight,
 * hair, eyes) and AI renders their personal avatar in the game's style.
 */

export const HAIR_COLORS = ['black', 'dark brown', 'light brown', 'blonde', 'red', 'gray', 'white'] as const
export const HAIR_STYLES = ['short', 'medium-length', 'long', 'curly', 'wavy', 'buzz-cut', 'bald', 'ponytail'] as const
export const EYE_COLORS = ['brown', 'hazel', 'green', 'blue', 'gray'] as const

export interface AvatarParams {
  gender: 'male' | 'female'
  age: number
  heightCm: number
  weightKg: number
  hairColor: (typeof HAIR_COLORS)[number]
  hairStyle: (typeof HAIR_STYLES)[number]
  eyeColor: (typeof EYE_COLORS)[number]
}

export const AVATAR_LIMITS = {
  age: { min: 18, max: 90 },
  heightCm: { min: 140, max: 215 },
  weightKg: { min: 40, max: 200 },
}

export function validateAvatarParams(p: unknown): p is AvatarParams {
  if (!p || typeof p !== 'object') return false
  const a = p as Record<string, unknown>
  return (
    (a.gender === 'male' || a.gender === 'female') &&
    typeof a.age === 'number' && a.age >= AVATAR_LIMITS.age.min && a.age <= AVATAR_LIMITS.age.max &&
    typeof a.heightCm === 'number' && a.heightCm >= AVATAR_LIMITS.heightCm.min && a.heightCm <= AVATAR_LIMITS.heightCm.max &&
    typeof a.weightKg === 'number' && a.weightKg >= AVATAR_LIMITS.weightKg.min && a.weightKg <= AVATAR_LIMITS.weightKg.max &&
    HAIR_COLORS.includes(a.hairColor as (typeof HAIR_COLORS)[number]) &&
    HAIR_STYLES.includes(a.hairStyle as (typeof HAIR_STYLES)[number]) &&
    EYE_COLORS.includes(a.eyeColor as (typeof EYE_COLORS)[number])
  )
}

/** Body build in plain words, derived from BMI — the AI reads words, not numbers */
export function buildWord(heightCm: number, weightKg: number): string {
  const bmi = weightKg / Math.pow(heightCm / 100, 2)
  if (bmi < 18.5) return 'slim'
  if (bmi < 23) return 'lean'
  if (bmi < 27) return 'average'
  if (bmi < 32) return 'sturdy'
  return 'heavyset'
}

export function heightWord(heightCm: number): string {
  if (heightCm < 160) return 'short'
  if (heightCm < 178) return 'of average height'
  if (heightCm < 190) return 'tall'
  return 'very tall'
}

/**
 * The house art direction — every citizen's avatar comes out in ONE consistent
 * look: a polished Pixar/Disney-style stylized 3D character in the game's
 * signature navy-blue + orange outfit. The player's own description (age,
 * gender, build, hair, eyes) rides on top so it's still them, in our world.
 */
export function buildAvatarPrompt(p: AvatarParams): string {
  const person = p.gender === 'male' ? 'man' : 'woman'
  const hair = p.hairStyle === 'bald' ? 'a shaved bald head' : `${p.hairStyle} ${p.hairColor} hair`
  return (
    `Stylized 3D animated character portrait in the polished look of a modern Pixar / Disney feature film. ` +
    `The character is a ${p.age}-year-old ${person}, ${heightWord(p.heightCm)} (about ${p.heightCm} cm) ` +
    `with a ${buildWord(p.heightCm, p.weightKg)} build (about ${p.weightKg} kg), ${hair}, large expressive ${p.eyeColor} eyes, ` +
    `and a warm, confident, friendly half-smile. ` +
    `Wearing a navy-blue athletic adventure outfit with bright orange accent trim — the game's signature style. ` +
    `Head and shoulders, facing the camera. Soft rounded stylized features, smooth clean subsurface shading, ` +
    `cinematic soft key light with a warm amber rim light, deep navy studio background. ` +
    `Appealing high-quality character design, vibrant, clean. No text, no logos, no watermark.`
  )
}
