export function resolveAppearance(appearance: 'auto' | 'day' | 'night', systemDark: boolean, hour: number): 'day' | 'night' {
  return appearance === 'auto' ? (systemDark || hour >= 19 || hour < 7 ? 'night' : 'day') : appearance
}
