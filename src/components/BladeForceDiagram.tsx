import { useLayoutEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { paintWindmillBladeDetail, detailDebug } from './paintWindmillBladeDetail'
import './BladeForceDiagram.css'

export interface BladeFrame { angle: number; elapsedMs: number }
export type BladeFrameRenderer = (frame: BladeFrame) => void
export interface BladeForceDiagramProps {
  rendererRef: MutableRefObject<BladeFrameRenderer | null>
  reducedMotion?: boolean
}

const ease = (time: number, start: number, duration: number) => {
  const p = Math.min(1, Math.max(0, (time - start) / duration))
  return p * p * (3 - 2 * p)
}

/** The original red paper, enlarged and viewed obliquely beside the front hero. */
export function BladeForceDiagram({ rendererRef, reducedMotion = false }: BladeForceDiagramProps) {
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const captions = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    let lastFrame: BladeFrame | null = null
    const texture = new Image()
    const paint: BladeFrameRenderer = frame => {
      lastFrame = frame
      const element = canvas.current
      if (!element) return
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.max(1, Math.round(element.clientWidth * pixelRatio))
      const height = Math.max(1, Math.round(element.clientHeight * pixelRatio))
      if (element.width !== width || element.height !== height) {
        element.width = width
        element.height = height
      }
      const context = element.getContext('2d')
      if (!context) return
      const time = reducedMotion ? 14_000 : frame.elapsedMs
      const currentFrame = { angle: frame.angle, elapsedMs: time }
      if (texture.complete && texture.naturalWidth) paintWindmillBladeDetail(context, width, height, currentFrame, texture)
      root.current?.setAttribute('data-force-time', String(Math.round(time)))
      root.current?.setAttribute('data-blade-angle', String(frame.angle))
      root.current?.setAttribute('data-scene', JSON.stringify(detailDebug(currentFrame)))
      const phase = time < 500 ? 'ready' : time < 2_700 ? 'air' : time < 4_000 ? 'push' : time < 14_000 ? 'turn' : 'hold'
      root.current?.setAttribute('data-force-phase', phase)
      root.current?.closest('.ss-stage')?.setAttribute('data-mark', `blade-detail-${phase}`)

      const first = 1 - ease(time, 3_800, 180)
      const second = ease(time, 4_000, 220)
      captions.current?.children[0]?.setAttribute('style', `opacity:${first}`)
      captions.current?.children[1]?.setAttribute('style', `opacity:${second}`)
      captions.current?.children[0]?.setAttribute('aria-hidden', String(first <= .5))
      captions.current?.children[1]?.setAttribute('aria-hidden', String(second <= .5))
    }
    texture.onload = () => { if (lastFrame) paint(lastFrame) }
    texture.src = `${import.meta.env.BASE_URL}images/windmill/paper-pinwheel-v2.png`
    rendererRef.current = paint
    const observer = new ResizeObserver(() => { if (lastFrame) paint(lastFrame) })
    if (canvas.current) observer.observe(canvas.current)
    return () => {
      observer.disconnect()
      texture.onload = null
      if (rendererRef.current === paint) rendererRef.current = null
    }
  }, [rendererRef, reducedMotion])

  return <div ref={root} className="blade-force" data-force-phase="ready" data-force-time="0" data-view="single-blade" data-texture="paper-pinwheel-v2.png">
    <span className="blade-force__view">45°斜视 · 同一片纸叶 <small lang="en">45° view · Same blade</small></span>
    <canvas ref={canvas} className="blade-force__drawing" width="780" height="456" role="img" aria-label="原风车红色纸叶的45度斜视放大图。蓝色箭头是沿轴吹向纸叶的来风和偏转后的空气，橙色直箭头标出让叶片转动的那部分推力。">
      同一片红纸叶的45度斜视：蓝色是来风和偏转，橙色直箭头是推着转的力。
      The same red blade at 45 degrees: blue shows airflow; the straight orange arrow shows the turning part of the push.
    </canvas>
    <div ref={captions} className="blade-force__caption">
      <div className="blade-force__caption-item"><span>风正对叶轮，和轴同方向。</span><small lang="en">Wind faces the wheel, parallel to the axle.</small></div>
      <div className="blade-force__caption-item" style={{ opacity: 0 }} aria-hidden="true"><span>纸叶让空气拐弯，风车绕轴转。</span><small lang="en">The blade turns air aside; the wheel spins.</small></div>
    </div>
  </div>
}
