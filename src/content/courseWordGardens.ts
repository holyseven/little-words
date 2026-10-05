import { getTheme } from './index'
import { getCourseUnit } from './curriculum'

/** 课本主题的入口映射；词表和课本原始媒体仍分别维护。 */
export const courseWordGardens = [
  { unitId: 'g1t1-u2', themeId: 'numbers' },
  { unitId: 'g1t1-u3', themeId: 'family' },
  { unitId: 'g1t1-u4', themeId: 'classroom' },
  { unitId: 'g1t1-u5', themeId: 'school-things' },
  { unitId: 'g1t1-u6', themeId: 'colors' },
].map(({ unitId, themeId }) => {
  const unit = getCourseUnit(unitId)
  const theme = getTheme(themeId)
  if (!unit || !theme) throw new Error(`Missing course word garden: ${unitId} / ${themeId}`)
  return { unit, theme }
})

export function courseWordGarden(unitId: string) {
  return courseWordGardens.find(({ unit }) => unit.id === unitId)
}
