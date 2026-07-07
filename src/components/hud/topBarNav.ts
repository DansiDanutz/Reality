import type { PanelId } from '../../store/gameStore'

export type TopBarNavPanelId = Exclude<
  PanelId,
  null | 'home' | 'business' | 'health' | 'cook' | 'journal' | 'boxes'
>

export interface TopBarNavItem {
  id: TopBarNavPanelId
  label: string
  title?: string
  badge?: boolean
}

export const TOPBAR_NAV_ITEMS: readonly TopBarNavItem[] = [
  { id: 'shop', label: 'Shop' },
  { id: 'work', label: 'Work' },
  { id: 'assets', label: 'Assets' },
  { id: 'construction', label: 'Build' },
  { id: 'founder', label: 'Area' },
  { id: 'operator', label: 'Ops' },
  { id: 'top', label: 'Top' },
  { id: 'achievements', label: '🏆', title: 'Achievements', badge: true },
  { id: 'profile', label: 'Profile' },
]

export function topBarNavPanelIds(): TopBarNavPanelId[] {
  return TOPBAR_NAV_ITEMS.map((item) => item.id)
}
