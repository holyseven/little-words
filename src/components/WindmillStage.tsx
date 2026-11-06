import { useEffect, useId, useRef, useState } from 'react'
import { Stage } from '../vendor/stageshow/stage'
import type { Act } from '../vendor/stageshow/act'
import { stepWindmill } from '../logic/windmillMotion'
import { bladeLessonAngle, bladeLessonPose, PAPER_ROTOR, SELECTED_BLADE } from '../logic/windmillGeometry'
import { BladeForceDiagram } from './BladeForceDiagram'
import type { BladeFrameRenderer } from './BladeForceDiagram'
import './WindmillStage.css'

export interface WindmillStageProps {
  chapter: number
  running: boolean
  wind: 0 | 1 | 2
  experiment?: boolean
  elapsedMs?: number
  clockRef?: { current: number }
}

const scene = {}
const observe = async (act: Act<Record<string, never>>) => { act.mark('observe') }

const art = `${import.meta.env.BASE_URL}images/windmill/`

// Fixed landing positions for wind normal to the rotor's front face.
// These are airflow markers, not force vectors or orbiting particles.
const frontAirTargets = [
  [-102, -83], [-53, -132], [25, -145], [91, -91], [135, -31],
  [112, 55], [54, 121], [-20, 139], [-96, 83], [-139, 12],
  [-56, -38], [28, -69], [65, 22], [-19, 62], [-83, 25],
] as const

/** The paper rotor is an ImageGen asset; its real pin is aligned to the pivot. */
function PaperWheel({ rotorRef, pinId, focus = false }: { rotorRef: React.RefObject<SVGGElement>; pinId: string; focus?: boolean }) {
  return <g>
    <g ref={rotorRef} data-part="rotor" transform="rotate(-12)">
      <image href={`${art}paper-pinwheel-v2.png`} {...PAPER_ROTOR.bounds} />
      <g opacity={focus ? 1 : 0} data-part="selected-blade">
        <circle cx={SELECTED_BLADE.x} cy={SELECTED_BLADE.y} r="7" fill="#fff8df" stroke="#bb914c" strokeWidth="2.2" />
      </g>
    </g>
    <circle r="9.4" fill={`url(#${pinId})`} stroke="#f5d58c" strokeWidth="1.3" />
    <circle cx="-2.6" cy="-3.2" r="2.2" fill="#fff0ba" opacity=".65" />
  </g>
}

function AirStream({ particlesRef, trailsRef, arrowId }: {
  particlesRef: React.RefObject<SVGGElement>
  trailsRef: React.RefObject<SVGGElement>
  arrowId: string
}) {
  const paths = ['M28 194C187 160 331 183 506 215', 'M13 260C175 223 323 241 498 269', 'M18 326C176 289 314 301 489 323']
  return <g className="windmill-drawing__air" aria-hidden="true">
    <g fill="none" stroke="#7eb5bf" strokeWidth="1.3" opacity=".2">{paths.map(d => <path d={d} key={d} />)}</g>
    <g ref={trailsRef} fill="none" stroke={`url(#${arrowId}-ribbon)`} strokeWidth="3.2" strokeLinecap="round">
      {paths.map((d, i) => <path key={d} d={d} strokeDasharray={`${82 + i * 20} ${155 + i * 17}`} />)}
    </g>
    <g ref={particlesRef} fill="#82b7bf">{Array.from({ length: 15 }, (_, i) => <circle key={i} data-air={i} r={i % 3 === 0 ? 3.1 : 2} />)}</g>
    <path d="M103 247Q271 217 428 250" fill="none" stroke="#6eacb9" opacity=".65" strokeWidth="3" strokeLinecap="round" markerEnd={`url(#${arrowId})`} />
  </g>
}

