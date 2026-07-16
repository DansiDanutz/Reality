export interface ScrollWorldSection {
  id: string
  label: string
  still: string
  stillMobile?: string
  clip: string
  clipMobile?: string
  accent?: string
  eyebrow?: string
  title?: string
  body?: string
  tags?: string[]
  scroll?: number
  linger?: number
  cta?: { label: string; href?: string; onClick?: () => void }
}

export interface ScrollWorldConfig {
  brand: { name: string; href?: string }
  diveScroll?: number
  connScroll?: number
  hint?: string
  nav?: boolean
  atmosphere?: boolean
  sections: ScrollWorldSection[]
  connectors: Array<string | null>
  connectorsMobile?: Array<string | null>
}

export function mountScrollWorld(
  container: HTMLElement,
  config: ScrollWorldConfig,
): { destroy: () => void } | void
