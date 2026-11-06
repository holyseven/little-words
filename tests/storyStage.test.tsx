import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StoryStage, type StoryStageProps } from '../src/components/StoryStage'

const stories: StoryStageProps['storyId'][] = ['numbers', 'family', 'classroom', 'school-things', 'colors']

function render(storyId: StoryStageProps['storyId'], lineIndex: number, options: Partial<StoryStageProps> = {}) {
  return renderToStaticMarkup(<StoryStage storyId={storyId} lineIndex={lineIndex} speaking={false} running={false} label="Story" {...options} />)
}

describe('story stage poster and first frames', () => {
  it('keeps valid SVG geometry across every spoken line, its first frame, and the ending', () => {
    for (const story of stories) {
      const frames = [
        ...Array.from({ length: 9 }, (_, line) => render(story, line)),
        ...Array.from({ length: 9 }, (_, line) => render(story, line, { running: true, speaking: true })),
        render(story, 8, { complete: true }),
      ]
      for (const html of frames) {
        // Infinity is a clock sentinel, never a valid SVG coordinate. This catches
        // new action formulas accidentally applying arithmetic to that sentinel.
        expect(html, story).not.toMatch(/\b(?:NaN|Infinity|undefined)\b/)
        expect(html, story).toContain('role="img" aria-label="Story"')
        const viewBox = html.match(/viewBox="([^"]+)"/)![1].split(/\s+/).map(Number)
        expect(viewBox.every(Number.isFinite), story).toBe(true)
        expect(viewBox[2], story).toBeGreaterThan(0)
        expect(viewBox[3], story).toBeGreaterThan(0)
      }
    }
  })

  it('shows a yellow balloon in the yellow chapter, matching the spoken object', () => {
    const html = render('colors', 6)
    expect(html).toContain('黄气球')
    const balloon = html.slice(html.indexOf('data-prop="balloon-2"')).split('</g>')[0]
    expect(balloon).toContain('opacity="1"')
    // The same round balloon silhouette is used for red, blue and yellow.
    const body = 'M0-146Q-64-146-63-85Q-60-25 0-4Q60-25 63-85Q64-146 0-146Z'
    expect(html.split(body)).toHaveLength(4)
    const fill = balloon.match(new RegExp(`d="${body}" fill="#([a-fA-F0-9]{6})"`))![1]
    const [red, green, blue] = [0, 2, 4].map((offset) => parseInt(fill.slice(offset, offset + 2), 16))
    expect(red).toBeGreaterThan(blue)
    expect(green).toBeGreaterThan(blue)
    expect(html).not.toMatch(/story-stage__star|M0-81L24-30/)
  })

  it('respects the English-only setting in scene titles and learning words', () => {
    for (const story of stories) {
      const html = render(story, 6, { showZh: false })
      expect(html, story).not.toMatch(/[\u3400-\u9fff]/)
      expect(html, story).toContain('lang="en"')
    }
  })
})
