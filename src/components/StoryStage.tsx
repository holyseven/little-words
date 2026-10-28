import { useEffect, useId, useState, type CSSProperties } from 'react'
import './StoryStage.css'

export interface StoryStageProps {
  storyId: 'family' | 'school-things' | 'colors' | 'numbers' | 'classroom'
  lineIndex: number
  speaking: boolean
  running: boolean
  complete?: boolean
  rate?: number
  label: string
}

type PersonKind = 'child' | 'mum' | 'dad' | 'grandma'

const ink = '#594840'

function Face({ talking, adult = false, glasses = false }: {
  talking: boolean
  adult?: boolean
  glasses?: boolean
}) {
  return (
    <g>
      <g className="story-stage__eyes">
        <ellipse cx="-13" cy="-3" rx="3.1" ry="4.1" fill={ink} />
        <ellipse cx="13" cy="-3" rx="3.1" ry="4.1" fill={ink} />
        <circle cx="-12" cy="-4.5" r=".9" fill="#fffaf0" />
        <circle cx="14" cy="-4.5" r=".9" fill="#fffaf0" />
      </g>
      {glasses && <g fill="none" stroke="#847267" strokeWidth="2.5">
        <circle cx="-13" cy="-3" r="10" />
        <circle cx="13" cy="-3" r="10" />
        <path d="M-3-3h6M-23-5l-8-3M23-5l8-3" />
      </g>}
      <ellipse cx="-24" cy="9" rx="7" ry="4" fill="#e6a18e" opacity=".6" />
      <ellipse cx="24" cy="9" rx="7" ry="4" fill="#e6a18e" opacity=".6" />
      {adult && <path d="M0 1l-2 8h4" stroke="#bd8a71" strokeWidth="1.6" fill="none" strokeLinecap="round" />}
      <g transform="translate(0 17)">
        {talking ? <g className="story-stage__mouth">
          <ellipse rx="7" ry="6" fill="#80564c" />
          <ellipse cy="3" rx="4" ry="2" fill="#dfa394" />
        </g> : <path d="M-7-1q7 8 14 0" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />}
      </g>
    </g>
  )
}

function Bear({ talking, wave = false, point = false }: {
  talking: boolean
  wave?: boolean
  point?: boolean
}) {
  return (
    <g className={`story-stage__bear${talking ? ' is-speaking' : ''}`}>
      <g className="story-stage__breathe">
        <ellipse cx="-27" cy="-4" rx="23" ry="12" fill="#bd8160" />
        <ellipse cx="27" cy="-4" rx="23" ry="12" fill="#bd8160" />
        <path d="M-46-109Q0-135 46-109L55-37Q50-10 0-11Q-50-10-55-37Z" fill="#d49d75" />
        <ellipse cy="-61" rx="33" ry="37" fill="#f1d3aa" />
        <g transform="translate(-44 -98)">
          <g className="story-stage__bear-left-arm">
            <path d="M0 0Q-26 4-25 39Q-23 56-10 51Q1 41 8 13" fill="#c78d66" />
          </g>
        </g>
        <g transform="translate(44 -99)">
          <g className={wave ? 'story-stage__wave-arm' : point ? 'story-stage__point-arm' : 'story-stage__bear-right-arm'}>
            <path d="M0 0Q24 2 24 35Q23 51 11 46Q-1 36-9 13" fill="#c78d66" />
            <ellipse cx="19" cy="33" rx="7" ry="8" fill="#e2b88e" opacity=".7" />
          </g>
        </g>
        <g className="story-stage__head" transform="translate(0 -165)">
          <circle cx="-42" cy="-35" r="21" fill="#c78d66" />
          <circle cx="42" cy="-35" r="21" fill="#c78d66" />
          <circle cx="-42" cy="-35" r="11" fill="#e8ba96" />
          <circle cx="42" cy="-35" r="11" fill="#e8ba96" />
          <path d="M-52-3Q-54-51 0-53Q54-51 52-3Q50 44 0 45Q-50 44-52-3" fill="#d49d75" />
          <ellipse cy="17" rx="31" ry="24" fill="#f6ddbc" />
          <g className="story-stage__eyes">
            <ellipse cx="-18" cy="-8" rx="4.3" ry="5.5" fill={ink} />
            <ellipse cx="18" cy="-8" rx="4.3" ry="5.5" fill={ink} />
            <circle cx="-16.5" cy="-10" r="1.4" fill="#fffdf7" />
            <circle cx="19.5" cy="-10" r="1.4" fill="#fffdf7" />
          </g>
          <ellipse cy="9" rx="8" ry="5.5" fill="#805d49" />
          <ellipse cx="-37" cy="13" rx="8" ry="5" fill="#d88777" opacity=".55" />
          <ellipse cx="37" cy="13" rx="8" ry="5" fill="#d88777" opacity=".55" />
          <g transform="translate(0 26)">
            {talking ? <g className="story-stage__mouth">
              <ellipse rx="10" ry="8" fill="#80564c" />
              <ellipse cy="4" rx="6" ry="3" fill="#dfa394" />
            </g> : <path d="M-10-4Q0 8 10-4" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />}
          </g>
        </g>
        <path d="M-29-119L0-106L29-119L26-101L0-89L-26-101Z" fill="#7a9f8c" />
        <path d="M-3-106l11 18 12-8-12-15" fill="#678d7a" />
      </g>
    </g>
  )
}

