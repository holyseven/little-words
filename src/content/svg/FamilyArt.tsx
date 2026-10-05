type Member = 'mum' | 'dad' | 'grandma' | 'grandpa' | 'brother' | 'sister' | 'baby'

const ink = '#51474A'
const skin = '#F2C6A4'
const hair = '#70554C'
const silver = '#D5D4D5'
const coral = '#E69B98'
const blue = '#85B8D0'
const cream = '#FFF7E7'

const outfits: Record<Member, string> = {
  mum: coral,
  dad: blue,
  grandma: '#B2A0C5',
  grandpa: '#8AAA90',
  brother: '#E5B95E',
  sister: '#9CBDAE',
  baby: '#F0C58B',
}

/** Reuse each family member's hairstyle and clothes in their portrait and photo. */
function Person({ member }: { member: Member }) {
  const grandma = member === 'grandma'
  const grandpa = member === 'grandpa'
  const elder = grandma || grandpa
  const child = member === 'brother' || member === 'sister'
  const longHair = member === 'mum' || member === 'sister'
  const color = outfits[member]

  if (member === 'baby') {
    return (
      <g>
        <path d="M39 76q-11 36 9 56 32 19 57-1 20-25 3-55z" fill={color} stroke="#CE9D66" strokeWidth="2.5" />
        <path d="M42 81l62 42M108 81l-54 49" stroke="#FFF0D7" strokeWidth="9" />
        <ellipse cx="76" cy="56" rx="34" ry="36" fill={skin} />
        <path d="M67 22q16-16 21 1-3 11-13 5" fill="none" stroke={hair} strokeWidth="4" strokeLinecap="round" />
        <circle cx="64" cy="54" r="3" fill={ink} /><circle cx="88" cy="54" r="3" fill={ink} />
        <ellipse cx="52" cy="64" rx="6" ry="4" fill={coral} opacity="0.6" /><ellipse cx="100" cy="64" rx="6" ry="4" fill={coral} opacity="0.6" />
        <ellipse cx="76" cy="72" rx="11" ry="7" fill={blue} />
        <circle cx="76" cy="76" r="6" fill="none" stroke="#578FA9" strokeWidth="3" />
      </g>
    )
  }

  return (
    <g>
      {longHair && <path d="M44 57q-7-42 32-42t32 42l5 44H38z" fill={hair} />}
      {grandma && <circle cx="76" cy="22" r="17" fill={silver} stroke="#AEAAAD" strokeWidth="2" />}
      <path d="M41 98l-9 25M111 98l9 25" stroke={skin} strokeWidth="12" strokeLinecap="round" />
      <path d="M48 90q28-15 56 0l12 47H36z" fill={color} />
      <path d="M65 83v9q11 11 22 0v-9" fill={skin} />
      {(member === 'dad' || grandpa) && <path d="M57 88l12 14 7-10 7 10 12-14M76 94v43" fill={cream} stroke={grandpa ? '#6A8C73' : '#6297B0'} strokeWidth="2" strokeLinejoin="round" />}
      {grandpa && <path d="M49 91l27 28 27-28v46H49z" fill="#6C9078" />}
      {member === 'mum' && <path d="M58 92q18 22 36 0" fill="none" stroke={cream} strokeWidth="5" strokeLinecap="round" />}
      {grandma && <><path d="M57 89q19 18 38 0M76 100v37" fill="none" stroke="#87799D" strokeWidth="3" /><circle cx="76" cy="111" r="2.3" fill={cream} /><circle cx="76" cy="123" r="2.3" fill={cream} /></>}
      {member === 'brother' && <><path d="M44 110h64M40 124h72" stroke={cream} strokeWidth="7" /><path d="M61 92q15 10 30 0" fill="none" stroke="#C59743" strokeWidth="4" /></>}
      {member === 'sister' && <><path d="M49 91l17 16 10-11 10 11 17-16" fill={cream} /><path d="M73 113h6v17h-6z" fill="#789D8E" /></>}
      <ellipse cx="76" cy="57" rx={child ? 29 : 30} ry={child ? 31 : 34} fill={skin} />
      {grandpa ? (
        <>
          <path d="M45 58q-10-34 18-37l-3 19q-9 3-9 20M107 58q10-34-18-37l3 19q9 3 9 20" fill={silver} />
          <path d="M67 26q9-5 18 0" fill="none" stroke={silver} strokeWidth="4" strokeLinecap="round" />
        </>
      ) : grandma ? (
        <path d="M44 55q-5-37 32-37t32 37q-13-5-20-20-16 16-44 20" fill={silver} />
      ) : member === 'dad' ? (
        <path d="M45 51q-5-38 30-36 37-2 33 38l-10-18q-21 10-40 0l-7 21z" fill={hair} />
      ) : member === 'brother' ? (
        <path d="M46 49q-3-24 17-28l-3-10 14 7 8-12 7 13q24 5 17 32L91 34q-18 11-34 5z" fill={hair} />
      ) : (
        <path d="M45 51q-5-37 31-36t31 38q-20-6-25-22-13 18-37 20" fill={hair} />
      )}
      {member === 'sister' && <><path d="M46 45q-21 8-12 35l17-15M106 45q21 8 12 35l-17-15" fill={hair} /><path d="M43 49l-10-8v17zM45 49l10-8v17zM107 49l-10-8v17zM109 49l10-8v17z" fill={coral} /></>}
      <circle cx="65" cy="57" r="2.7" fill={ink} /><circle cx="87" cy="57" r="2.7" fill={ink} />
      {elder && <g fill="none" stroke={ink} strokeWidth="2.3"><circle cx="64" cy="58" r="9" /><circle cx="88" cy="58" r="9" /><path d="M73 58h6M54 56l-8-2M98 56l8-2" /></g>}
      {grandpa ? <><path d="M76 69q-12-8-19 5 11 3 19-1 8 4 19 1-7-13-19-5" fill={silver} /><path d="M69 79q7 4 14 0" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" /></> : <path d="M67 72q9 7 18 0" fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />}
      <ellipse cx="52" cy="67" rx="5" ry="3.5" fill={coral} opacity="0.5" /><ellipse cx="100" cy="67" rx="5" ry="3.5" fill={coral} opacity="0.5" />
    </g>
  )
}

function memberOf(svgId: string): Member | null {
  const value = svgId.replace(/^family-/, '')
  if (value === 'mother') return 'mum'
  if (value === 'father') return 'dad'
  return Object.prototype.hasOwnProperty.call(outfits, value) ? value as Member : null
}

export function FamilyArt({ svgId, label }: { svgId: string; label: string }) {
  if (svgId === 'family') {
    return (
      <svg viewBox="0 0 160 160" role="img" aria-label={label} focusable="false">
        <rect x="8" y="13" width="144" height="135" rx="14" fill="#E9D0A9" />
        <rect x="15" y="20" width="130" height="121" rx="9" fill="#FFF3DD" />
        <path d="M70 34q-10-11-15-2-5 9 15 20 20-11 15-20-5-9-15 2" fill={coral} opacity="0.5" />
        <g transform="translate(10 29) scale(.48)"><Person member="grandma" /></g>
        <g transform="translate(39 22) scale(.54)"><Person member="dad" /></g>
        <g transform="translate(71 22) scale(.54)"><Person member="mum" /></g>
        <g transform="translate(91 29) scale(.46)"><Person member="grandpa" /></g>
        <g transform="translate(26 77) scale(.46)"><Person member="brother" /></g>
        <g transform="translate(63 84) scale(.39)"><Person member="baby" /></g>
        <g transform="translate(87 77) scale(.46)"><Person member="sister" /></g>
        <path d="M19 141h122" stroke="#D5B68B" strokeWidth="5" strokeLinecap="round" />
      </svg>
    )
  }

  const member = memberOf(svgId)
  if (!member) return null
  return (
    <svg viewBox="0 0 160 160" role="img" aria-label={label} focusable="false">
      <path d="M18 140V60L80 16l62 44v80z" fill="#F5EBDD" />
      <path d="M15 60l65-46 65 46" fill="none" stroke="#E6D5BC" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="80" cy="144" rx="55" ry="6" fill="#DCD1BF" opacity="0.5" />
      <g transform="translate(4 3)"><Person member={member} /></g>
    </svg>
  )
}
