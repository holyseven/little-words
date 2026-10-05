import type { ReactNode } from 'react'

const ink = '#514B55'
const wood = '#D69861'
const woodEdge = '#AE704C'
const blue = '#8AC9DF'
const teal = '#639A85'
const coral = '#ED998B'
const cream = '#FFF8E9'

function Board({ x = 20, y = 24, width = 120, height = 78 }: { x?: number; y?: number; width?: number; height?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="6" fill={woodEdge} />
      <rect x={x + 6} y={y + 6} width={width - 12} height={height - 12} rx="2" fill={teal} />
      <path d={`M${x - 3} ${y + height}h${width + 6}`} stroke={wood} strokeWidth="7" strokeLinecap="round" />
      <path d={`M${x + 16} ${y + height - 3}h15`} stroke={cream} strokeWidth="4" strokeLinecap="round" />
    </g>
  )
}

function Desk({ x = 28, y = 62, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinejoin="round">
      <path d="M17 17v56M86 17v56" stroke={woodEdge} strokeWidth="8" strokeLinecap="round" />
      <path d="M7 30v49M101 30v49" stroke={woodEdge} strokeWidth="9" strokeLinecap="round" />
      <path d="M16 0h78l17 23H0z" fill="#E7B57D" stroke={woodEdge} strokeWidth="3" />
      <path d="M0 23h111v10H0z" fill={wood} stroke={woodEdge} strokeWidth="3" />
      <path d="M33 26h45v16H33z" fill={wood} stroke={woodEdge} strokeWidth="3" />
      <path d="M51 33h10" stroke={woodEdge} strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}

function Pencil({ pen = false }: { pen?: boolean }) {
  return (
    <g transform="rotate(35 80 80)" strokeLinejoin="round">
      <rect x="68" y="20" width="24" height="97" rx="4" fill={pen ? blue : '#F0C56A'} stroke={ink} strokeWidth="3" />
      {pen ? (
        <>
          <path d="M68 44h24M76 21v30" stroke={ink} strokeWidth="3" />
          <path d="M92 27h7v35" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
          <path d="M71 117h18l-9 23z" fill="#C6D4DA" stroke={ink} strokeWidth="3" />
          <path d="M80 135v6" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M80 40v76" stroke="#D4A34B" strokeWidth="4" />
          <path d="M68 39h24V23q0-7-7-7H75q-7 0-7 7z" fill={coral} stroke={ink} strokeWidth="3" />
          <path d="M68 35h24v10H68z" fill="#D6DDE0" stroke={ink} strokeWidth="3" />
          <path d="M68 117h24l-12 27z" fill="#F1D4AE" stroke={ink} strokeWidth="3" />
          <path d="M76 136h8l-4 9z" fill={ink} />
        </>
      )}
    </g>
  )
}

function picture(svgId: string): ReactNode {
  switch (svgId) {
    case 'classroom':
      return (
        <>
          <rect x="10" y="15" width="140" height="126" rx="12" fill="#F7EAD1" />
          <path d="M10 119h140v15q0 7-7 7H17q-7 0-7-7z" fill="#E9D7B8" />
          <Board x={18} y={25} width={89} height={55} />
          <rect x="118" y="31" width="24" height="39" rx="2" fill={blue} stroke="white" strokeWidth="5" />
          <path d="M130 31v39M118 51h24" stroke="white" strokeWidth="3" />
          <Desk x={23} y={89} scale={0.45} />
          <Desk x={87} y={89} scale={0.45} />
        </>
      )
    case 'desk':
      return <Desk />
    case 'chair':
      return (
        <g stroke={woodEdge} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round">
          <path d="M51 25v106M110 25v106" fill="none" />
          <rect x="47" y="28" width="67" height="44" rx="5" fill="#E7B57D" />
          <path d="M47 56h67" strokeWidth="3" />
          <path d="M42 94v45M103 94v45" />
          <path d="M49 78h62l-6 22H37z" fill="#E7B57D" />
          <path d="M39 100h66" />
        </g>
      )
    case 'blackboard':
      return (
        <>
          <path d="M42 101l-9 37M118 101l9 37" stroke={woodEdge} strokeWidth="7" strokeLinecap="round" />
          <Board y={27} height={91} />
          <circle cx="51" cy="63" r="13" fill="none" stroke={cream} strokeWidth="3" />
          <path d="M82 76l16-27 17 27zM39 95h61" fill="none" stroke={cream} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    case 'door':
      return (
        <>
          <path d="M33 140V21h94v119" fill="#E8CDA4" stroke={woodEdge} strokeWidth="6" strokeLinejoin="round" />
          <rect x="42" y="29" width="76" height="111" rx="2" fill={wood} />
          <rect x="54" y="42" width="53" height="36" rx="3" fill="#E9B885" stroke={woodEdge} strokeWidth="3" />
          <rect x="54" y="100" width="53" height="27" rx="3" fill="#E9B885" stroke={woodEdge} strokeWidth="3" />
          <circle cx="106" cy="89" r="6" fill="#F5D474" stroke={woodEdge} strokeWidth="2" />
          <path d="M24 141h112" stroke={woodEdge} strokeWidth="6" strokeLinecap="round" />
        </>
      )
    case 'window':
      return (
        <>
          <rect x="30" y="28" width="100" height="98" rx="3" fill={blue} stroke={woodEdge} strokeWidth="6" />
          <circle cx="109" cy="48" r="11" fill="#F8DC87" />
          <path d="M39 73q10-16 21-2 17-10 23 5H39" fill="#F6FCFD" />
          <path d="M80 29v96M32 80h96" stroke={cream} strokeWidth="7" />
          <path d="M25 27h24q-1 42-24 67zM135 27h-24q1 42 24 67z" fill={coral} stroke="#C87D74" strokeWidth="3" strokeLinejoin="round" />
          <path d="M22 22h116M25 131h110" stroke={woodEdge} strokeWidth="7" strokeLinecap="round" />
        </>
      )
    case 'teacher':
      return (
        <>
          <Board x={10} y={23} width={98} height={76} />
          <path d="M28 69l13-23 14 23zM64 48h23M64 61h16" fill="none" stroke={cream} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M105 123v18M126 123v18" stroke={ink} strokeWidth="10" strokeLinecap="round" />
          <path d="M98 85q18-14 35 0l7 39H91z" fill={coral} />
          <path d="M108 80l8 18 8-18" fill={cream} />
          <path d="M98 90L80 77M133 90l10 17" stroke="#E6B493" strokeWidth="10" strokeLinecap="round" />
          <path d="M81 78L64 47" stroke={woodEdge} strokeWidth="3" strokeLinecap="round" />
          <path d="M96 63V46q0-23 20-23t21 23v26" fill="#746052" />
          <ellipse cx="116" cy="56" rx="19" ry="23" fill="#F2C6A4" />
          <path d="M97 50q0-26 20-25 20 1 20 28-12-5-17-16-10 12-23 13" fill="#746052" />
          <circle cx="109" cy="57" r="2.3" fill={ink} /><circle cx="124" cy="57" r="2.3" fill={ink} />
          <path d="M110 67q6 5 12 0" fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )
    case 'school':
      return (
        <>
          <path d="M22 66h116v72H22z" fill="#F2CE94" stroke={woodEdge} strokeWidth="3" />
          <path d="M12 67l17-22h102l17 22z" fill={coral} stroke="#C87D74" strokeWidth="3" strokeLinejoin="round" />
          <path d="M55 47l25-21 25 21v91H55z" fill="#FFF1D4" stroke={woodEdge} strokeWidth="3" strokeLinejoin="round" />
          <path d="M80 27V11l21 5-21 7" fill={coral} stroke={woodEdge} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="80" cy="58" r="14" fill="white" stroke={woodEdge} strokeWidth="3" />
          <path d="M80 49v10l7 4" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M67 138V100q13-17 26 0v38z" fill={teal} />
          {[32, 114].map((x) => <g key={x} fill={blue} stroke={woodEdge} strokeWidth="2"><rect x={x} y="81" width="14" height="17" rx="2" /><rect x={x} y="109" width="14" height="17" rx="2" /></g>)}
          <path d="M15 140h130" stroke={woodEdge} strokeWidth="5" strokeLinecap="round" />
        </>
      )
    case 'eraser':
      return (
        <g transform="rotate(-24 80 80)" stroke={ink} strokeWidth="3" strokeLinejoin="round">
          <path d="M24 60l15-16h90l9 16v49H24z" fill="#F1B2A8" />
          <path d="M24 60h114v49H24z" fill={coral} />
          <path d="M63 44h43l-3 16H59z" fill="#F9EBCF" />
          <path d="M59 60h44v49H59z" fill={cream} />
          <path d="M70 77h22M70 86h16" stroke="#D8C6A3" strokeWidth="4" strokeLinecap="round" />
        </g>
      )
    case 'ruler':
      return (
        <g transform="rotate(-29 80 80)">
          <rect x="15" y="60" width="130" height="40" rx="5" fill="#F4D27B" stroke="#B58B47" strokeWidth="3" />
          {Array.from({ length: 13 }, (_, i) => <path key={i} d={`M${25 + i * 9} 61v${i % 2 ? 10 : 18}`} stroke="#916F40" strokeWidth="2.5" />)}
          <circle cx="134" cy="87" r="4" fill={cream} stroke="#B58B47" strokeWidth="2" />
        </g>
      )
    case 'pencil-case':
      return (
        <g transform="rotate(-9 80 80)">
          <rect x="19" y="51" width="122" height="65" rx="18" fill={blue} stroke="#548FAA" strokeWidth="3" />
          <path d="M30 69h99" stroke="#FFF8E9" strokeWidth="6" strokeLinecap="round" />
          <path d="M35 69h87" stroke="#548FAA" strokeWidth="2" strokeDasharray="2 4" />
          <path d="M126 69v15" stroke="#548FAA" strokeWidth="3" />
          <rect x="121" y="80" width="10" height="15" rx="4" fill="#F5D474" stroke="#B58B47" strokeWidth="2" />
          <path d="M70 86l4 8 9 1-6 6 1 9-8-4-8 4 2-9-7-6 9-1z" fill={cream} />
        </g>
      )
    case 'schoolbag':
      return (
        <>
          <path d="M41 70q-25 2-16 55M119 70q25 2 16 55" fill="none" stroke="#C87D74" strokeWidth="10" strokeLinecap="round" />
          <path d="M65 34V24q15-16 30 0v10" fill="none" stroke="#C87D74" strokeWidth="8" />
          <rect x="33" y="34" width="94" height="104" rx="25" fill={coral} stroke="#C87D74" strokeWidth="3" />
          <path d="M34 66q46 21 92 0" fill="#F1B2A8" stroke="#C87D74" strokeWidth="3" />
          <rect x="46" y="91" width="68" height="34" rx="9" fill="#F6CC8F" stroke="#C87D74" strokeWidth="3" />
          <path d="M54 101h50" stroke="#C87D74" strokeWidth="3" strokeLinecap="round" />
          <rect x="73" y="65" width="14" height="20" rx="4" fill={cream} stroke="#C87D74" strokeWidth="3" />
          <circle cx="103" cy="106" r="3" fill={cream} />
        </>
      )
    case 'crayon':
      return (
        <g transform="rotate(35 80 80)" stroke="#BA6F69" strokeWidth="3" strokeLinejoin="round">
          <path d="M67 43l13-25 13 25v91H67z" fill={coral} />
          <path d="M67 48h26v68H67z" fill="#FBD6C7" />
          <path d="M67 56h26M67 107h26" strokeWidth="4" />
          <path d="M76 71l8 13-8 13" fill="none" strokeWidth="4" strokeLinecap="round" />
        </g>
      )
    case 'notebook':
      return (
        <g transform="rotate(-8 80 80)">
          <rect x="40" y="25" width="84" height="115" rx="7" fill="#E8D8B7" stroke="#A99062" strokeWidth="3" />
          <rect x="35" y="20" width="84" height="115" rx="7" fill="#F4D27B" stroke="#B58B47" strokeWidth="3" />
          <path d="M49 21v113" stroke="#D6AE60" strokeWidth="3" />
          {[34, 52, 70, 88, 106, 124].map((y) => <path key={y} d={`M40 ${y}h-9q-7-5 0-9h9`} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />)}
          <rect x="62" y="43" width="41" height="32" rx="4" fill={cream} />
          <path d="M71 54h23M71 63h17" stroke="#D6AE60" strokeWidth="3" strokeLinecap="round" />
        </g>
      )
    case 'pencil':
      return <Pencil />
    case 'pen':
      return <Pencil pen />
    case 'book':
      return (
        <g strokeLinejoin="round">
          <path d="M13 40q33-13 67 4 34-17 67-4v86q-32-11-67 5-35-16-67-5z" fill={blue} stroke="#548FAA" strokeWidth="4" />
          <path d="M20 32q32-7 60 9 28-16 60-9v83q-33-7-60 9-27-16-60-9z" fill={cream} stroke="#C6B99C" strokeWidth="3" />
          <path d="M80 41v82" stroke="#C6B99C" strokeWidth="3" />
          <circle cx="48" cy="64" r="12" fill={coral} />
          <path d="M98 54h27M98 66h23M98 78h26M34 90h29M34 101h25M98 95h22" stroke="#C7BBA5" strokeWidth="4" strokeLinecap="round" />
        </g>
      )
    default:
      return null
  }
}

/** Local, text-free illustrations also remain legible on the small game cards. */
export function SchoolWordArt({ svgId, label }: { svgId: string; label: string }) {
  const art = picture(svgId)
  if (!art) return null
  return (
    <svg viewBox="0 0 160 160" role="img" aria-label={label} focusable="false">
      <ellipse cx="80" cy="144" rx="57" ry="6" fill="#E2D8C7" opacity="0.45" />
      {art}
    </svg>
  )
}