function Person({ kind, talking = false, wave = false, point = false, nod = false, look = 'gold', reach, seated = false }: {
  kind: PersonKind
  talking?: boolean
  wave?: boolean
  point?: boolean
  nod?: boolean
  look?: 'gold' | 'mint' | 'berry'
  reach?: 'left' | 'right'
  seated?: boolean
}) {
  const child = kind === 'child'
  const mum = kind === 'mum'
  const dad = kind === 'dad'
  const grandma = kind === 'grandma'
  const skin = grandma ? '#e7be9f' : '#f0c7a6'
  const shirt = child ? look === 'mint' ? '#8eaa9f' : look === 'berry' ? '#c29499' : '#d5a45f' : mum ? '#b5a1be' : dad ? '#7d9ba0' : '#abbaa0'
  const hair = grandma ? '#b9b6b0' : dad ? '#60524a' : '#5c453c'
  const headY = child ? -164 : -225
  const shoulderY = child ? -115 : -176
  return (
    <g className={`story-stage__person story-stage__person--${kind}${talking ? ' is-speaking' : ''}`}>
      <g className="story-stage__breathe">
        {child ? <>
          <path d={seated ? 'M-27-49L-37-31L-31-7H-14L-18-27L-3-39M4-48L32-39L33-7H16L14-26L-2-34' : 'M-27-49L-24-7H-7L-5-50M5-50L7-7H24L27-49'} fill="#7c8992" />
          <path d={seated ? 'M-32-12H-14L-13 0H-42Q-43-8-32-12M16-12H33Q45-8 44 0H15Z' : 'M-25-12H-7L-6 0H-35Q-36-8-25-12M7-12H24Q36-8 35 0H6Z'} fill="#826d5b" />
          <path d="M-34-108Q0-123 34-108L37-47Q0-35-37-47Z" fill={shirt} />
          <path d="M-11-117v12q11 12 22 0v-12" fill={skin} />
          <path d="M-15-109l15 15 15-15" stroke="#f0d6a5" strokeWidth="5" fill="none" />
          <rect x="12" y="-86" width="14" height="15" rx="3" fill="#f2d399" />
        </> : <>
          <path d="M-29-55L-25-8H-8L-3-58M6-58L10-8H27L30-55" fill={dad ? '#697d83' : '#b49a8b'} />
          <path d="M-28-12H-8L-6 0H-39Q-40-9-28-12M10-12H28Q39-9 40 0H9Z" fill="#7c6a5d" />
          <path d={dad ? 'M-44-168Q0-184 44-168L46-59Q0-47-46-59Z' : 'M-36-169Q0-183 36-169L55-47Q0-31-55-47Z'} fill={shirt} />
          <path d="M-13-186v17q13 12 26 0v-17" fill={skin} />
          {dad ? <path d="M-16-172l16 17 16-17M0-155v78" fill="none" stroke="#b1c2bf" strokeWidth="3" /> : <>
            <path d="M-17-171q17 19 34 0" fill="none" stroke={mum ? '#e3d3e7' : '#dce4cf'} strokeWidth="7" />
            {[0, 1, 2].map(i => <circle key={i} cy={-144 + i * 22} r="2.4" fill="#f4ead9" />)}
          </>}
          {grandma && <path d="M-35-147L-24-74M35-147L24-74" fill="none" stroke="#8f9f84" strokeWidth="3" />}
        </>}
        <g transform={`translate(${-1 * (child ? 29 : 36)} ${shoulderY + 9})`}>
          <g className={reach === 'left' ? 'story-stage__reach-left' : point ? 'story-stage__offer-arm' : 'story-stage__rest-arm'}>
            <path d={child ? 'M0 0Q-20 18-17 47' : 'M0 0Q-24 32-17 72'} stroke={shirt} strokeWidth={child ? 20 : 23} strokeLinecap="round" fill="none" />
            <circle cx="-17" cy={child ? 50 : 76} r={child ? 10 : 12} fill={skin} />
          </g>
        </g>
        <g transform={`translate(${child ? 29 : 36} ${shoulderY + 9})`}>
          <g className={reach === 'right' ? 'story-stage__reach-right' : wave ? 'story-stage__person-wave' : point ? 'story-stage__introduce-arm' : 'story-stage__rest-arm'}>
            <path d={child ? 'M0 0Q21 16 18 46' : 'M0 0Q26 31 19 72'} stroke={shirt} strokeWidth={child ? 20 : 23} strokeLinecap="round" fill="none" />
            <circle cx={child ? 18 : 19} cy={child ? 49 : 76} r={child ? 10 : 12} fill={skin} />
            {wave && <path d={child ? 'M14 42l-2-10M21 42l2-9' : 'M14 68l-3-12M22 67l3-11'} stroke={skin} strokeWidth="5" strokeLinecap="round" />}
          </g>
        </g>
        <g transform={`translate(0 ${headY})`}>
          <g className={nod ? 'story-stage__nod-head' : 'story-stage__person-head'}>
            {mum && <path d="M-40-10Q-48-58 0-57Q48-57 41-6L45 43Q0 63-45 43Z" fill={hair} />}
            {grandma && <circle cx="18" cy="-45" r="22" fill={hair} />}
            <ellipse cy="1" rx={child ? 37 : 38} ry={child ? 40 : 44} fill={skin} />
            <ellipse cx="-37" cy="4" rx="6" ry="10" fill={skin} />
            <ellipse cx="37" cy="4" rx="6" ry="10" fill={skin} />
            {child ? <>
              <path d="M-36 0Q-47-52-1-51Q43-52 39-6L27-16L21-35Q4-8-14-17L-18-4L-28-19Z" fill={hair} />
              <path d="M-11-46q-4-15 10-20M-5-46q8-15 20-10" fill="none" stroke={hair} strokeWidth="5" strokeLinecap="round" />
            </> : dad ? <path d="M-37-6Q-46-54 4-54Q45-53 38-5L28-13L27-30Q5-24-13-35Q-18-16-28-14L-28 2Z" fill={hair} /> : grandma ? <>
              <path d="M-38-1Q-47-51 0-52Q46-52 38-1L28-11Q18-17 8-34Q-11-11-31-12Z" fill={hair} />
              <path d="M-23-38q18-13 36-4" stroke="#ded9d0" strokeWidth="4" fill="none" strokeLinecap="round" />
            </> : <>
              <path d="M-38 2Q-45-54 1-53Q45-52 38 0L28-13L22-34Q3-13-25-14L-28 11Z" fill={hair} />
              <circle cx="-33" cy="29" r="3.5" fill="#dab36b" />
              <circle cx="33" cy="29" r="3.5" fill="#dab36b" />
            </>}
            <g transform="translate(0 5)"><Face talking={talking} adult={!child} glasses={grandma} /></g>
          </g>
        </g>
      </g>
    </g>
  )
}