function WindmillDrawing({ chapter, running, wind, experiment = false, elapsedMs = 0, clockRef, compact }: WindmillStageProps & { compact: boolean }) {
  const id = useId().replace(/:/g, '')
  const root = useRef<HTMLDivElement>(null)
  const rotor = useRef<SVGGElement>(null)
  const detailRenderer = useRef<BladeFrameRenderer | null>(null)
  const timeline = useRef({ elapsedMs, clockRef })
  timeline.current = { elapsedMs, clockRef }
  const particles = useRef<SVGGElement>(null)
  const trails = useRef<SVGGElement>(null)
  const frontAir = useRef<SVGGElement>(null)
  const foliage = useRef<SVGGElement>(null)
  const scenery = useRef<SVGGElement>(null)
  const atmosphere = useRef<SVGGElement>(null)
  const environment = useRef({ time: 0, strength: 0 })
  const model = useRef({ angle: 348, speed: 0 })
  const lessonEntry = useRef({ active: false, angle: 348, elapsed: 0 })
  const flow = useRef(0)
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    // Seeking to the coast-down chapter opens on an already-spinning wheel,
    // the initial condition being explained; experiments never add this energy.
    if (chapter === 3 && !experiment && model.current.speed === 0) model.current.speed = 100
  }, [chapter])
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    if (!root.current) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    let frame = 0
    let previous: number | null = null
    let live = true
    const paint = () => {
      const elapsed = reduced ? 14_000 : timeline.current.clockRef?.current ?? timeline.current.elapsedMs
      if (chapter === 1 && !experiment) {
        if (!lessonEntry.current.active || elapsed < lessonEntry.current.elapsed - 120) {
          lessonEntry.current = { active: true, angle: model.current.angle, elapsed }
        }
        model.current.angle = reduced ? bladeLessonAngle(elapsed) : bladeLessonPose(elapsed, lessonEntry.current.angle)
        lessonEntry.current.elapsed = elapsed
      } else lessonEntry.current.active = false
      rotor.current?.setAttribute('transform', `rotate(${model.current.angle})`)
      detailRenderer.current?.({ angle: model.current.angle, elapsedMs: elapsed })
      const { time, strength } = environment.current
      foliage.current?.setAttribute('transform', `rotate(${Math.sin(time * 1.35) * strength * 1.1} 85 215)`)
      scenery.current?.setAttribute('transform', `translate(${Math.sin(time / 9) * 2.5} ${Math.cos(time / 13) * .8})`)
      atmosphere.current?.setAttribute('transform', `translate(${Math.sin(time / 11) * 8} 0)`)
      trails.current?.querySelectorAll('path').forEach((path, i) => path.setAttribute('stroke-dashoffset', String(-flow.current * (610 + i * 55) + i * 83)))
      frontAir.current?.querySelectorAll('circle').forEach((dot, i) => {
        const p = (flow.current + i * .173) % 1
        const [x, y] = frontAirTargets[i]
        const depth = 1.65 - .65 * p
        dot.setAttribute('cx', String(x * depth))
        dot.setAttribute('cy', String(y * depth))
        dot.setAttribute('r', String(5.2 - p * 3.5))
        dot.setAttribute('opacity', String(Math.sin(p * Math.PI) * .8))
      })
      particles.current?.querySelectorAll('circle').forEach((dot, i) => {
        const p = (flow.current + i * .173) % 1
        const lane = i % 3
        dot.setAttribute('cx', String(30 + p * 445))
        dot.setAttribute('cy', String(190 + lane * 62 + p * 23 - Math.sin(p * Math.PI) * 25))
        dot.setAttribute('opacity', String(Math.sin(p * Math.PI) * .8))
      })
    }
    paint()
    const tick = (now: number) => {
      if (!live) return
      const delta = previous === null ? 0 : Math.min(100, Math.max(0, now - previous))
      previous = now
      model.current = stepWindmill(model.current, wind, delta)
      environment.current.time += delta / 1000
      environment.current.strength += (wind - environment.current.strength) * (1 - Math.exp(-delta / 550))
      if (wind > 0) flow.current += delta / (wind === 1 ? 3800 : 2150)
      paint()
      if (running && !reduced && visible && (wind > 0 || model.current.speed > 0)) frame = requestAnimationFrame(tick)
    }
    if (running && !reduced && visible) frame = requestAnimationFrame(tick)
    return () => { live = false; cancelAnimationFrame(frame) }
  }, [running, wind, reduced, visible, chapter, experiment])

  useEffect(() => {
    root.current?.closest('.ss-stage')?.setAttribute('data-mark', experiment ? 'experiment' : ['air', 'blades', 'axis', 'slowdown', 'energy'][chapter])
  }, [chapter, experiment])

  const fold = chapter === 1
  const forceLesson = fold && !experiment
  const axis = chapter === 2
  const slowing = chapter === 3
  const energy = chapter === 4
  const weather = forceLesson
    ? reduced ? ['正面静态图', 'Front view · Still'] : ['正面 · 慢动作', 'Front · Slow motion']
    : wind === 0 ? ['风停了', 'No wind'] : wind === 1 ? ['一阵微风', 'A gentle breeze'] : ['风大了一点', 'A stronger breeze']
  return <div ref={root} className={`windmill-drawing${compact ? ' windmill-drawing--compact' : ''}${running ? ' is-running' : ''}${reduced ? ' is-reduced' : ''}${experiment ? ' is-experiment' : ''}`} data-chapter={chapter} data-wind={wind}>
    <div className="windmill-drawing__weather" aria-hidden="true"><span className="windmill-drawing__weather-mark" /><span>{weather[0]}<small lang="en">{weather[1]}</small></span></div>
    <svg className="windmill-drawing__scene" viewBox={compact ? forceLesson ? '0 0 358 190' : '0 0 358 320' : '0 0 960 500'} role="img" aria-label="空气从正面吹向斜着折起的叶片，使风车绕中心轴转动。Air blowing onto the front pushes on tilted blades, making the wheel turn around its central pin.">
      <defs>
        <linearGradient id={`${id}-wood`} x2="1" y2="0"><stop stopColor="#8c694b" /><stop offset=".3" stopColor="#d2b182" /><stop offset=".55" stopColor="#e9c89a" /><stop offset="1" stopColor="#9e7956" /></linearGradient>
        <radialGradient id={`${id}-pin`} cx=".35" cy=".25"><stop stopColor="#fff0bc" /><stop offset=".45" stopColor="#dcba68" /><stop offset="1" stopColor="#91723c" /></radialGradient>
        <linearGradient id={`${id}-air-ribbon`}><stop stopColor="#7ebbc9" stopOpacity="0" /><stop offset=".35" stopColor="#78afbf" stopOpacity=".75" /><stop offset=".8" stopColor="#a5cfce" /><stop offset="1" stopColor="#7ebbc9" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}-veil`}><stop stopColor="#fbf5e9" stopOpacity=".9" /><stop offset=".38" stopColor="#fbf5e9" stopOpacity=".45" /><stop offset=".62" stopColor="#fbf5e9" stopOpacity="0" /></linearGradient>
        <filter id={`${id}-shadow`} x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="4" /></filter>
        <marker id={`${id}-air`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.6" markerHeight="3.6" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="#7daabc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></marker>
        <marker id={`${id}-turn`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1L9 5L1 9" fill="none" stroke="#a78b58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></marker>
      </defs>
      <g ref={scenery}>
        <image href={`${art}meadow-scene-v2.png`} x={-12} y={-8} width={compact ? 382 : 984} height={compact ? forceLesson ? 206 : 336 : 516} preserveAspectRatio="xMidYMid slice" />
      </g>
      {!compact && <rect width="960" height="500" fill={`url(#${id}-veil)`} />}
      <g ref={atmosphere} fill="#fffaf0" opacity=".28" transform="translate(0 0)">
        <ellipse cx={compact ? 77 : 511} cy={compact ? 60 : 76} rx={compact ? 53 : 111} ry={compact ? 9 : 13} />
        <ellipse cx={compact ? 110 : 746} cy={compact ? 46 : 40} rx={compact ? 29 : 62} ry={compact ? 7 : 10} />
      </g>
      <g transform={compact ? 'translate(-40 12) scale(.46)' : undefined} opacity={wind > 0 && chapter === 0 && !experiment ? 1 : 0} className="windmill-drawing__stream-layer">
        <g transform={compact ? "translate(0 70)" : "translate(0 145)"}><AirStream particlesRef={particles} trailsRef={trails} arrowId={`${id}-air`} /></g>
      </g>
      <g className="windmill-drawing__wheel" style={{ transform: compact ? forceLesson ? 'translate(260px, 100px) scale(.40)' : 'translate(214px, 160px) scale(.60)' : 'translate(651px, 247px)' }}>
        <ellipse cx="25" cy="219" rx="65" ry="8" fill="#584b37" opacity=".22" filter={`url(#${id}-shadow)`} />
        <path d="M3 4L39 11" stroke="#aa8b61" strokeWidth="10" strokeLinecap="round" />
        <path d="M7 6Q11 3 17 6L32 214Q28 222 21 215Z" fill={`url(#${id}-wood)`} />
        <path d="M12 18L26 210" stroke="#e9c99a" strokeOpacity=".55" strokeWidth="1.2" />
        <PaperWheel rotorRef={rotor} pinId={`${id}-pin`} />
        <g ref={frontAir} className="windmill-drawing__front-air" fill="#6baab8" opacity={!forceLesson && wind > 0 && (chapter !== 0 || experiment) ? 1 : 0} aria-hidden="true">
          {frontAirTargets.map(([x, y], i) => <circle key={i} data-front-air={i} cx={x * 1.3} cy={y * 1.3} r="3.2" opacity=".55" />)}
        </g>
        <g className="windmill-drawing__turn" data-direction="counterclockwise" opacity={fold || axis || energy ? 1 : 0}>
          <path d="M218 24A218 218 0 0 0 166-142" fill="none" stroke="#a78b58" strokeWidth="3" strokeDasharray="5 7" strokeLinecap="round" markerEnd={`url(#${id}-turn)`} />
        </g>
      </g>
      <path className="windmill-drawing__pin-leader" d={compact ? 'M214 160L251 255' : 'M651 247L522 170'} fill="none" stroke="#9e8759" strokeWidth="1" opacity={axis ? 1 : 0} />
      <g className="windmill-drawing__foreground" transform={compact ? forceLesson ? 'translate(-14 95)' : 'translate(-14 203)' : 'translate(-25 292)'} aria-hidden="true">
        <g ref={foliage}><image href={`${art}meadow-foreground-v2.png`} width={compact ? 270 : 430} height={compact ? 135 : 215} /></g>
      </g>
    </svg>
    <div className="windmill-drawing__lesson windmill-drawing__lesson--air" data-on={chapter === 0 || undefined} aria-hidden={chapter !== 0}>
      <span className="windmill-drawing__mini">先认识风 · Meet the wind</span>
      <strong>空气在移动，<br />风就来了。</strong><p lang="en">Moving air<br />{' '}is wind.</p>
      <span className="windmill-drawing__air-word">air <small>空气</small></span>
    </div>
    <div className="windmill-drawing__lesson windmill-drawing__lesson--fold" data-on={fold || undefined} aria-hidden={!fold}>
      <span className="windmill-drawing__mini">放大一片纸叶 · One blade, close up</span>
      <strong>风从正面吹来，<br />纸叶被推着转。</strong><p lang="en">Wind blows onto the front.<br />{' '}The blades get a turning push.</p>
      {forceLesson && <BladeForceDiagram rendererRef={detailRenderer} reducedMotion={reduced} />}
    </div>
    <div className="windmill-drawing__lesson windmill-drawing__lesson--axis" data-on={axis || undefined} aria-hidden={!axis}>
      <span className="windmill-drawing__mini">找到中心 · Find the center</span>
      <strong>轴托住风车，<br />叶片绕着它转。</strong><p lang="en">The pin holds it.<br />{' '}The blades turn around it.</p>
      <span className="windmill-drawing__air-word">pin <small>中心轴</small></span>
    </div>
    <div className="windmill-drawing__pin-label" data-on={axis || undefined} aria-hidden={!axis}><span>中心轴 <small lang="en">pin</small></span></div>
    <div className="windmill-drawing__lesson windmill-drawing__lesson--slow" data-on={slowing || undefined} aria-hidden={!slowing}>
      <span className="windmill-drawing__mini">仔细观察 · Watch closely</span>
      <strong>风不再推它，<br />摩擦让它慢下来。</strong><p lang="en">No more wind.<br />{' '}Friction slows it down.</p>
      <span className="windmill-drawing__air-word">friction <small>摩擦</small></span>
    </div>
    <div className="windmill-drawing__lesson windmill-drawing__lesson--energy" data-on={energy || undefined} aria-hidden={!energy}>
      <span className="windmill-drawing__mini">找到答案 · Now we know</span>
      <strong>风的能量，<br />变成了转动。</strong><p lang="en">Wind energy<br />{' '}becomes spinning motion.</p>
      <div className="windmill-drawing__energy-chain"><span>空气<small>air</small></span><i>→</i><span>叶片<small>blades</small></span><i>→</i><span>转动<small>spin</small></span></div>
    </div>
    <div className="windmill-drawing__front" style={{ opacity: wind > 0 ? 1 : 0 }} aria-hidden="true">风正对叶轮吹来<small lang="en">Wind blows onto the front of the wheel.</small></div>
    <div className="windmill-drawing__key" aria-hidden="true"><i />{chapter === 0 && !experiment ? '蓝点帮助我们“看见”空气' : '风正对叶轮吹来'} <span lang="en">{chapter === 0 && !experiment ? 'Blue dots show invisible air.' : 'Wind blows onto the front of the wheel.'}</span></div>
    {reduced && !forceLesson && <span className="windmill-drawing__reduced">静态观察模式 · Still mode</span>}
  </div>
}

/** The actual Stageshow Stage provides separate phone and wide compositions. */
export function WindmillStage(props: WindmillStageProps) {
  return <Stage width={960} height={500} compact={{ below: 600, width: 358, height: props.experiment ? 320 : props.chapter === 1 ? 590 : 510 }} initial={scene} poster={scene} script={observe} play="once" className="windmill-stage" fill>
    {(_state, _rect, layout) => <WindmillDrawing {...props} compact={layout === 'compact'} />}
  </Stage>
}
