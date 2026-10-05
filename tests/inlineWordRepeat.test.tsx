import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { InlineWordRepeat } from '../src/components/InlineWordRepeat'

describe('word and dialogue repeat controls', () => {
  it('keeps word prompts by default and lets a dialogue disable its sentence control', () => {
    const html = renderToStaticMarkup(<>
      <InlineWordRepeat word="cat" showZh onBeforeStart={() => {}} />
      <InlineWordRepeat word="This is my mum." practiceKind="sentence" showZh disabled hideIdleNotice onBeforeStart={() => {}} />
    </>)
    expect(html).toContain('跟读这个词')
    expect(html).toContain('跟读这句话')
    expect(html.match(/disabled=""/g)).toHaveLength(1)
    // Only the default word control shows the setup note in a combined view.
    expect(html.match(/默认使用在线发音评估/g)).toHaveLength(1)
  })

  it('gives each control its own live feedback target when embedded together', () => {
    const html = renderToStaticMarkup(<>
      <InlineWordRepeat word="cat" showZh onBeforeStart={() => {}} />
      <InlineWordRepeat word="It is a cat." practiceKind="sentence" showZh onBeforeStart={() => {}} />
    </>)
    const describedBy = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1])
    const liveRegions = [...html.matchAll(/id="([^"]+)" role="status"/g)].map((match) => match[1])
    expect(new Set(describedBy).size).toBe(2)
    expect(liveRegions).toEqual(describedBy)
  })
})