function Plant({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${small ? '.65' : '1'})`}>
    <g className="story-stage__plant-leaves">
      <path d="M0-26V-105M0-51L-24-79M0-66L23-98" fill="none" stroke="#819a79" strokeWidth="5" strokeLinecap="round" />
      <path d="M-2-64Q-57-63-42-101Q-7-104-2-64M2-81Q2-127 36-128Q53-88 2-81M-1-101Q-31-117-18-143Q14-135-1-101" fill="#9cad89" />
      <path d="M-1-38Q-41-30-44-64Q-13-79-1-38M2-47Q8-83 38-74Q47-40 2-47" fill="#b1bf9b" />
    </g>
    <path d="M-28-32H28L21 7Q0 17-21 7Z" fill="#cf9b7e" />
    <rect x="-31" y="-37" width="62" height="12" rx="5" fill="#ddb196" />
    <path d="M-15-17l4 19M0-17V4M15-17L11 2" stroke="#bc896f" strokeWidth="2" strokeLinecap="round" />
  </g>
}

function Room({ storyId, gradientId }: { storyId: StoryStageProps['storyId']; gradientId: string }) {
  return <g aria-hidden="true">
    <defs>
      <linearGradient id={`${gradientId}-wall`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f7eddb" />
        <stop offset="1" stopColor="#f1e4cc" />
      </linearGradient>
      <linearGradient id={`${gradientId}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c6dbd5" />
        <stop offset="1" stopColor="#e5eee1" />
      </linearGradient>
      <radialGradient id={`${gradientId}-light`}>
        <stop offset="0" stopColor="#fffcf0" stopOpacity=".6" />
        <stop offset="1" stopColor="#fff9e8" stopOpacity="0" />
      </radialGradient>
    </defs>
    <path d="M0 0H1000V560H0Z" fill={`url(#${gradientId}-wall)`} />
    <path d="M0 393H1000V560H0Z" fill="#d9c5a6" />
    <path d="M0 393H1000" stroke="#cbb695" strokeWidth="12" />
    <path d="M0 399H1000" stroke="#f6e6c9" strokeWidth="4" />
    <path d="M0 457H1000M0 520H1000M137 400L60 560M373 400L349 560M646 400L689 560M871 400L970 560" stroke="#c6af90" strokeWidth="2" opacity=".45" />
    <ellipse cx="425" cy="472" rx="345" ry="56" fill={storyId === 'colors' ? '#d4d1b4' : '#dec9b5'} />
    <ellipse cx="425" cy="472" rx="315" ry="43" fill="none" stroke="#efe0c8" strokeWidth="3" opacity=".65" />
    <rect x="64" y="47" width="181" height="216" rx="89" fill="#e4d6bf" />
    <rect x="77" y="59" width="155" height="190" rx="76" fill={`url(#${gradientId}-sky)`} />
    <circle cx="180" cy="106" r="24" fill="#f6e2ac" />
    <path d="M79 205Q121 163 157 198Q196 164 231 200V247H79Z" fill="#b6c6aa" />
    <path d="M79 224Q117 194 162 220Q198 191 231 216V249H79Z" fill="#9db599" />
    <path d="M155 61V249M78 158H231" stroke="#faf3e3" strokeWidth="8" />
    <rect x="63" y="244" width="183" height="12" rx="5" fill="#efe3cc" />
    <path d="M66 61Q43 141 66 244L94 245Q75 164 98 61M240 61Q260 153 242 245L215 245Q234 156 211 61" fill="#c4b4a3" />
    <path d="M63 62H244" stroke="#9e8c74" strokeWidth="6" strokeLinecap="round" />
    <ellipse cx="240" cy="231" rx="250" ry="240" fill={`url(#${gradientId}-light)`} />
    <path d="M816 389V139Q816 63 891 63Q966 63 966 139V389" fill="#e8d5b8" stroke="#d1bba0" strokeWidth="9" />
    <path d="M834 389V143Q834 82 891 82Q949 82 949 143V389" fill="#c8b399" />
    <path d="M846 375V148Q846 98 891 98Q936 98 936 148V375" fill="#d5c1a8" />
    <path d="M853 224H928M891 111V215" stroke="#c0a98e" strokeWidth="3" />
    <circle cx="922" cy="260" r="7" fill="#a38f6b" />
    <circle cx="920" cy="258" r="2" fill="#e7d5ac" />
    <Plant x={938} y={436} />
    <g transform="translate(696 75)">
      <circle r="31" fill="#d6bda0" />
      <circle r="25" fill="#fcf6e8" />
      <path d="M0-17V-14M17 0H14M0 17V14M-17 0H-14M0 0V-13M0 0L10 6" stroke="#8f8b77" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle r="3" fill="#8f8b77" />
    </g>
    {storyId === 'family' ? <>
      <path d="M327 349V291Q327 267 353 267H640Q666 267 666 291V349" fill="#abb7a3" />
      <rect x="310" y="326" width="373" height="64" rx="22" fill="#9eae98" />
      <rect x="309" y="319" width="35" height="66" rx="15" fill="#b5bfab" />
      <rect x="650" y="319" width="35" height="66" rx="15" fill="#b5bfab" />
      <path d="M341 387v14M652 387v14" stroke="#9c8068" strokeWidth="9" strokeLinecap="round" />
      <path d="M369 285l52 3-3 43-52-4Z" fill="#d6bd91" />
      <path d="M565 284l53-3 5 43-52 6Z" fill="#d9c9b5" />
      <path d="M388 292l-4 28M402 294l-4 28" stroke="#bda77e" strokeWidth="2" />
      <g transform="translate(423 98)">
        <rect x="-55" y="-29" width="110" height="105" rx="5" fill="#c8a98b" />
        <rect x="-47" y="-21" width="94" height="89" fill="#f8ecd8" />
        <path d="M-36 47V14L0-9L36 14V47" fill="#c4b49a" />
        <path d="M-42 14L0-16L42 14" fill="none" stroke="#b68f76" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-7 47V23H10V47" fill="#a2b3a0" />
        <circle cx="-23" cy="8" r="7" fill="#dfbb84" />
        <path d="M22 4q9-13 16 0q0 9-16 17q-16-8-16-17q7-13 16 0" transform="translate(2 2) scale(.5)" fill="#d09b89" />
      </g>
    </> : storyId === 'school-things' ? <>
      <rect x="327" y="59" width="259" height="142" rx="9" fill="#c2b59b" />
      <rect x="337" y="69" width="239" height="122" rx="4" fill="#91aaa0" />
      <path d="M372 118L391 92L409 118L429 97M457 105q13-23 27 0q0 15-27 30q-27-15-27-30q14-23 27 0" fill="none" stroke="#e6ead4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M369 158H495M369 168H447" stroke="#e4e6cd" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <rect x="524" y="180" width="28" height="6" rx="3" fill="#efe2be" />
      <path d="M623 197H756" stroke="#bb997b" strokeWidth="10" strokeLinecap="round" />
      <rect x="636" y="142" width="17" height="48" rx="2" fill="#b9927f" />
      <rect x="656" y="134" width="17" height="56" rx="2" fill="#d3b276" />
      <rect x="677" y="146" width="15" height="44" rx="2" fill="#93a79c" />
      <path d="M701 142l16-5 15 48-17 5Z" fill="#b0a3b5" />
      <Plant x={755} y={198} small />
    </> : <>
      <path d="M321 76L345 86L370 77L395 88L420 78L445 89L470 79L495 91L520 80L545 91L570 79" stroke="#baa58a" strokeWidth="2" fill="none" />
      {['#c98f80', '#b2b99c', '#8daab5', '#d8bd79', '#b3a0b4'].map((color, i) => <path key={color} d={`M${345 + i * 48} 86l22-4-9 30Z`} fill={color} />)}
      <g transform="translate(692 267)">
        <path d="M-50 136L-21-73M50 136L21-73M0 136V-82" stroke="#bc9b78" strokeWidth="8" strokeLinecap="round" />
        <rect x="-51" y="-86" width="102" height="128" rx="4" fill="#e2ccab" />
        <rect x="-43" y="-78" width="86" height="111" rx="2" fill="#faf2dd" />
        <circle cx="18" cy="-53" r="13" fill="#dbbd75" />
        <path d="M-38 6l26-34 28 31 13-17 14 20V28H-38Z" fill="#acbba0" />
        <path d="M-59 42H59" stroke="#b99470" strokeWidth="8" strokeLinecap="round" />
      </g>
      <path d="M283 358H321V390H283Z" fill="#c6a182" />
      <path d="M289 358l-4-44M299 358l7-49M311 358l11-36" stroke="#b29272" strokeWidth="5" strokeLinecap="round" />
      <path d="M285 314l-2-10M306 309l3-11M322 322l4-10" stroke="#8da09b" strokeWidth="7" strokeLinecap="round" />
    </>}
    <ellipse cx="66" cy="440" rx="44" ry="12" fill="#baa58b" opacity=".3" />
    <Plant x={63} y={430} small />
  </g>
}

