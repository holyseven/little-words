import data from './curriculum.json'

export interface CourseAsset {
  id: string
  unitId: string | null
  kind: 'animation' | 'vocabulary-audio' | 'lesson-audio' | 'appendix-audio' | 'compilation-audio'
  title: string
  titleEn: string
  originalTitle: string
  pageLabel?: string
  file: string
  duration: number
  bytes: number
  sha256: string
  poster?: string
}
export interface CourseUnit { id: string; number: number; title: string; zh: string; emoji: string; assets: string[] }
export const courseUnits = data.units as CourseUnit[]
export const courseAssets = data.assets as CourseAsset[]
const byId = new Map(courseAssets.map((asset) => [asset.id, asset]))
export const getCourseAsset = (id: string | undefined) => id ? byId.get(id) : undefined
export const getCourseUnit = (id: string | undefined) => courseUnits.find((u) => u.id === id)
export const unitAssets = (id: string) => courseAssets.filter((asset) => asset.unitId === id)
export const courseURL = (file: string) => `${import.meta.env.BASE_URL}${file}`
export function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