function Shadow({ x, width = 61 }: { x: number; width?: number }) {
  return <ellipse cx={x} cy="471" rx={width} ry="13" fill="#9f8b74" opacity=".16" />
}

function Accent({ x, y, kind = 'spark' }: { x: number; y: number; kind?: 'spark' | 'heart' }) {
  return <g transform={`translate(${x} ${y})`}>
    <g className="story-stage__accent">
      {kind === 'heart' ? <path d="M0-5Q-13-21-20-5Q-22 9 0 23Q22 9 20-5Q13-21 0-5" fill="#d5a28e" /> : <path d="M0-16L4-4L16 0L4 4L0 16L-4 4L-16 0L-4-4Z" fill="#dac083" />}
    </g>
  </g>
}

function FamilyScene({ act, phase, speaking, complete }: { act: number; phase: number; speaking: boolean; complete: boolean }) {
  const family: PersonKind[] = ['mum', 'dad', 'grandma']
  return <g>
    <Shadow x={211} />
    <Shadow x={434} width={48} />
    <g transform="translate(211 468) scale(1.1)"><Bear talking={speaking && phase !== 1} wave={phase === 2 || complete} point={phase === 0 && !complete} /></g>
    <g transform="translate(434 469) scale(1.04)"><Person kind="child" talking={speaking && phase === 1} point={!complete && phase === 1} wave={complete} /></g>
    {complete ? family.map((kind, i) => <g key={kind} transform={`translate(${605 + i * 125} 468) scale(.88)`}>
      <ellipse cy="3" rx="48" ry="10" fill="#9f8b74" opacity=".16" />
      <Person kind={kind} wave />
    </g>) : <g key={act} transform="translate(747 468)">
      <g className="story-stage__family-entry">
        <ellipse cy="3" rx="66" ry="13" fill="#9f8b74" opacity=".16" />
        <Person kind={family[act]} wave={phase === 2} nod={phase === 1} />
      </g>
    </g>}
    {phase === 2 && <><Accent x={574} y={243} kind="heart" /><Accent x={848} y={164} /></>}
    {complete && <><Accent x={334} y={181} /><Accent x={535} y={120} kind="heart" /><Accent x={917} y={190} /></>}
  </g>
}

function Pencil() {
  return <g transform="rotate(-22)">
    <rect x="-53" y="-7" width="85" height="14" rx="2" fill="#dfbd70" />
    <path d="M-51-2H31" stroke="#f8d990" strokeWidth="3" />
    <rect x="-54" y="-7" width="12" height="14" fill="#b7b7a7" />
    <path d="M-54-7h-6q-7 7 0 14h6Z" fill="#cd9a96" />
    <path d="M32-7L53 0L32 7Z" fill="#e9d0a5" />
    <path d="M46-2L53 0L46 2Z" fill="#736154" />
  </g>
}

function Book() {
  return <g>
    <path d="M-39-28H32Q39-28 39-21V29H-34Q-42 29-42 21V-21Q-42-28-39-28Z" fill="#879f9b" />
    <path d="M-32-25V22" stroke="#688884" strokeWidth="3" />
    <path d="M-30 19H36V26H-30Q-36 23-30 19" fill="#f1e5ca" />
    <path d="M-13-15h32v21h-32Z" fill="#e7d8b4" />
    <path d="M-5-4l7-7 8 7" stroke="#b4a481" strokeWidth="2" fill="none" />
    <path d="M22 19v-10l7 0v10" fill="#ca9a82" />
  </g>
}

function Bag({ open }: { open: boolean }) {
  return <g>
    <path d="M-18-58v-16q18-21 36 0v16" stroke="#b78d75" strokeWidth="9" fill="none" />
    <path d="M-45-49Q0-77 45-49L53 39Q0 60-53 39Z" fill="#bf9076" />
    <path d="M-44-43Q0-62 44-43L46-20Q0 1-46-20Z" fill="#9d745e" />
    <path d="M-35-41Q0-56 35-41L38-23Q0-7-38-23Z" fill="#705d51" />
    <g transform="translate(0 -46)">
      <g className={open ? 'story-stage__bag-open' : ''}>
        <path d="M-45 0Q0-27 45 0L39 41Q0 60-39 41Z" fill="#d0a188" />
        <path d="M-40 11Q0 30 40 11" stroke="#bb8d74" strokeWidth="2" fill="none" />
        <rect x="-7" y="33" width="14" height="17" rx="4" fill="#d7bb83" />
      </g>
    </g>
    <rect x="-29" y="8" width="58" height="30" rx="10" fill="#d5ad8e" />
    <path d="M-22 14H22" stroke="#b68a6b" strokeWidth="2" strokeLinecap="round" />
  </g>
}

function PencilCase({ open }: { open: boolean }) {
  return <g>
    <rect x="-59" y="-14" width="118" height="34" rx="12" fill="#9bac95" />
    <path d="M-48 12H48" stroke="#849a7f" strokeWidth="2" strokeLinecap="round" />
    {open && <>
      <rect x="-50" y="-11" width="100" height="23" rx="6" fill="#71876d" />
      <path d="M-38 2H27" stroke="#e2c17e" strokeWidth="7" strokeLinecap="round" />
      <path d="M-34-5H37" stroke="#b7a6b8" strokeWidth="5" strokeLinecap="round" />
      <path d="M-43 8H33" stroke="#e7d8aa" strokeWidth="4" strokeLinecap="round" />
    </>}
    <g transform="translate(0 -14)">
      <g className={open ? 'story-stage__case-open' : ''}>
        <rect x="-59" y="-16" width="118" height="29" rx="12" fill="#b4c1a6" />
        <path d="M-47 7H47" stroke="#d5dec8" strokeWidth="2" strokeLinecap="round" />
        <path d="M0-10L3-3L11-2L5 3L7 11L0 7L-7 11L-5 3L-11-2L-3-3Z" fill="#e7d5a5" />
      </g>
    </g>
  </g>
}

function SchoolScene({ act, phase, speaking, complete }: { act: number; phase: number; speaking: boolean; complete: boolean }) {
  const pencilAtMomo = act === 0 && phase === 2
  const bookAtChild = act === 1 && phase === 2
  return <g>
    <Shadow x={242} />
    <Shadow x={736} width={48} />
    <g transform="translate(242 468) scale(1.1)"><Bear talking={speaking && phase !== 1} wave={complete} point={!complete && (act !== 1 || phase === 2)} /></g>
    <g transform="translate(736 469) scale(1.04)"><Person kind="child" look="mint" talking={speaking && phase === 1} point={!complete && phase === 1} wave={complete} nod={act === 1 && phase === 1} /></g>
    <g>
      <path d="M367 377L355 460M625 377L637 460" stroke="#b69673" strokeWidth="13" strokeLinecap="round" />
      <path d="M377 393H617" stroke="#c0a283" strokeWidth="9" />
      <path d="M346 350H646Q658 350 658 364V377H334V364Q334 350 346 350" fill="#d3b48d" />
      <path d="M343 354H648" stroke="#e9cfaa" strokeWidth="5" strokeLinecap="round" />
      <rect x="336" y="374" width="319" height="10" rx="4" fill="#c1a17d" />
    </g>
    {complete ? <>
      <g transform="translate(416 326)"><Book /></g>
      <g transform="translate(530 330)"><PencilCase open /></g>
      <g transform="translate(604 305) scale(.8)"><Bag open /></g>
      <Accent x={499} y={208} />
      <Accent x={650} y={174} kind="heart" />
    </> : act === 0 ? <g key={`pencil-${phase}`}>
      <g transform={pencilAtMomo ? 'translate(350 324)' : 'translate(623 324)'}>
        <g className={phase === 1 ? 'story-stage__give-pencil' : 'story-stage__prop-appear'}><Pencil /></g>
      </g>
      {phase === 1 && <g className="story-stage__exchange-guide" fill="#b8b793">
        <circle cx="430" cy="297" r="3" /><circle cx="458" cy="290" r="3" /><circle cx="486" cy="289" r="3" /><circle cx="514" cy="292" r="3" />
      </g>}
      {phase === 2 && <Accent x={373} y={262} />}
    </g> : act === 1 ? <g key={`book-${phase}`}>
      <g transform={bookAtChild ? 'translate(623 316)' : 'translate(350 316)'}>
        <g className={phase === 2 ? 'story-stage__return-book' : 'story-stage__prop-appear'}><Book /></g>
      </g>
      {phase === 2 && <Accent x={626} y={250} />}
    </g> : <g key="case">
      <g transform="translate(558 313) scale(.82)"><Bag open={phase > 0} /></g>
      {phase > 0 && <g transform="translate(548 238)">
        <g className="story-stage__case-reveal"><PencilCase open={phase === 2} /></g>
      </g>}
      {phase === 2 && <><Accent x={454} y={209} /><Accent x={642} y={208} /></>}
    </g>}
  </g>
}

function Balloon({ color, highlight }: { color: string; highlight: string }) {
  return <g>
    <path d="M0 0Q-14 35 4 69Q18 98 0 125" stroke="#a6967c" strokeWidth="2.2" fill="none" />
    <path d="M0-6L-8 6H8Z" fill={color} />
    <path d="M0-146Q-64-146-63-85Q-60-25 0-4Q60-25 63-85Q64-146 0-146Z" fill={color} />
    <path d="M-39-94Q-38-122-16-127" stroke={highlight} strokeWidth="9" strokeLinecap="round" fill="none" opacity=".8" />
    <ellipse cx="-42" cy="-78" rx="4" ry="7" fill={highlight} opacity=".6" />
  </g>
}

function YellowStar() {
  return <g>
    <path d="M0-81L24-30L80-23L39 17L49 73L0 46L-49 73L-39 17L-80-23L-24-30Z" fill="#dfbf6d" stroke="#c9aa60" strokeWidth="3" strokeLinejoin="round" />
    <path d="M0-60L16-24L52-19" stroke="#f5dfa1" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <ellipse cx="-17" cy="-1" rx="4" ry="5" fill="#8f784c" />
    <ellipse cx="17" cy="-1" rx="4" ry="5" fill="#8f784c" />
    <path d="M-10 16q10 10 20 0" stroke="#8f784c" strokeWidth="3" fill="none" strokeLinecap="round" />
    <ellipse cx="-34" cy="13" rx="8" ry="4" fill="#d59d72" opacity=".7" />
    <ellipse cx="34" cy="13" rx="8" ry="4" fill="#d59d72" opacity=".7" />
  </g>
}

function ColorsScene({ act, phase, speaking, complete }: { act: number; phase: number; speaking: boolean; complete: boolean }) {
  return <g>
    <Shadow x={228} />
    <Shadow x={771} width={48} />
    <g transform="translate(228 468) scale(1.1)"><Bear talking={speaking && phase !== 1} wave={complete || phase === 2} point={!complete && phase === 0} /></g>
    <g transform="translate(771 469) scale(1.04)"><Person kind="child" look="berry" talking={speaking && phase === 1} wave={complete} point={!complete && phase === 1} nod={act === 1 && phase === 1} /></g>
    {complete ? <>
      <g transform="translate(421 287) scale(.68)"><g className="story-stage__balloon-float"><Balloon color="#cb8f7f" highlight="#ebbdac" /></g></g>
      <g transform="translate(589 284) scale(.68)"><g className="story-stage__balloon-float story-stage__balloon-float--late"><Balloon color="#86a9ba" highlight="#c4d9df" /></g></g>
      <g transform="translate(507 354) scale(.62)"><g className="story-stage__star-float">
        <path d="M0 51Q-18 76 0 102Q14 124-2 147" fill="none" stroke="#a6967c" strokeWidth="2.2" />
        <YellowStar />
      </g></g>
      <Accent x={484} y={178} /><Accent x={646} y={331} /><Accent x={354} y={364} />
    </> : <g key={act} className="story-stage__color-entry">
      {act < 2 ? <g transform="translate(496 321)">
        <g className={`story-stage__balloon-float${phase === 2 ? ' story-stage__balloon-float--happy' : ''}`}>
          <Balloon color={act === 0 ? '#cb8f7f' : '#86a9ba'} highlight={act === 0 ? '#ebbdac' : '#c4d9df'} />
        </g>
      </g> : <>
        <ellipse cx="498" cy="432" rx="69" ry="12" fill="#b7a389" opacity=".2" />
        <g transform="translate(499 296)"><g className="story-stage__star-float">
          <path d="M0 51Q-18 76 0 102Q14 124-2 147" fill="none" stroke="#a6967c" strokeWidth="2.2" />
          <path d="M-6 52L0 43L6 52Z" fill="#dfbf6d" />
          <YellowStar />
        </g></g>
      </>}
      {phase > 0 && <><Accent x={390} y={210} /><Accent x={610} y={287} /></>}
      {phase === 2 && <Accent x={511} y={137} kind="heart" />}
    </g>}
  </g>
}

function Garden({ gradientId }: { gradientId: string }) {
  return <g aria-hidden="true">
    <defs>
      <linearGradient id={`${gradientId}-garden`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d8e7df" /><stop offset="1" stopColor="#f7efd6" />
      </linearGradient>
      <linearGradient id={`${gradientId}-stream`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#96bcb9" /><stop offset=".5" stopColor="#b4d0c7" /><stop offset="1" stopColor="#96bcb9" />
      </linearGradient>
    </defs>
    <path d="M0 0H1000V560H0Z" fill={`url(#${gradientId}-garden)`} />
    <circle cx="827" cy="103" r="44" fill="#f4dda0" />
    <g fill="#fff9e9" opacity=".82">
      <path d="M100 108q-12-26 11-37q16-10 31 5q14-19 31-8q17 8 11 25q21-2 22 15Z" />
      <path d="M603 85q-9-22 11-30q16-6 25 7q15-10 27 0q12 9 4 23Z" />
    </g>
    <path d="M0 257Q126 163 274 239Q390 153 526 239Q685 145 815 232Q906 173 1000 239V560H0Z" fill="#b4c6a6" />
    <path d="M0 324Q149 246 325 310Q474 261 641 315Q817 249 1000 319V560H0Z" fill="#c7d0aa" />
    <path d="M0 397Q169 349 349 384L363 560H0ZM650 384Q824 347 1000 390V560H639Z" fill="#d7d7ae" />
    <path d="M453 302Q405 347 354 389Q338 466 363 560H639Q654 461 650 389Q572 343 545 302Z" fill={`url(#${gradientId}-stream)`} />
    <path d="M354 390Q338 467 363 560M650 390Q654 467 639 560" stroke="#a8bc99" strokeWidth="10" fill="none" />
    <g className="story-stage__water-ripples" fill="none" stroke="#e2eee0" strokeWidth="4" strokeLinecap="round" opacity=".72">
      <path d="M461 337h35M531 362h37M397 402h44M557 423h42M419 499h55M524 533h57" />
    </g>
    <path d="M47 481Q166 438 297 475M707 476Q835 437 956 473" fill="none" stroke="#e8dfbb" strokeWidth="34" strokeLinecap="round" />
    {[{ x: 77, y: 358 }, { x: 902, y: 382 }, { x: 293, y: 334 }].map(({ x, y }) => <g key={x} transform={`translate(${x} ${y})`}>
      <path d="M0 32V0M0 19Q-19 7-21 16Q-15 28 0 24" fill="none" stroke="#92a77d" strokeWidth="4" strokeLinecap="round" />
      <g fill="#e4c7b2"><ellipse cy="-7" rx="6" ry="10" /><ellipse cx="8" cy="-1" rx="10" ry="6" /><ellipse cy="6" rx="6" ry="10" /><ellipse cx="-8" cy="-1" rx="10" ry="6" /></g>
      <circle cy="-1" r="5" fill="#e6c77e" />
    </g>)}
    <g transform="translate(73 254)">
      <path d="M0 111V-17M0 20L-28-1M0 3L25-28" fill="none" stroke="#ab9674" strokeWidth="16" strokeLinecap="round" />
      <path d="M-50 1Q-77-42-40-67Q-35-104 9-94Q49-116 65-68Q99-41 65-8Q31 24-2 3Q-30 23-50 1" fill="#a2b698" />
      <path d="M-39-49Q-11-77 15-55" stroke="#bac7a7" strokeWidth="7" strokeLinecap="round" fill="none" />
    </g>
    <g transform="translate(916 292) scale(.75)"><Plant x={0} y={0} /></g>
  </g>
}

function BridgeBlock({ number }: { number: number }) {
  const color = ['#d5af76', '#9eafa0', '#c69d94'][number - 1]
  return <g>
    <path d="M-45-17L-35-28H43L45-17Z" fill={['#ead1a2', '#bdc9b3', '#dec0b1'][number - 1]} />
    <rect x="-45" y="-17" width="90" height="33" rx="6" fill={color} />
    <path d="M-35 10H35" stroke="#826d55" strokeWidth="2" strokeLinecap="round" opacity=".16" />
    <circle r="10" fill="#fff5dc" opacity=".8" />
    <text x="0" y="5" textAnchor="middle" fill="#76644f" fontSize="15" fontWeight="700" fontFamily="system-ui, sans-serif">{number}</text>
  </g>
}

function NumbersScene({ act, phase, speaking, complete }: { act: number; phase: number; speaking: boolean; complete: boolean }) {
  const crossing = act === 2 && phase === 2
  const blockX = [407, 500, 593]
  return <g>
    <Shadow x={830} width={48} />
    <g transform={`translate(${complete ? 700 : 224} 468) scale(1.04)`}>
      <g className={crossing && !complete ? 'story-stage__cross-bridge' : ''}>
        <ellipse cy="3" rx="59" ry="12" fill="#9f8b74" opacity=".16" />
        <Bear talking={speaking && phase !== 1} point={!complete && phase === 0} wave={complete || crossing} />
      </g>
    </g>
    <g transform="translate(830 469) scale(1.04)"><Person kind="child" talking={speaking && phase === 1} point={!complete && phase < 2} wave={complete || crossing} /></g>
    {blockX.map((x, i) => {
      const placed = complete || i < act || (i === act && phase === 2)
      if (i > act && !complete) return null
      if (placed) return <g key={i} transform={`translate(${x} 453)`}><BridgeBlock number={i + 1} /></g>
      return <g key={i} transform={`translate(${x} 453)`}>
        <g className={phase === 1 ? 'story-stage__place-block' : ''} style={{ '--block-start-x': `${742 - x}px`, '--block-mid-x': `${(742 - x) / 2}px`, transform: phase === 0 ? `translate(${742 - x}px, -86px)` : undefined } as CSSProperties}>
          <BridgeBlock number={i + 1} />
        </g>
      </g>
    })}
    {phase === 2 && <Accent x={blockX[act]} y={393} />}
    {(crossing || complete) && <><Accent x={705} y={209} kind="heart" /><Accent x={898} y={243} /><Accent x={517} y={364} /></>}
  </g>
}

function ClassroomRoom({ act, phase, complete }: { act: number; phase: number; complete: boolean }) {
  const doorOpen = complete || act > 0 || phase > 0
  const windowOpen = complete || act > 1 || (act === 1 && phase > 0)
  return <g aria-hidden="true">
    <path d="M0 0H1000V560H0Z" fill="#f4e8d0" />
    <path d="M0 398H1000V560H0Z" fill="#d8c4a2" />
    <path d="M0 392H1000" stroke="#c5b48e" strokeWidth="12" />
    <path d="M0 400H1000" stroke="#f8edcf" strokeWidth="4" />
    <path d="M0 460H1000M0 525H1000M171 400L110 560M409 400L386 560M653 400L680 560M872 400L960 560" stroke="#c2a987" strokeWidth="2" opacity=".4" />
    <g>
      <path d="M77 396V142Q77 95 124 95H225Q272 95 272 142V396Z" fill="#bca486" />
      <path d="M91 394V145Q91 110 126 110H222Q257 110 257 145V394Z" fill="#dfd6bc" />
      <path d="M91 347Q175 318 257 347V394H91Z" fill="#b9c6a5" />
      <path d="M127 188L174 143L222 188V279H127Z" fill="#e9debd" />
      <path d="M120 188L174 137L229 188" fill="none" stroke="#b8aa8d" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(92 110)">
        <g className={`${doorOpen ? 'story-stage__door-open' : ''}${act === 0 && phase === 1 && !complete ? ' story-stage__opening-door' : ''}`}>
          <path d="M0 284V36Q0 0 36 0H129Q165 0 165 36V284Z" fill="#c7a882" stroke="#b59672" strokeWidth="3" />
          <rect x="19" y="34" width="127" height="106" rx="44" fill="#e6d8b4" />
          <path d="M82 37V137M21 88H144" stroke="#d3bd97" strokeWidth="6" />
          <rect x="20" y="162" width="125" height="101" rx="7" fill="none" stroke="#b89871" strokeWidth="3" />
          <path d="M142 208h15" stroke="#927a57" strokeWidth="7" strokeLinecap="round" />
          <circle cx="141" cy="208" r="7" fill="#d8bb76" />
        </g>
      </g>
      <rect x="78" y="393" width="193" height="11" rx="3" fill="#b79c78" />
    </g>
    <g>
      <rect x="300" y="145" width="253" height="189" rx="7" fill="#d2bea1" />
      <rect x="309" y="154" width="235" height="171" rx="3" fill="#c4dcd1" />
      <circle cx="478" cy="190" r="23" fill="#f1dda7" />
      <path d="M309 280Q365 238 425 277Q492 232 544 276V325H309Z" fill="#a9c09f" />
      <path d="M309 305Q378 274 442 309Q490 274 544 295V325H309Z" fill="#91ad92" />
      <g transform="translate(309 154)">
        <g className={`${windowOpen ? 'story-stage__window-left-open' : ''}${act === 1 && phase === 1 && !complete ? ' story-stage__opening-window-left' : ''}`}>
          <rect x="0" y="0" width="116" height="171" rx="2" fill="#d9e6d7" fillOpacity=".34" stroke="#f8edcf" strokeWidth="8" />
          <path d="M2 83H112" stroke="#f8edcf" strokeWidth="6" />
          <path d="M105 134v17" stroke="#a89875" strokeWidth="5" strokeLinecap="round" />
        </g>
      </g>
      <g transform="translate(544 154)">
        <g className={`${windowOpen ? 'story-stage__window-right-open' : ''}${act === 1 && phase === 1 && !complete ? ' story-stage__opening-window-right' : ''}`}>
          <rect x="-116" y="0" width="116" height="171" rx="2" fill="#d9e6d7" fillOpacity=".34" stroke="#f8edcf" strokeWidth="8" />
          <path d="M-112 83H-2" stroke="#f8edcf" strokeWidth="6" />
          <path d="M-105 134v17" stroke="#a89875" strokeWidth="5" strokeLinecap="round" />
        </g>
      </g>
      <rect x="292" y="331" width="270" height="13" rx="5" fill="#e9d6b6" />
      {windowOpen && <g className="story-stage__cool-breeze" fill="none" stroke="#fbf9e8" strokeWidth="4" strokeLinecap="round" opacity=".74">
        <path d="M382 225q50-21 95 1q39 20 66 0M394 252q38-13 71 2q34 17 66 1M445 286q39-15 73 0" />
      </g>}
    </g>
    <g>
      <rect x="655" y="77" width="284" height="213" rx="10" fill="#bea484" />
      <rect x="665" y="87" width="264" height="193" rx="4" fill="#8ba59a" />
      <path d="M698 133H805M698 150H766" stroke="#dce4ce" strokeWidth="5" strokeLinecap="round" />
      <path d="M734 242v-57q0-20 18-20q18 0 18 20v57M734 210h36" fill="none" stroke="#e8e7c9" strokeWidth="5" strokeLinecap="round" />
      <path d="M837 180L853 215L891 220L863 244L869 280L837 261L805 280L811 244L783 220L821 215Z" transform="translate(188 3) scale(.8)" fill="none" stroke="#dcca8c" strokeWidth="5" strokeLinejoin="round" />
      <rect x="668" y="280" width="266" height="10" rx="3" fill="#d4b68c" />
      <rect x="868" y="271" width="24" height="8" rx="3" fill="#eadfba" />
    </g>
    <Plant x={941} y={429} small />
    <g transform="translate(610 61)"><circle r="29" fill="#cbb397" /><circle r="23" fill="#fbf4df" /><path d="M0-14V0L10 7" fill="none" stroke="#9b957d" strokeWidth="3" strokeLinecap="round" /><circle r="3" fill="#9b957d" /></g>
  </g>
}

function ClassroomChair() {
  return <g>
    <path d="M-34-111L-35 1M35-111L39 1M-32-41L-42 1M33-41L25 1" stroke="#a98b68" strokeWidth="10" strokeLinecap="round" />
    <rect x="-41" y="-121" width="83" height="55" rx="10" fill="#bbab85" />
    <path d="M-30-107H31M-30-93H31" stroke="#d4c59f" strokeWidth="5" strokeLinecap="round" />
    <path d="M-40-51H33L48-36H-47Z" fill="#d9be91" />
    <path d="M-47-36H48" stroke="#b49770" strokeWidth="8" strokeLinecap="round" />
  </g>
}

function ClassroomScene({ act, phase, speaking, complete }: { act: number; phase: number; speaking: boolean; complete: boolean }) {
  const arrived = complete || act > 0
  const sitting = complete || (act === 2 && phase > 0)
  const childX = act === 0 ? 322 : act === 1 ? 365 : sitting ? 738 : 639
  return <g>
    <ClassroomRoom act={act} phase={phase} complete={complete} />
    <ellipse cx="706" cy="480" rx="133" ry="20" fill="#ad9777" opacity=".13" />
    <g transform="translate(738 474)"><ClassroomChair /></g>
    <g transform={`translate(${arrived ? 495 : 166} 468) scale(1.04)`}>
      <g className={act === 0 && phase === 2 && !complete ? 'story-stage__enter-classroom' : ''}>
        <ellipse cy="3" rx="59" ry="12" fill="#9f8b74" opacity=".16" />
        <Bear talking={speaking && phase !== 1} wave={complete || (act === 0 && phase === 2)} point={!complete && act === 2} />
      </g>
    </g>
    <g transform={`translate(${childX} ${sitting ? 475 : 468}) scale(1.04)`}>
      <g className={act === 2 && phase === 1 && !complete ? 'story-stage__sit-on-chair' : ''}>
        <Person kind="child" talking={speaking && phase === 1} reach={phase === 1 && act === 0 ? 'left' : phase === 1 && act === 1 ? 'right' : undefined} seated={sitting} nod={sitting} wave={complete} />
      </g>
    </g>
    {act === 0 && phase === 2 && <Accent x={420} y={204} kind="heart" />}
    {act === 1 && phase === 2 && <Accent x={602} y={337} />}
    {(act === 2 && phase === 2 || complete) && <><Accent x={672} y={242} kind="heart" /><Accent x={823} y={348} /></>}
  </g>
}

/** Each action follows its corresponding spoken line; paused stages keep their pose. */
export function StoryStage({ storyId, lineIndex, speaking, running, complete = false, rate = 1, label }: StoryStageProps) {
  const id = useId().replace(/:/g, '')
  const [startedFor, setStartedFor] = useState<string | null>(running ? storyId : null)
  useEffect(() => { if (running) setStartedFor(storyId) }, [running, storyId])
  const currentLine = Math.max(0, Math.min(8, Math.floor(lineIndex)))
  const act = Math.floor(currentLine / 3)
  const phase = currentLine % 3
  const sceneProps = { act, phase, speaking: speaking && !complete, complete }
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1
  const timing = { '--story-tick': `${1 / safeRate}s` } as CSSProperties
  return (
    <div className={`story-stage story-stage--${storyId}${running ? ' is-running' : ' is-paused'}${running || startedFor === storyId ? ' has-started' : ''}${complete ? ' is-complete' : ''}`} style={timing}>
      <svg className="story-stage__svg" viewBox="0 0 1000 560" role="img" aria-label={label} focusable="false">
        <title>{label}</title>
        {storyId === 'numbers' ? <Garden gradientId={`story-${id}`} /> : storyId !== 'classroom' && <Room storyId={storyId} gradientId={`story-${id}`} />}
        {storyId === 'family' ? <FamilyScene {...sceneProps} /> : storyId === 'school-things' ? <SchoolScene {...sceneProps} /> : storyId === 'colors' ? <ColorsScene {...sceneProps} /> : storyId === 'numbers' ? <NumbersScene {...sceneProps} /> : <ClassroomScene {...sceneProps} />}
        <path d="M25 16H975" stroke="#fffaf0" strokeWidth="2" opacity=".35" strokeLinecap="round" />
      </svg>
    </div>
  )
}
